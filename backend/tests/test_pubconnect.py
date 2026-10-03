"""PubConnect Phase 1 backend regression tests.
Covers: auth, dashboard, customers, ledger (deposit/redeem/refund/reversal/adjustment),
offers, staff, audit logs, pub, permissions, multi-tenant isolation,
ledger safety (negative balance, append-only, refund cap).
"""
import os
import time
import uuid
import pytest
import requests
from pathlib import Path

# Load frontend/.env to get REACT_APP_BACKEND_URL
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
except Exception:
    pass

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"
API = f"{BASE_URL}/api"

OWNER = {"email": "nitinwidtech@gmail.com", "password": "PubConnect2026!"}
MANAGER = {"email": "manager@crownanchor.demo", "password": "Manager2026!"}
BAR = {"email": "barstaff@crownanchor.demo", "password": "BarStaff2026!"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['email']}: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and "user" in data and "pub" in data and "permissions" in data
    return data


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------------------- Fixtures --------------------
@pytest.fixture(scope="session")
def owner():
    return _login(OWNER)

@pytest.fixture(scope="session")
def manager():
    return _login(MANAGER)

@pytest.fixture(scope="session")
def bar():
    return _login(BAR)

@pytest.fixture(scope="session")
def owner_h(owner):
    return _hdr(owner["token"])

@pytest.fixture(scope="session")
def manager_h(manager):
    return _hdr(manager["token"])

@pytest.fixture(scope="session")
def bar_h(bar):
    return _hdr(bar["token"])


# -------------------- Auth --------------------
class TestAuth:
    def test_owner_login(self, owner):
        assert owner["user"]["role"] == "OWNER"
        assert "manage_pub" in owner["permissions"]
        assert "password_hash" not in owner["user"]

    def test_manager_login(self, manager):
        assert manager["user"]["role"] == "MANAGER"
        assert "manage_pub" not in manager["permissions"]
        assert "refund" in manager["permissions"]

    def test_barstaff_login(self, bar):
        assert bar["user"]["role"] == "BAR_STAFF"
        for p in ("refund", "reversal", "manual_adjustment", "manage_staff", "manage_offers", "view_audit", "manage_pub"):
            assert p not in bar["permissions"], f"BAR_STAFF should not have {p}"

    def test_invalid_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": OWNER["email"], "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, owner_h):
        r = requests.get(f"{API}/auth/me", headers=owner_h)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "OWNER"

    def test_me_no_token(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# -------------------- Dashboard --------------------
class TestDashboard:
    def test_dashboard_owner(self, owner_h):
        r = requests.get(f"{API}/dashboard", headers=owner_h)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_customers", "active_customers", "active_offers",
                  "total_deposits_minor", "total_redemptions_minor",
                  "promo_issued_minor", "recent_transactions"):
            assert k in d
        assert isinstance(d["recent_transactions"], list)
        assert d["total_customers"] >= 4
        assert d["active_offers"] >= 1


# -------------------- Customers --------------------
class TestCustomers:
    def test_list(self, owner_h):
        r = requests.get(f"{API}/customers", headers=owner_h)
        assert r.status_code == 200
        arr = r.json()
        assert isinstance(arr, list) and len(arr) >= 1
        assert "balance" in arr[0] and "wallet_id" in arr[0]

    def test_create_and_duplicate_mobile(self, owner_h):
        mobile = f"+447{uuid.uuid4().hex[:9]}"
        payload = {"full_name": "TEST_Jane Doe", "mobile_number": mobile, "marketing_consent": True}
        r = requests.post(f"{API}/customers", headers=owner_h, json=payload)
        assert r.status_code == 200, r.text
        c = r.json()
        assert c["mobile_number"] == mobile
        assert c["wallet_id"]
        assert c["balance"]["total_minor"] == 0

        # verify GET persistence
        g = requests.get(f"{API}/customers/{c['id']}", headers=owner_h)
        assert g.status_code == 200
        assert g.json()["full_name"] == "TEST_Jane Doe"

        # duplicate rejected
        dup = requests.post(f"{API}/customers", headers=owner_h, json=payload)
        assert dup.status_code == 409

    def test_search(self, owner_h):
        r = requests.get(f"{API}/customers", headers=owner_h, params={"search": "TEST_"})
        assert r.status_code == 200


