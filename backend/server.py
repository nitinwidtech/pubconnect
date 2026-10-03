from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import logging
import bcrypt
import jwt
import uuid
import hashlib
import secrets
import csv
import io

# ---------------------------------------------------------------------------
# DB & app setup
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="PubConnect API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("pubconnect")

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

# ---------------------------------------------------------------------------
# Roles & permissions (backend-enforced)
# ---------------------------------------------------------------------------
ROLE_PERMISSIONS = {
    "OWNER": {
        "dashboard", "customer_view", "customer_create", "deposit", "redeem",
        "refund", "reversal", "manual_adjustment", "manage_staff",
        "manage_offers", "view_audit", "view_transactions", "manage_pub",
    },
    "MANAGER": {
        "dashboard", "customer_view", "customer_create", "deposit", "redeem",
        "refund", "reversal", "manual_adjustment", "manage_staff",
        "manage_offers", "view_audit", "view_transactions",
    },
    "BAR_STAFF": {
        "dashboard", "customer_view", "customer_create", "deposit", "redeem",
        "view_transactions",
    },
}


def has_perm(role: str, action: str) -> bool:
    return action in ROLE_PERMISSIONS.get(role, set())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def oid(v: str) -> ObjectId:
    try:
        return ObjectId(v)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid id")


