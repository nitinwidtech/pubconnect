"""Phase 2.1 - Used-Code Feedback: POST /api/customer/action-tokens/status.

Covers:
  - active status before resolution
  - used status after admin resolve + used_at timestamp
  - single-use (second resolve -> 400)
  - IDOR: customer B cannot see customer A's token (404)
  - Invalid/unknown token -> 404
  - JWT isolation: admin token rejected on /customer/action-tokens/status
  - expires_at ~5 min ahead; used token never flips back to active
  - server-authoritative balance: after admin redeem the wallet reduces
"""
import os
import uuid
import time
from datetime import datetime, timezone, timedelta
import pytest
import requests


def _load_url():
    v = os.environ.get("REACT_APP_BACKEND_URL", "")
    if not v:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    v = line.split("=", 1)[1].strip()
                    break
    return v.rstrip("/")


BASE = _load_url()
API = f"{BASE}/api"
CUST_API = f"{BASE}/api/customer"

OWNER = ("nitinwidtech@gmail.com", "PubConnect2026!")
CUST_SEED = {"identifier": "james.demo@crownanchor.demo", "password": "Customer2026!"}


def hdr(tok):
    return {"Authorization": f"Bearer {tok}"}


def rand_mobile():
    return "0770" + str(uuid.uuid4().int)[:7]