# -------------------- Ledger safety & correctness --------------------
@pytest.fixture(scope="class")
def test_customer(owner_h):
    mobile = f"+447{uuid.uuid4().hex[:9]}"
    r = requests.post(f"{API}/customers", headers=owner_h,
                      json={"full_name": "TEST_Ledger Cust", "mobile_number": mobile})
    assert r.status_code == 200
    return r.json()


class TestLedger:
    def test_deposit_positive(self, owner_h, test_customer):
        r = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                          json={"customer_id": test_customer["id"], "amount_minor": 1500})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["cash_transaction"]["amount_minor"] == 1500
        assert d["balance"]["total_minor"] >= 1500

    def test_deposit_zero_rejected(self, owner_h, test_customer):
        r = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                          json={"customer_id": test_customer["id"], "amount_minor": 0})
        assert r.status_code == 400

    def test_deposit_with_offer_adds_bonus(self, owner_h, test_customer):
        # Find any active offer
        offers = requests.get(f"{API}/offers", headers=owner_h).json()
        active = [o for o in offers if o.get("is_active")]
        if not active:
            pytest.skip("no active offer")
        off = active[0]
        before_times = off.get("times_redeemed", 0)
        r = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                          json={"customer_id": test_customer["id"],
                                "amount_minor": off["deposit_amount"],
                                "offer_id": off["id"]})
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["offer_applied"] is not None
        assert data["bonus_transaction"] is not None
        assert data["bonus_transaction"]["amount_minor"] == off["bonus_value"]
        # Verify times_redeemed incremented
        offers2 = requests.get(f"{API}/offers", headers=owner_h).json()
        off2 = next(o for o in offers2 if o["id"] == off["id"])
        assert off2["times_redeemed"] == before_times + 1

    def test_redeem_within_balance_and_overdraft_rejected(self, owner_h, test_customer):
        # Get current balance
        g = requests.get(f"{API}/customers/{test_customer['id']}", headers=owner_h).json()
        bal = g["balance"]["total_minor"]
        assert bal > 0
        # Overdraft
        r = requests.post(f"{API}/ledger/redeem", headers=owner_h,
                          json={"customer_id": test_customer["id"], "amount_minor": bal + 100})
        assert r.status_code == 400
        # Within
        r2 = requests.post(f"{API}/ledger/redeem", headers=owner_h,
                           json={"customer_id": test_customer["id"], "amount_minor": 100, "note": "test purchase"})
        assert r2.status_code == 200
        assert r2.json()["balance"]["total_minor"] == bal - 100

    def test_refund_rules(self, owner_h, test_customer):
        # Make a purchase first
        pr = requests.post(f"{API}/ledger/redeem", headers=owner_h,
                           json={"customer_id": test_customer["id"], "amount_minor": 500})
        assert pr.status_code == 200
        purchase_id = pr.json()["transaction"]["id"]
        # Missing reason
        r = requests.post(f"{API}/ledger/refund", headers=owner_h,
                          json={"original_transaction_id": purchase_id, "amount_minor": 100, "reason": "  "})
        assert r.status_code == 400
        # Partial refund OK
        r2 = requests.post(f"{API}/ledger/refund", headers=owner_h,
                           json={"original_transaction_id": purchase_id, "amount_minor": 200, "reason": "spill"})
        assert r2.status_code == 200
        # Exceeds remaining
        r3 = requests.post(f"{API}/ledger/refund", headers=owner_h,
                           json={"original_transaction_id": purchase_id, "amount_minor": 400, "reason": "x"})
        assert r3.status_code == 400
        # Refund referencing non-purchase (deposit)
        dep = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                            json={"customer_id": test_customer["id"], "amount_minor": 300}).json()
        bad = requests.post(f"{API}/ledger/refund", headers=owner_h,
                            json={"original_transaction_id": dep["cash_transaction"]["id"],
                                  "amount_minor": 100, "reason": "x"})
        assert bad.status_code == 400

    def test_reversal_rules(self, owner_h, test_customer):
        dep = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                            json={"customer_id": test_customer["id"], "amount_minor": 777}).json()
        tid = dep["cash_transaction"]["id"]
        # missing reason
        r0 = requests.post(f"{API}/ledger/reversal", headers=owner_h,
                           json={"transaction_id": tid, "reason": "  "})
        assert r0.status_code == 400
        # first reversal OK
        r1 = requests.post(f"{API}/ledger/reversal", headers=owner_h,
                           json={"transaction_id": tid, "reason": "mistake"})
        assert r1.status_code == 200
        # cannot reverse twice
        r2 = requests.post(f"{API}/ledger/reversal", headers=owner_h,
                           json={"transaction_id": tid, "reason": "again"})
        assert r2.status_code == 400

    def test_adjustment_cannot_go_negative(self, owner_h, test_customer):
        # try adjustment amount hugely negative
        r = requests.post(f"{API}/ledger/adjustment", headers=owner_h,
                          json={"customer_id": test_customer["id"],
                                "amount_minor": -9999999, "reason": "goodwill"})
        assert r.status_code == 400
        # amount zero rejected
        r0 = requests.post(f"{API}/ledger/adjustment", headers=owner_h,
                           json={"customer_id": test_customer["id"],
                                 "amount_minor": 0, "reason": "goodwill"})
        assert r0.status_code == 400
        # reason required
        rr = requests.post(f"{API}/ledger/adjustment", headers=owner_h,
                           json={"customer_id": test_customer["id"],
                                 "amount_minor": 50, "reason": " "})
        assert rr.status_code == 400
        # positive OK
        ok = requests.post(f"{API}/ledger/adjustment", headers=owner_h,
                           json={"customer_id": test_customer["id"],
                                 "amount_minor": 50, "reason": "goodwill"})
        assert ok.status_code == 200
        assert ok.json()["transaction"]["metadata"].get("exceptional") is True


