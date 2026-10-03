"""Idempotent demo seed for one pilot pub (The Crown & Anchor)."""
import os
import uuid
import bcrypt
from datetime import datetime, timezone, timedelta


def _now():
    return datetime.now(timezone.utc).isoformat()


def _hash(pw):
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _ref(prefix="TXN"):
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


async def seed_demo(db):
    owner_email = os.environ.get("ADMIN_EMAIL", "nitinwidtech@gmail.com").lower()
    owner_password = os.environ.get("ADMIN_PASSWORD", "PubConnect2026!")

    pub = await db.pubs.find_one({"name": "The Crown & Anchor"})
    if not pub:
        pres = await db.pubs.insert_one({
            "name": "The Crown & Anchor",
            "address": "14 Fleet Street, London EC4Y 1AA",
            "receipt_header": "The Crown & Anchor — Est. 1847",
            "currency": "GBP",
            "status": "active",
            "created_at": _now(),
            "updated_at": _now(),
        })
        pub_id = str(pres.inserted_id)
    else:
        pub_id = str(pub["_id"])

    # --- staff ---
    staff_defs = [
        (owner_email, owner_password, "Nitin (Owner)", "OWNER"),
        ("manager@crownanchor.demo", "Manager2026!", "Priya Sharma", "MANAGER"),
        ("barstaff@crownanchor.demo", "BarStaff2026!", "Tom Walker", "BAR_STAFF"),
    ]
    owner_id = None
    barstaff_id = None
    for email, pw, name, role in staff_defs:
        existing = await db.admin_users.find_one({"email": email})
        if existing:
            if not bcrypt.checkpw(pw.encode(), existing["password_hash"].encode()):
                await db.admin_users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": _hash(pw)}})
            uid = str(existing["_id"])
        else:
            r = await db.admin_users.insert_one({
                "pub_id": pub_id, "full_name": name, "email": email,
                "password_hash": _hash(pw), "role": role, "is_active": True,
                "last_login_at": None, "created_at": _now(), "updated_at": _now(),
            })
            uid = str(r.inserted_id)
        if role == "OWNER":
            owner_id = uid
        if role == "BAR_STAFF":
            barstaff_id = uid

    # Only seed data once (if no customers yet)
    if await db.customers.count_documents({"pub_id": pub_id}) > 0:
        return

    # --- offers ---
    now = datetime.now(timezone.utc)
    offers = [
        {"name": "Deposit £50 Get £5 Free", "description": "Top up £50, receive £5 bonus credit.",
         "deposit_amount": 5000, "bonus_value": 500, "max_uses_per_customer": 3, "max_total_redemptions": 500},
        {"name": "Deposit £100 Get £15 Free", "description": "Top up £100, receive £15 bonus credit.",
         "deposit_amount": 10000, "bonus_value": 1500, "max_uses_per_customer": 2, "max_total_redemptions": 200},
    ]
    offer_ids = {}
    for o in offers:
        r = await db.offers.insert_one({
            "pub_id": pub_id, **o,
            "wallet_value": o["deposit_amount"] + o["bonus_value"],
            "start_date": (now - timedelta(days=5)).isoformat(),
            "end_date": (now + timedelta(days=60)).isoformat(),
            "times_redeemed": 0, "is_active": True,
            "created_by": owner_id, "updated_by": owner_id,
            "created_at": _now(), "updated_at": _now(),
        })
        offer_ids[o["deposit_amount"]] = str(r.inserted_id)

    # --- customers + wallets + ledger ---
    customers = [
        ("James Fletcher", "07700900001", 5000, 500),
        ("Olivia Bennett", "07700900002", 10000, 1500),
        ("Harry Collins", "07700900003", 2000, 0),
        ("Sophie Turner", "07700900004", 0, 0),
    ]
    for name, mobile, deposit, bonus in customers:
        cres = await db.customers.insert_one({
            "pub_id": pub_id, "customer_code": f"C{uuid.uuid4().hex[:6].upper()}",
            "full_name": name, "mobile_number": mobile, "email": None,
            "date_of_birth": None, "marketing_consent": True, "status": "active",
            "created_at": _now(), "updated_at": _now(),
        })
        cid = str(cres.inserted_id)
        wres = await db.wallets.insert_one({
            "pub_id": pub_id, "customer_id": cid, "currency": "GBP",
            "status": "active", "created_at": _now(), "updated_at": _now(),
        })
        wid = str(wres.inserted_id)

        async def tx(ttype, amount, effect, offer_id=None, related=None, reason=None):
            r = await db.ledger_transactions.insert_one({
                "pub_id": pub_id, "wallet_id": wid, "customer_id": cid,
                "transaction_type": ttype, "amount_minor": amount, "currency": "GBP",
                "balance_effect_minor": effect, "performed_by_user_id": barstaff_id,
                "offer_id": offer_id, "related_transaction_id": related, "reason": reason,
                "reference_code": _ref(), "metadata": {}, "created_at": _now(),
            })
            return str(r.inserted_id)

        if deposit > 0:
            off_id = offer_ids.get(deposit) if bonus > 0 else None
            dep_id = await tx("CASH_DEPOSIT", deposit, deposit, offer_id=off_id)
            if bonus > 0:
                await tx("PROMOTIONAL_BONUS", bonus, bonus, offer_id=off_id, related=dep_id)
                await db.offers.update_one({"_id": __import__("bson").ObjectId(off_id)}, {"$inc": {"times_redeemed": 1}})
                await db.offer_usages.insert_one({
                    "pub_id": pub_id, "offer_id": off_id, "customer_id": cid,
                    "cash_deposit_transaction_id": dep_id, "bonus_transaction_id": None,
                    "used_at": _now(),
                })
            # a sample purchase
            await tx("PURCHASE", 1500, -1500, reason="Round of drinks")

    # seed audit entry
    await db.audit_logs.insert_one({
        "pub_id": pub_id, "actor_user_id": owner_id, "entity_type": "system",
        "entity_id": None, "action_type": "SEED",
        "description": "Demo data seeded for The Crown & Anchor",
        "before_state": None, "after_state": None, "created_at": _now(),
    })