def ser(doc: dict) -> dict:
    """Serialize a mongo doc: _id -> id (str), strip password_hash, stringify ObjectIds."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            out["id"] = str(v)
        elif k == "password_hash":
            continue
        elif isinstance(v, ObjectId):
            out[k] = str(v)
        else:
            out[k] = v
    return out


def ref_code(prefix: str = "TXN") -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


# Short-lived action token lifetime (minutes)
ACTION_TOKEN_TTL_MINUTES = 5


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------
async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.admin_users.find_one({"_id": oid(payload["sub"])})
    if not user or not user.get("is_active", True):
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def require(action: str):
    async def _dep(user: dict = Depends(get_current_user)) -> dict:
        if not has_perm(user["role"], action):
            await db.audit_logs.insert_one({
                "pub_id": user["pub_id"],
                "actor_user_id": str(user["_id"]),
                "entity_type": "permission",
                "entity_id": None,
                "action_type": "ACCESS_DENIED",
                "description": f"{user['role']} attempted restricted action '{action}'",
                "before_state": None,
                "after_state": None,
                "created_at": now_utc(),
            })
            raise HTTPException(status_code=403, detail=f"Your role ({user['role']}) is not permitted to perform this action")
        return user
    return _dep


async def write_audit(user: dict, entity_type: str, entity_id, action_type: str,
                      description: str, before=None, after=None):
    await db.audit_logs.insert_one({
        "pub_id": user["pub_id"],
        "actor_user_id": str(user["_id"]),
        "entity_type": entity_type,
        "entity_id": str(entity_id) if entity_id else None,
        "action_type": action_type,
        "description": description,
        "before_state": before,
        "after_state": after,
        "created_at": now_utc(),
    })


async def wallet_balance(wallet_id: str) -> dict:
    """Derived balance from ledger. Returns real cash, promo, and total (pence)."""
    pipeline = [
        {"$match": {"wallet_id": wallet_id}},
        {"$group": {
            "_id": None,
            "total": {"$sum": "$balance_effect_minor"},
            "promo": {"$sum": {"$cond": [
                {"$eq": ["$transaction_type", "PROMOTIONAL_BONUS"]},
                "$balance_effect_minor", 0]}},
        }},
    ]
    res = await db.ledger_transactions.aggregate(pipeline).to_list(1)
    if not res:
        return {"total_minor": 0, "promo_minor": 0, "cash_minor": 0}
    total = res[0]["total"]
    promo = res[0]["promo"]
    return {"total_minor": total, "promo_minor": promo, "cash_minor": total - promo}


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CustomerIn(BaseModel):
    full_name: str
    mobile_number: str
    email: Optional[str] = None
    date_of_birth: Optional[str] = None
    marketing_consent: bool = False


class StaffIn(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: Literal["OWNER", "MANAGER", "BAR_STAFF"]


class StaffUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[Literal["OWNER", "MANAGER", "BAR_STAFF"]] = None
    is_active: Optional[bool] = None


class OfferIn(BaseModel):
    name: str
    description: Optional[str] = ""
    deposit_amount: int
    bonus_value: int
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_uses_per_customer: Optional[int] = None
    max_total_redemptions: Optional[int] = None
    is_active: bool = True


class DepositIn(BaseModel):
    customer_id: str
    amount_minor: int
    offer_id: Optional[str] = None


class RedeemIn(BaseModel):
    customer_id: str
    amount_minor: int
    note: Optional[str] = None


class RefundIn(BaseModel):
    original_transaction_id: str
    amount_minor: int
    reason: str


class ReversalIn(BaseModel):
    transaction_id: str
    reason: str


class AdjustmentIn(BaseModel):
    customer_id: str
    amount_minor: int  # signed
    reason: str


class PubUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    receipt_header: Optional[str] = None
    status: Optional[str] = None


class ActionTokenIn(BaseModel):
    customer_id: str
    action_type: Literal["REDEEM"] = "REDEEM"


class ActionTokenResolveIn(BaseModel):
    token: str


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower().strip()
    user = await db.admin_users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="Account is deactivated")
    await db.admin_users.update_one({"_id": user["_id"]}, {"$set": {"last_login_at": now_utc()}})
    token = create_token(str(user["_id"]))
    pub = await db.pubs.find_one({"_id": oid(user["pub_id"])})
    return {"token": token, "user": ser(user), "pub": ser(pub),
            "permissions": sorted(ROLE_PERMISSIONS.get(user["role"], set()))}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    pub = await db.pubs.find_one({"_id": oid(user["pub_id"])})
    return {"user": ser(user), "pub": ser(pub),
            "permissions": sorted(ROLE_PERMISSIONS.get(user["role"], set()))}


@api.post("/auth/logout")
async def logout(user: dict = Depends(get_current_user)):
    return {"ok": True}


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
@api.get("/dashboard")
async def dashboard(user: dict = Depends(require("dashboard"))):
    pub_id = user["pub_id"]
    total_customers = await db.customers.count_documents({"pub_id": pub_id})
    active_customers = await db.customers.count_documents({"pub_id": pub_id, "status": "active"})
    active_offers = await db.offers.count_documents({"pub_id": pub_id, "is_active": True})

    def sum_pipe(match):
        return [{"$match": {**match, "pub_id": pub_id}},
                {"$group": {"_id": None, "s": {"$sum": "$amount_minor"}}}]

    async def total(match):
        r = await db.ledger_transactions.aggregate(sum_pipe(match)).to_list(1)
        return r[0]["s"] if r else 0

    deposits = await total({"transaction_type": "CASH_DEPOSIT"})
    redemptions = await total({"transaction_type": "PURCHASE"})
    promo = await total({"transaction_type": "PROMOTIONAL_BONUS"})

    recent = await db.ledger_transactions.find({"pub_id": pub_id}).sort("created_at", -1).limit(8).to_list(8)
    recent_out = []
    for t in recent:
        cust = await db.customers.find_one({"_id": oid(t["customer_id"])})
        d = ser(t)
        d["customer_name"] = cust["full_name"] if cust else "—"
        recent_out.append(d)

    return {
        "total_customers": total_customers,
        "active_customers": active_customers,
        "active_offers": active_offers,
        "total_deposits_minor": deposits,
        "total_redemptions_minor": redemptions,
        "promo_issued_minor": promo,
        "recent_transactions": recent_out,
    }


# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
@api.get("/customers")
async def list_customers(user: dict = Depends(require("customer_view")),
                         search: Optional[str] = None):
    q = {"pub_id": user["pub_id"]}
    if search:
        q["$or"] = [
            {"full_name": {"$regex": search, "$options": "i"}},
            {"mobile_number": {"$regex": search, "$options": "i"}},
            {"customer_code": {"$regex": search, "$options": "i"}},
        ]
    customers = await db.customers.find(q).sort("created_at", -1).to_list(500)
    out = []
    for c in customers:
        wallet = await db.wallets.find_one({"customer_id": str(c["_id"])})
        bal = await wallet_balance(str(wallet["_id"])) if wallet else {"total_minor": 0, "promo_minor": 0, "cash_minor": 0}
        d = ser(c)
        d["wallet_id"] = str(wallet["_id"]) if wallet else None
        d["balance"] = bal
        out.append(d)
    return out


@api.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(require("customer_create"))):
    existing = await db.customers.find_one({"pub_id": user["pub_id"], "mobile_number": body.mobile_number})
    if existing:
        raise HTTPException(status_code=409, detail="A customer with this mobile number already exists in this pub")
    code = f"C{uuid.uuid4().hex[:6].upper()}"
    doc = {
        "pub_id": user["pub_id"],
        "customer_code": code,
        "full_name": body.full_name,
        "mobile_number": body.mobile_number,
        "email": body.email,
        "date_of_birth": body.date_of_birth,
        "marketing_consent": body.marketing_consent,
        "status": "active",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await db.customers.insert_one(doc)
    wallet = {
        "pub_id": user["pub_id"],
        "customer_id": str(res.inserted_id),
        "currency": "GBP",
        "status": "active",
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    wres = await db.wallets.insert_one(wallet)
    await write_audit(user, "customer", res.inserted_id, "CREATE", f"Created customer {body.full_name} ({code})")
    doc["_id"] = res.inserted_id
    out = ser(doc)
    out["wallet_id"] = str(wres.inserted_id)
    out["balance"] = {"total_minor": 0, "promo_minor": 0, "cash_minor": 0}
    return out


@api.get("/customers/{customer_id}")
async def get_customer(customer_id: str, user: dict = Depends(require("customer_view"))):
    c = await db.customers.find_one({"_id": oid(customer_id), "pub_id": user["pub_id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    wallet = await db.wallets.find_one({"customer_id": customer_id})
    bal = await wallet_balance(str(wallet["_id"])) if wallet else {"total_minor": 0, "promo_minor": 0, "cash_minor": 0}
    txns = await db.ledger_transactions.find({"customer_id": customer_id}).sort("created_at", -1).to_list(500)
    d = ser(c)
    d["wallet_id"] = str(wallet["_id"]) if wallet else None
    d["balance"] = bal
    d["transactions"] = [ser(t) for t in txns]
    return d


# ---------------------------------------------------------------------------
# Ledger engine
# ---------------------------------------------------------------------------
async def _wallet_for(customer_id: str, pub_id: str):
    c = await db.customers.find_one({"_id": oid(customer_id), "pub_id": pub_id})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    wallet = await db.wallets.find_one({"customer_id": customer_id})
    if not wallet:
        raise HTTPException(status_code=404, detail="Wallet not found")
    return c, wallet


async def _insert_txn(pub_id, wallet_id, customer_id, ttype, amount_minor,
                      balance_effect, performed_by, offer_id=None,
                      related=None, reason=None, metadata=None):
    doc = {
        "pub_id": pub_id,
        "wallet_id": wallet_id,
        "customer_id": customer_id,
        "transaction_type": ttype,
        "amount_minor": amount_minor,
        "currency": "GBP",
        "balance_effect_minor": balance_effect,
        "performed_by_user_id": performed_by,
        "offer_id": offer_id,
        "related_transaction_id": related,
        "reason": reason,
        "reference_code": ref_code(),
        "metadata": metadata or {},
        "created_at": now_utc(),
    }
    res = await db.ledger_transactions.insert_one(doc)
    doc["_id"] = res.inserted_id
    return doc


@api.post("/ledger/deposit")
async def deposit(body: DepositIn, user: dict = Depends(require("deposit"))):
    if body.amount_minor <= 0:
        raise HTTPException(status_code=400, detail="Deposit amount must be positive")
    c, wallet = await _wallet_for(body.customer_id, user["pub_id"])
    wid = str(wallet["_id"])

    applied_offer = None
    now_iso = now_utc()
    base_q = {"pub_id": user["pub_id"], "is_active": True, "deposit_amount": body.amount_minor}
    if body.offer_id:
        offer = await db.offers.find_one({"_id": oid(body.offer_id), "pub_id": user["pub_id"]})
        if not offer:
            raise HTTPException(status_code=404, detail="Offer not found")
        candidates = [offer]
    else:
        candidates = await db.offers.find(base_q).to_list(50)

    valid = []
    for o in candidates:
        if not o.get("is_active"):
            continue
        if o["deposit_amount"] != body.amount_minor:
            continue
        if o.get("start_date") and now_iso < o["start_date"]:
            continue
        if o.get("end_date") and now_iso > o["end_date"]:
            continue
        if o.get("max_total_redemptions") and o.get("times_redeemed", 0) >= o["max_total_redemptions"]:
            continue
        if o.get("max_uses_per_customer"):
            used = await db.offer_usages.count_documents(
                {"offer_id": str(o["_id"]), "customer_id": body.customer_id})
            if used >= o["max_uses_per_customer"]:
                continue
        valid.append(o)

    if body.offer_id:
        if not valid:
            raise HTTPException(status_code=400, detail="Selected offer is not valid for this deposit (expired, limit reached, or amount mismatch)")
        applied_offer = valid[0]
    else:
        if len(valid) > 1:
            raise HTTPException(status_code=400, detail="Multiple offers match this deposit. Please select one explicitly.")
        applied_offer = valid[0] if valid else None

    cash_txn = await _insert_txn(user["pub_id"], wid, body.customer_id, "CASH_DEPOSIT",
                                 body.amount_minor, body.amount_minor, str(user["_id"]),
                                 offer_id=str(applied_offer["_id"]) if applied_offer else None)

    bonus_txn = None
    if applied_offer and applied_offer.get("bonus_value", 0) > 0:
        bonus_txn = await _insert_txn(user["pub_id"], wid, body.customer_id, "PROMOTIONAL_BONUS",
                                      applied_offer["bonus_value"], applied_offer["bonus_value"],
                                      str(user["_id"]), offer_id=str(applied_offer["_id"]),
                                      related=str(cash_txn["_id"]))
        await db.offers.update_one({"_id": applied_offer["_id"]}, {"$inc": {"times_redeemed": 1}})
        await db.offer_usages.insert_one({
            "pub_id": user["pub_id"],
            "offer_id": str(applied_offer["_id"]),
            "customer_id": body.customer_id,
            "cash_deposit_transaction_id": str(cash_txn["_id"]),
            "bonus_transaction_id": str(bonus_txn["_id"]),
            "used_at": now_utc(),
        })

    await write_audit(user, "ledger", cash_txn["_id"], "CASH_DEPOSIT",
                      f"Deposit of {body.amount_minor}p for {c['full_name']}"
                      + (f" with offer '{applied_offer['name']}' (+{applied_offer['bonus_value']}p bonus)" if applied_offer else ""))

    bal = await wallet_balance(wid)
    return {"cash_transaction": ser(cash_txn),
            "bonus_transaction": ser(bonus_txn) if bonus_txn else None,
            "offer_applied": ser(applied_offer) if applied_offer else None,
            "balance": bal}


@api.post("/ledger/redeem")
async def redeem(body: RedeemIn, user: dict = Depends(require("redeem"))):
    if body.amount_minor <= 0:
        raise HTTPException(status_code=400, detail="Redemption amount must be positive")
    c, wallet = await _wallet_for(body.customer_id, user["pub_id"])
    wid = str(wallet["_id"])
    bal = await wallet_balance(wid)
    if body.amount_minor > bal["total_minor"]:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance for this redemption")
    txn = await _insert_txn(user["pub_id"], wid, body.customer_id, "PURCHASE",
                            body.amount_minor, -body.amount_minor, str(user["_id"]),
                            reason=body.note)
    await write_audit(user, "ledger", txn["_id"], "PURCHASE",
                      f"Redemption of {body.amount_minor}p for {c['full_name']}")
    return {"transaction": ser(txn), "balance": await wallet_balance(wid)}


@api.post("/ledger/refund")
async def refund(body: RefundIn, user: dict = Depends(require("refund"))):
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required for refunds")
    original = await db.ledger_transactions.find_one({"_id": oid(body.original_transaction_id), "pub_id": user["pub_id"]})
    if not original:
        raise HTTPException(status_code=404, detail="Original transaction not found")
    if original["transaction_type"] != "PURCHASE":
        raise HTTPException(status_code=400, detail="Refunds can only reference a PURCHASE transaction")
    prior = await db.ledger_transactions.aggregate([
        {"$match": {"related_transaction_id": body.original_transaction_id, "transaction_type": "REFUND"}},
        {"$group": {"_id": None, "s": {"$sum": "$amount_minor"}}},
    ]).to_list(1)
    refunded = prior[0]["s"] if prior else 0
    if body.amount_minor <= 0:
        raise HTTPException(status_code=400, detail="Refund amount must be positive")
    if refunded + body.amount_minor > original["amount_minor"]:
        remaining = original["amount_minor"] - refunded
        raise HTTPException(status_code=400, detail=f"Refund exceeds remaining refundable amount ({remaining}p)")
    txn = await _insert_txn(user["pub_id"], original["wallet_id"], original["customer_id"], "REFUND",
                            body.amount_minor, body.amount_minor, str(user["_id"]),
                            related=body.original_transaction_id, reason=body.reason)
    await write_audit(user, "ledger", txn["_id"], "REFUND",
                      f"Refund of {body.amount_minor}p against {original['reference_code']}. Reason: {body.reason}")
    return {"transaction": ser(txn), "balance": await wallet_balance(original["wallet_id"])}


@api.post("/ledger/reversal")
async def reversal(body: ReversalIn, user: dict = Depends(require("reversal"))):
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required for reversals")
    original = await db.ledger_transactions.find_one({"_id": oid(body.transaction_id), "pub_id": user["pub_id"]})
    if not original:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if original["transaction_type"] == "REVERSAL":
        raise HTTPException(status_code=400, detail="Cannot reverse a reversal")
    existing = await db.ledger_transactions.find_one({"related_transaction_id": body.transaction_id, "transaction_type": "REVERSAL"})
    if existing:
        raise HTTPException(status_code=400, detail="This transaction has already been reversed")
    txn = await _insert_txn(user["pub_id"], original["wallet_id"], original["customer_id"], "REVERSAL",
                            original["amount_minor"], -original["balance_effect_minor"], str(user["_id"]),
                            related=body.transaction_id, reason=body.reason)
    await write_audit(user, "ledger", txn["_id"], "REVERSAL",
                      f"Reversed {original['reference_code']} ({original['transaction_type']}). Reason: {body.reason}")
    return {"transaction": ser(txn), "balance": await wallet_balance(original["wallet_id"])}


@api.post("/ledger/adjustment")
async def adjustment(body: AdjustmentIn, user: dict = Depends(require("manual_adjustment"))):
    if not body.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is required for manual adjustments")
    if body.amount_minor == 0:
        raise HTTPException(status_code=400, detail="Adjustment amount cannot be zero")
    c, wallet = await _wallet_for(body.customer_id, user["pub_id"])
    wid = str(wallet["_id"])
    if body.amount_minor < 0:
        bal = await wallet_balance(wid)
        if bal["total_minor"] + body.amount_minor < 0:
            raise HTTPException(status_code=400, detail="Adjustment would make balance negative")
    txn = await _insert_txn(user["pub_id"], wid, body.customer_id, "MANUAL_ADJUSTMENT",
                            abs(body.amount_minor), body.amount_minor, str(user["_id"]),
                            reason=body.reason, metadata={"exceptional": True})
    await write_audit(user, "ledger", txn["_id"], "MANUAL_ADJUSTMENT",
                      f"Manual adjustment of {body.amount_minor}p for {c['full_name']}. Reason: {body.reason}")
    return {"transaction": ser(txn), "balance": await wallet_balance(wid)}


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
@api.get("/transactions")
async def list_transactions(user: dict = Depends(require("view_transactions")),
                            customer_id: Optional[str] = None,
                            type: Optional[str] = None,
                            start: Optional[str] = None,
                            end: Optional[str] = None):
    q = {"pub_id": user["pub_id"]}
    if customer_id:
        q["customer_id"] = customer_id
    if type:
        q["transaction_type"] = type
    if start:
        q.setdefault("created_at", {})["$gte"] = start
    if end:
        q.setdefault("created_at", {})["$lte"] = end
    txns = await db.ledger_transactions.find(q).sort("created_at", -1).to_list(1000)
    cust_cache = {}
    out = []
    for t in txns:
        cid = t["customer_id"]
        if cid not in cust_cache:
            cust_cache[cid] = await db.customers.find_one({"_id": oid(cid)})
        d = ser(t)
        d["customer_name"] = cust_cache[cid]["full_name"] if cust_cache[cid] else "—"
        out.append(d)
    return out


@api.get("/transactions/export")
async def export_transactions(user: dict = Depends(require("view_transactions")),
                              customer_id: Optional[str] = None,
                              type: Optional[str] = None,
                              start: Optional[str] = None,
                              end: Optional[str] = None):
    q = {"pub_id": user["pub_id"]}
    if customer_id:
        q["customer_id"] = customer_id
    if type:
        q["transaction_type"] = type
    if start:
        q.setdefault("created_at", {})["$gte"] = start
    if end:
        q.setdefault("created_at", {})["$lte"] = end
    txns = await db.ledger_transactions.find(q).sort("created_at", -1).to_list(5000)
    cust_cache, user_cache = {}, {}
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Reference", "Type", "Customer", "Amount_GBP", "Balance_Effect_GBP",
                "Reason", "Performed_By", "Date"])
    for t in txns:
        cid = t["customer_id"]
        if cid not in cust_cache:
            c = await db.customers.find_one({"_id": oid(cid)})
            cust_cache[cid] = c["full_name"] if c else "—"
        pid = t.get("performed_by_user_id")
        if pid and pid not in user_cache:
            p = await db.admin_users.find_one({"_id": oid(pid)})
            user_cache[pid] = p["full_name"] if p else "—"
        w.writerow([
            t.get("reference_code", ""),
            t.get("transaction_type", ""),
            cust_cache[cid],
            f"{t.get('amount_minor', 0) / 100:.2f}",
            f"{t.get('balance_effect_minor', 0) / 100:.2f}",
            t.get("reason") or "",
            user_cache.get(pid, "—"),
            t.get("created_at", ""),
        ])
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=pubconnect_transactions.csv"},
    )


@api.get("/transactions/{txn_id}")
async def get_transaction(txn_id: str, user: dict = Depends(require("view_transactions"))):
    t = await db.ledger_transactions.find_one({"_id": oid(txn_id), "pub_id": user["pub_id"]})
    if not t:
        raise HTTPException(status_code=404, detail="Transaction not found")
    d = ser(t)
    cust = await db.customers.find_one({"_id": oid(t["customer_id"])})
    d["customer_name"] = cust["full_name"] if cust else "—"
    performer = await db.admin_users.find_one({"_id": oid(t["performed_by_user_id"])})
    d["performed_by_name"] = performer["full_name"] if performer else "—"
    if t.get("related_transaction_id"):
        rel = await db.ledger_transactions.find_one({"_id": oid(t["related_transaction_id"])})
        d["related_transaction"] = ser(rel) if rel else None
    children = await db.ledger_transactions.find({"related_transaction_id": txn_id}).to_list(100)
    d["linked_transactions"] = [ser(c) for c in children]
    return d


# ---------------------------------------------------------------------------
# Customer action tokens (short-lived, single-use QR). No sensitive data in QR.
# ---------------------------------------------------------------------------
@api.post("/action-tokens")
async def create_action_token(body: ActionTokenIn, user: dict = Depends(require("redeem"))):
    c = await db.customers.find_one({"_id": oid(body.customer_id), "pub_id": user["pub_id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    raw = secrets.token_urlsafe(18)
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=ACTION_TOKEN_TTL_MINUTES)).isoformat()
    res = await db.customer_action_tokens.insert_one({
        "pub_id": user["pub_id"],
        "customer_id": body.customer_id,
        "token_hash": hash_token(raw),
        "action_type": body.action_type,
        "expires_at": expires_at,
        "used_at": None,
        "created_at": now_utc(),
    })
    await write_audit(user, "action_token", res.inserted_id, "CREATE",
                      f"Generated {body.action_type} action token for {c['full_name']}")
    # Only the opaque token is returned / encoded in the QR — no wallet or profile data.
    return {"id": str(res.inserted_id), "token": raw, "action_type": body.action_type,
            "expires_at": expires_at, "ttl_minutes": ACTION_TOKEN_TTL_MINUTES}


@api.post("/action-tokens/resolve")
async def resolve_action_token(body: ActionTokenResolveIn, user: dict = Depends(require("customer_view"))):
    th = hash_token(body.token.strip())
    # pub_id in the query enforces tenant isolation — tokens from other pubs never match.
    tok = await db.customer_action_tokens.find_one({"token_hash": th, "pub_id": user["pub_id"]})
    if not tok:
        raise HTTPException(status_code=404, detail="Invalid or unknown token")
    if tok.get("used_at"):
        raise HTTPException(status_code=400, detail="This token has already been used")
    if now_utc() > tok["expires_at"]:
        raise HTTPException(status_code=400, detail="This token has expired")
    await db.customer_action_tokens.update_one({"_id": tok["_id"]}, {"$set": {"used_at": now_utc()}})
    c = await db.customers.find_one({"_id": oid(tok["customer_id"]), "pub_id": user["pub_id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Customer not found")
    await write_audit(user, "action_token", tok["_id"], "RESOLVE",
                      f"Resolved {tok['action_type']} token for {c['full_name']}")
    return {"customer_id": str(c["_id"]), "full_name": c["full_name"],
            "customer_code": c["customer_code"], "action_type": tok["action_type"]}


# ---------------------------------------------------------------------------
# Staff
# ---------------------------------------------------------------------------
@api.get("/staff")
async def list_staff(user: dict = Depends(require("manage_staff"))):
    staff = await db.admin_users.find({"pub_id": user["pub_id"]}).sort("created_at", 1).to_list(200)
    out = []
    for s in staff:
        d = ser(s)
        d["action_count"] = await db.audit_logs.count_documents({"actor_user_id": str(s["_id"])})
        out.append(d)
    return out


@api.post("/staff")
async def create_staff(body: StaffIn, user: dict = Depends(require("manage_staff"))):
    if body.role == "OWNER" and user["role"] != "OWNER":
        raise HTTPException(status_code=403, detail="Only an Owner can create another Owner")
    email = body.email.lower().strip()
    if await db.admin_users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    doc = {
        "pub_id": user["pub_id"],
        "full_name": body.full_name,
        "email": email,
        "password_hash": hash_password(body.password),
        "role": body.role,
        "is_active": True,
        "last_login_at": None,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await db.admin_users.insert_one(doc)
    await write_audit(user, "staff", res.inserted_id, "CREATE", f"Created staff {body.full_name} as {body.role}")
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.patch("/staff/{staff_id}")
async def update_staff(staff_id: str, body: StaffUpdate, user: dict = Depends(require("manage_staff"))):
    target = await db.admin_users.find_one({"_id": oid(staff_id), "pub_id": user["pub_id"]})
    if not target:
        raise HTTPException(status_code=404, detail="Staff not found")
    if target["role"] == "OWNER" and user["role"] != "OWNER":
        raise HTTPException(status_code=403, detail="Only an Owner can modify an Owner")
    if body.role == "OWNER" and user["role"] != "OWNER":
        raise HTTPException(status_code=403, detail="Only an Owner can assign the Owner role")
    if str(target["_id"]) == str(user["_id"]) and body.is_active is False:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    before = {"role": target["role"], "is_active": target["is_active"], "full_name": target["full_name"]}
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")
    updates["updated_at"] = now_utc()
    await db.admin_users.update_one({"_id": target["_id"]}, {"$set": updates})
    after = {**before, **{k: v for k, v in updates.items() if k != "updated_at"}}
    await write_audit(user, "staff", staff_id, "UPDATE",
                      f"Updated staff {target['full_name']}", before=before, after=after)
    updated = await db.admin_users.find_one({"_id": target["_id"]})
    return ser(updated)


# ---------------------------------------------------------------------------
# Offers
# ---------------------------------------------------------------------------
@api.get("/offers")
async def list_offers(user: dict = Depends(get_current_user)):
    offers = await db.offers.find({"pub_id": user["pub_id"]}).sort("created_at", -1).to_list(200)
    return [ser(o) for o in offers]


@api.post("/offers")
async def create_offer(body: OfferIn, user: dict = Depends(require("manage_offers"))):
    doc = {
        "pub_id": user["pub_id"],
        "name": body.name,
        "description": body.description,
        "deposit_amount": body.deposit_amount,
        "wallet_value": body.deposit_amount + body.bonus_value,
        "bonus_value": body.bonus_value,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "max_uses_per_customer": body.max_uses_per_customer,
        "max_total_redemptions": body.max_total_redemptions,
        "times_redeemed": 0,
        "is_active": body.is_active,
        "created_by": str(user["_id"]),
        "updated_by": str(user["_id"]),
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    res = await db.offers.insert_one(doc)
    await write_audit(user, "offer", res.inserted_id, "CREATE", f"Created offer '{body.name}'", after=ser(doc))
    doc["_id"] = res.inserted_id
    return ser(doc)


@api.patch("/offers/{offer_id}")
async def update_offer(offer_id: str, body: OfferIn, user: dict = Depends(require("manage_offers"))):
    offer = await db.offers.find_one({"_id": oid(offer_id), "pub_id": user["pub_id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    before = ser(offer)
    updates = {
        "name": body.name,
        "description": body.description,
        "deposit_amount": body.deposit_amount,
        "wallet_value": body.deposit_amount + body.bonus_value,
        "bonus_value": body.bonus_value,
        "start_date": body.start_date,
        "end_date": body.end_date,
        "max_uses_per_customer": body.max_uses_per_customer,
        "max_total_redemptions": body.max_total_redemptions,
        "is_active": body.is_active,
        "updated_by": str(user["_id"]),
        "updated_at": now_utc(),
    }
    await db.offers.update_one({"_id": offer["_id"]}, {"$set": updates})
    await write_audit(user, "offer", offer_id, "UPDATE", f"Updated offer '{body.name}'", before=before, after=updates)
    updated = await db.offers.find_one({"_id": offer["_id"]})
    return ser(updated)


@api.patch("/offers/{offer_id}/toggle")
async def toggle_offer(offer_id: str, user: dict = Depends(require("manage_offers"))):
    offer = await db.offers.find_one({"_id": oid(offer_id), "pub_id": user["pub_id"]})
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    new_state = not offer.get("is_active", True)
    await db.offers.update_one({"_id": offer["_id"]}, {"$set": {"is_active": new_state, "updated_at": now_utc()}})
    await write_audit(user, "offer", offer_id, "TOGGLE",
                      f"Offer '{offer['name']}' set to {'active' if new_state else 'inactive'}")
    updated = await db.offers.find_one({"_id": offer["_id"]})
    return ser(updated)


# ---------------------------------------------------------------------------
# Audit logs
# ---------------------------------------------------------------------------
@api.get("/audit-logs")
async def audit_logs(user: dict = Depends(require("view_audit"))):
    logs = await db.audit_logs.find({"pub_id": user["pub_id"]}).sort("created_at", -1).limit(500).to_list(500)
    actor_cache = {}
    out = []
    for l in logs:
        aid = l.get("actor_user_id")
        if aid and aid not in actor_cache:
            actor = await db.admin_users.find_one({"_id": oid(aid)})
            actor_cache[aid] = actor["full_name"] if actor else "—"
        d = ser(l)
        d["actor_name"] = actor_cache.get(aid, "System")
        out.append(d)
    return out


# ---------------------------------------------------------------------------
# Pub setup
# ---------------------------------------------------------------------------
@api.get("/pub")
async def get_pub(user: dict = Depends(get_current_user)):
    pub = await db.pubs.find_one({"_id": oid(user["pub_id"])})
    return ser(pub)


@api.patch("/pub")
async def update_pub(body: PubUpdate, user: dict = Depends(require("manage_pub"))):
    pub = await db.pubs.find_one({"_id": oid(user["pub_id"])})
    before = ser(pub)
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No changes provided")
    updates["updated_at"] = now_utc()
    await db.pubs.update_one({"_id": pub["_id"]}, {"$set": updates})
    await write_audit(user, "pub", pub["_id"], "UPDATE", "Updated pub configuration", before=before, after=updates)
    updated = await db.pubs.find_one({"_id": pub["_id"]})
    return ser(updated)


# ---------------------------------------------------------------------------
# App wiring
# ---------------------------------------------------------------------------
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    await db.admin_users.create_index("email", unique=True)
    await db.customers.create_index([("pub_id", 1), ("mobile_number", 1)], unique=True)
    await db.ledger_transactions.create_index([("pub_id", 1), ("wallet_id", 1)])
    from seed import seed_demo
    await seed_demo(db)


@app.on_event("shutdown")
async def shutdown():
    client.close()