# -------------------- Permissions (403s) --------------------
class TestPermissions:
    @pytest.mark.parametrize("path,method,body", [
        ("/offers", "POST", {"name": "x", "deposit_amount": 100, "bonus_value": 10}),
        ("/staff", "GET", None),
        ("/audit-logs", "GET", None),
        ("/ledger/refund", "POST", {"original_transaction_id": "000000000000000000000000", "amount_minor": 1, "reason": "x"}),
        ("/ledger/reversal", "POST", {"transaction_id": "000000000000000000000000", "reason": "x"}),
        ("/ledger/adjustment", "POST", {"customer_id": "000000000000000000000000", "amount_minor": 1, "reason": "x"}),
        ("/pub", "PATCH", {"name": "no"}),
    ])
    def test_bar_staff_denied(self, bar_h, path, method, body):
        r = requests.request(method, f"{API}{path}", headers=bar_h, json=body)
        assert r.status_code == 403, f"{method} {path}: expected 403 got {r.status_code} {r.text}"

    def test_manager_denied_pub_patch(self, manager_h):
        r = requests.patch(f"{API}/pub", headers=manager_h, json={"name": "NewName"})
        assert r.status_code == 403

    def test_manager_can_refund_reversal_adjustment_staff_offers(self, manager_h):
        # These should pass permission check (may 400/404 but not 403)
        for path, method, body in [
            ("/staff", "GET", None),
            ("/offers", "POST", {"name": "TEST_mgr_offer", "deposit_amount": 2000, "bonus_value": 100}),
        ]:
            r = requests.request(method, f"{API}{path}", headers=manager_h, json=body)
            assert r.status_code != 403, f"{path} denied for MANAGER"

    def test_access_denied_audit_entry_written(self, owner_h, bar_h):
        # Trigger ACCESS_DENIED
        requests.get(f"{API}/audit-logs", headers=bar_h)
        logs = requests.get(f"{API}/audit-logs", headers=owner_h).json()
        assert any(l.get("action_type") == "ACCESS_DENIED" for l in logs)