def admin_login(creds):
    r = requests.post(f"{API}/auth/login", json={"email": creds[0], "password": creds[1]})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def cust_login(identifier, password):
    r = requests.post(f"{CUST_API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def register_customer(name="TEST Status"):
    body = {
        "full_name": name,
        "password": "TestPass2026!",
        "marketing_consent": False,
        "email": f"stat_{uuid.uuid4().hex[:8]}@test.demo",
        "mobile_number": rand_mobile(),
    }
    # Space out registrations due to rate limit ~8/min
    for attempt in range(5):
        r = requests.post(f"{CUST_API}/auth/register", json=body)
        if r.status_code == 429:
            time.sleep(10)
            continue
        return r
    return r


@pytest.fixture(scope="module")
def owner_token():
    return admin_login(OWNER)


@pytest.fixture(scope="module")
def seeded_customer():
    d = cust_login(**CUST_SEED)
    return d  # has token + customer


def _create_pay_token(cust_tok):
    r = requests.post(f"{CUST_API}/action-tokens", headers=hdr(cust_tok),
                      json={"action_type": "PAY"})
    assert r.status_code == 200, r.text
    return r.json()


class TestStatusActive:
    def test_active_before_resolution(self, seeded_customer):
        tok = seeded_customer["token"]
        gen = _create_pay_token(tok)
        r = requests.post(f"{CUST_API}/action-tokens/status", headers=hdr(tok),
                          json={"token": gen["token"]})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "active"
        assert d["used_at"] is None
        assert d["action_type"] == "PAY"
        assert d["expires_at"] == gen["expires_at"]

    def test_expires_at_about_5_minutes_ahead(self, seeded_customer):
        tok = seeded_customer["token"]
        gen = _create_pay_token(tok)
        exp = datetime.fromisoformat(gen["expires_at"])
        now = datetime.now(timezone.utc)
        delta = (exp - now).total_seconds()
        # should be between 4m and 6m (allow clock skew)
        assert 4 * 60 < delta < 6 * 60, f"expires_at delta={delta}s"


class TestUsedTransition:
    def test_used_after_admin_resolve_and_single_use(self, seeded_customer, owner_token):
        tok = seeded_customer["token"]
        gen = _create_pay_token(tok)

        # status before -> active
        r1 = requests.post(f"{CUST_API}/action-tokens/status", headers=hdr(tok),
                           json={"token": gen["token"]})
        assert r1.json()["status"] == "active"

        # admin resolve
        res = requests.post(f"{API}/action-tokens/resolve", headers=hdr(owner_token),
                            json={"token": gen["token"]})
        assert res.status_code == 200, res.text
        assert res.json()["customer_id"] == seeded_customer["customer"]["id"]

        # status after -> used with used_at populated
        r2 = requests.post(f"{CUST_API}/action-tokens/status", headers=hdr(tok),
                           json={"token": gen["token"]})
        assert r2.status_code == 200
        d = r2.json()
        assert d["status"] == "used"
        assert d["used_at"] is not None
        # ISO parseable
        datetime.fromisoformat(d["used_at"])

        # Second resolve -> 400 "already been used"
        res2 = requests.post(f"{API}/action-tokens/resolve", headers=hdr(owner_token),
                             json={"token": gen["token"]})
        assert res2.status_code == 400
        assert "already" in res2.json()["detail"].lower()

        # Status still "used" (never flips back)
        r3 = requests.post(f"{CUST_API}/action-tokens/status", headers=hdr(tok),
                           json={"token": gen["token"]})
        assert r3.json()["status"] == "used"
        assert r3.json()["used_at"] == d["used_at"]


class TestInvalidAndIsolation:
    def test_invalid_token_404(self, seeded_customer):
        r = requests.post(f"{CUST_API}/action-tokens/status",
                          headers=hdr(seeded_customer["token"]),
                          json={"token": "not_a_real_token_" + uuid.uuid4().hex})
        assert r.status_code == 404

    def test_admin_token_rejected(self, owner_token):
        r = requests.post(f"{CUST_API}/action-tokens/status",
                          headers=hdr(owner_token),
                          json={"token": "whatever"})
        assert r.status_code == 401

    def test_no_auth_rejected(self):
        r = requests.post(f"{CUST_API}/action-tokens/status",
                          json={"token": "whatever"})
        assert r.status_code in (401, 403)


class TestIDORStatus:
    """CRITICAL: customer B must get 404 when probing customer A's token."""

    def test_customer_b_cannot_see_customer_a_token(self, seeded_customer):
        # register customer B (unique)
        rb = register_customer(name="TEST B Status")
        assert rb.status_code == 200, rb.text
        b_token = rb.json()["token"]

        # Customer A generates a PAY token
        gen = _create_pay_token(seeded_customer["token"])

        # A can see it
        ra = requests.post(f"{CUST_API}/action-tokens/status",
                           headers=hdr(seeded_customer["token"]),
                           json={"token": gen["token"]})
        assert ra.status_code == 200
        assert ra.json()["status"] == "active"

        # B must NOT see it -> 404 (not 403, not 200)
        rb_probe = requests.post(f"{CUST_API}/action-tokens/status",
                                 headers=hdr(b_token),
                                 json={"token": gen["token"]})
        assert rb_probe.status_code == 404, f"IDOR LEAK: got {rb_probe.status_code} {rb_probe.text}"


class TestServerAuthoritativeBalance:
    def test_balance_reduces_after_redeem_from_wallet(self, seeded_customer, owner_token):
        tok = seeded_customer["token"]
        cid = seeded_customer["customer"]["id"]

        # Ensure a known balance exists: deposit 2000 minor
        dep = requests.post(f"{API}/ledger/deposit", headers=hdr(owner_token),
                            json={"customer_id": cid, "amount_minor": 2000})
        assert dep.status_code == 200, dep.text

        w1 = requests.get(f"{CUST_API}/wallet", headers=hdr(tok))
        assert w1.status_code == 200
        before = w1.json()["balance"]["total_minor"]
        assert before >= 2000

        # Redeem 500 minor
        red = requests.post(f"{API}/ledger/redeem", headers=hdr(owner_token),
                            json={"customer_id": cid, "amount_minor": 500})
        assert red.status_code == 200, red.text

        w2 = requests.get(f"{CUST_API}/wallet", headers=hdr(tok))
        assert w2.status_code == 200
        after = w2.json()["balance"]["total_minor"]
        assert after == before - 500, f"before={before} after={after}"

    def test_redeem_over_balance_rejected(self, seeded_customer, owner_token):
        cid = seeded_customer["customer"]["id"]
        # ridiculously large
        red = requests.post(f"{API}/ledger/redeem", headers=hdr(owner_token),
                            json={"customer_id": cid, "amount_minor": 10**9})
        assert red.status_code in (400, 422), red.text


class TestCrossPub:
    """Admin of pub X cannot resolve a token belonging to pub Y.
    We only have one seeded pub here so we assert via unknown-token semantics
    (404 for admin on bogus/foreign token). Full multi-pub seeding is out of
    scope for this smoke."""

    def test_admin_resolve_unknown_token_404(self, owner_token):
        r = requests.post(f"{API}/action-tokens/resolve", headers=hdr(owner_token),
                          json={"token": "foreign_" + uuid.uuid4().hex})
        assert r.status_code == 404