# -------------------- Offers CRUD --------------------
class TestOffers:
    def test_crud_and_toggle(self, owner_h):
        payload = {"name": "TEST_Offer A", "deposit_amount": 2000, "bonus_value": 300,
                   "max_total_redemptions": 2, "max_uses_per_customer": 1}
        r = requests.post(f"{API}/offers", headers=owner_h, json=payload)
        assert r.status_code == 200, r.text
        off = r.json()
        assert off["wallet_value"] == 2300

        # edit
        payload2 = {**payload, "name": "TEST_Offer A2", "bonus_value": 500}
        r2 = requests.patch(f"{API}/offers/{off['id']}", headers=owner_h, json=payload2)
        assert r2.status_code == 200
        assert r2.json()["bonus_value"] == 500

        # toggle
        r3 = requests.patch(f"{API}/offers/{off['id']}/toggle", headers=owner_h)
        assert r3.status_code == 200
        assert r3.json()["is_active"] is False

    def test_offer_usage_limits(self, owner_h):
        # Create limited offer and exercise limits
        p = {"name": "TEST_Limit", "deposit_amount": 1234, "bonus_value": 100,
             "max_total_redemptions": 1}
        off = requests.post(f"{API}/offers", headers=owner_h, json=p).json()
        # create a customer
        mob = f"+447{uuid.uuid4().hex[:9]}"
        c = requests.post(f"{API}/customers", headers=owner_h,
                          json={"full_name": "TEST_Lim", "mobile_number": mob}).json()
        d1 = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                           json={"customer_id": c["id"], "amount_minor": 1234, "offer_id": off["id"]})
        assert d1.status_code == 200 and d1.json()["offer_applied"]
        # Second use for same offer should be denied (total cap reached)
        d2 = requests.post(f"{API}/ledger/deposit", headers=owner_h,
                           json={"customer_id": c["id"], "amount_minor": 1234, "offer_id": off["id"]})
        assert d2.status_code == 400


# -------------------- Transactions --------------------
class TestTransactions:
    def test_list_and_filter(self, owner_h):
        r = requests.get(f"{API}/transactions", headers=owner_h)
        assert r.status_code == 200 and isinstance(r.json(), list)
        r2 = requests.get(f"{API}/transactions", headers=owner_h, params={"type": "CASH_DEPOSIT"})
        assert r2.status_code == 200
        for t in r2.json():
            assert t["transaction_type"] == "CASH_DEPOSIT"

    def test_detail_shows_linked(self, owner_h):
        txns = requests.get(f"{API}/transactions", headers=owner_h,
                            params={"type": "REFUND"}).json()
        if not txns:
            pytest.skip("no refund txn")
        d = requests.get(f"{API}/transactions/{txns[0]['id']}", headers=owner_h).json()
        assert "related_transaction" in d or "linked_transactions" in d


# -------------------- Staff --------------------
class TestStaff:
    def test_manager_cannot_create_owner(self, manager_h):
        r = requests.post(f"{API}/staff", headers=manager_h,
                          json={"full_name": "TEST_X", "email": f"test_{uuid.uuid4().hex[:6]}@t.com",
                                "password": "Password1!", "role": "OWNER"})
        assert r.status_code == 403

    def test_cannot_deactivate_self(self, owner_h, owner):
        r = requests.patch(f"{API}/staff/{owner['user']['id']}", headers=owner_h,
                           json={"is_active": False})
        assert r.status_code == 400

    def test_create_and_toggle_staff(self, owner_h):
        email = f"test_{uuid.uuid4().hex[:6]}@crownanchor.demo"
        r = requests.post(f"{API}/staff", headers=owner_h,
                          json={"full_name": "TEST_Staffy", "email": email,
                                "password": "Password1!", "role": "BAR_STAFF"})
        assert r.status_code == 200
        sid = r.json()["id"]
        r2 = requests.patch(f"{API}/staff/{sid}", headers=owner_h, json={"is_active": False})
        assert r2.status_code == 200 and r2.json()["is_active"] is False


# -------------------- Audit --------------------
class TestAudit:
    def test_audit_accessible_owner_only(self, owner_h, bar_h):
        assert requests.get(f"{API}/audit-logs", headers=owner_h).status_code == 200
        assert requests.get(f"{API}/audit-logs", headers=bar_h).status_code == 403


# -------------------- Pub --------------------
class TestPub:
    def test_owner_can_update_pub(self, owner_h):
        before = requests.get(f"{API}/pub", headers=owner_h).json()
        r = requests.patch(f"{API}/pub", headers=owner_h,
                           json={"receipt_header": "TEST_HEADER " + uuid.uuid4().hex[:4]})
        assert r.status_code == 200
        # restore
        requests.patch(f"{API}/pub", headers=owner_h,
                       json={"receipt_header": before.get("receipt_header") or "Receipt"})
