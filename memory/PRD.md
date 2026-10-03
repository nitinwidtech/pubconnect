# PubConnect — Product Requirements Document

## Original Problem Statement
PubConnect Phase 1 (Hardened Approval Plan): a web-based, multi-tenant (pub_id) admin dashboard for pub staff to manage customer wallet deposits, promotional bonus value, redemptions, refunds, reversals, manual adjustments and audit history. Accounting-safe wallet core with an append-only ledger (no direct edit/delete of wallet-affecting transactions). Money stored as integer pence (GBP). Backend-enforced role permissions. Built as a SaaS foundation for one pilot pub.

## Architecture
- Frontend: React (JSX) + Tailwind + shadcn/ui, dark mahogany/brass theme. Routes via react-router.
- Backend: FastAPI (/app/backend/server.py), all routes under /api.
- DB: MongoDB (motor). Collections: pubs, admin_users, customers, wallets, offers, ledger_transactions, offer_usages, audit_logs.
- Auth: JWT (Bearer token in localStorage key `pc_token`), bcrypt password hashing.
- Money: integer pence everywhere; derived balance = sum of ledger balance_effect_minor.

## User Personas & Roles
- OWNER: full access incl. pub config (manage_pub).
- MANAGER: operational + staff/offers + refund/reversal/manual adjustment; cannot edit pub ownership/config.
- BAR_STAFF: search/create customers, deposit, redeem, view transactions; cannot manage offers/staff, view audit logs, or do refund/reversal/manual adjustment.

## Core Requirements (static)
- Append-only ledger; corrections only via linked entries (refund/reversal/adjustment).
- Never allow negative balance; refund cap vs original purchase; mandatory reasons for refund/reversal/adjustment.
- Offer rules: single valid offer per deposit, date window + usage caps enforced server-side.
- Tenant isolation via pub_id on every query/write.
- Audit logging on sensitive actions, incl. ACCESS_DENIED for blocked restricted actions.

## Implemented (2026-06)
- JWT auth + role permission matrix (backend-enforced via require()).
- Dashboard KPIs + recent transactions.
- Customers: list/search, create (unique mobile/pub), profile with balance breakdown + full history.
- Fast Service workflow: lookup → balance preview → deposit/redeem → offer apply → double-confirm → success.
- Ledger engine: deposit (+bonus via offer), redeem, refund, reversal, manual adjustment.
- Offers: create/edit/toggle (no hard delete), usage + date limits.
- Transactions: list + type filter + detail drawer with linked original/refund/reversal; refund & reversal actions.
- Staff management: create/role change/activate-deactivate with ownership guards.
- Audit logs viewer. Pub setup (owner).
- Seeded demo pub (The Crown & Anchor), 3 staff, 2 offers, 4 customers with ledger history.
- Verified: 36/36 backend tests pass; frontend flows exercised.

## Backlog / Remaining (future phases, intentionally out of Phase 1 scope)
- P1: customer_action_tokens (short-lived QR/redeem tokens) — model designed, not built.
- P1: daily deposit vs redemption chart on dashboard.
- P2: date-range transaction filters UI, CSV export.
- P2 (explicitly deferred per plan): mobile/customer app, SMS/push, gift vouchers, payment gateway/POS, advanced analytics, deployment.

## Phase 2.0 — Customer Backend API (2026-06, backend only; Expo app deferred & awaiting approval)
- New `/api/customer` router (register, login, me, profile, home, wallet, transactions, transactions/{id}, offers, action-tokens, notification-preferences).
- Customer JWT `aud="customer"`, admin JWT `aud="admin"`; cross-audience use rejected (401) both ways.
- Login via email OR mobile + password (bcrypt); generic errors (no account enumeration); in-memory rate limiting on login/register.
- Self-scoped by customer_id + pub_id; IDOR-safe (foreign txn ids -> 404); cross-pub isolated; single pilot pub resolved via owner's pub.
- Customer PAY QR token: opaque, 5-min, single-use, SHA-256 hash stored, generated_by="customer"; resolved by existing admin Fast Service. No PII in token.
- DB: customers extended with nullable auth fields (password_hash, auth_identifier, is_registered, registered_at, notification_preferences, last_login_at); partial-unique indexes on (pub_id,email) and (pub_id,mobile_number); customer_action_tokens gains action_type PAY + generated_by. No second wallet; ledger logic reused unchanged.
- Verified: 31/31 Phase 2 tests + 36/36 Phase 1 regression pass. Fixed mobile_number null-collision index bug.
- NOT built (deferred): Expo mobile UI, SMS, push delivery, gift vouchers, payments, POS, staff mobile app, multi-pub membership.

## Next Tasks
- On approval: build the Expo (React Native + TS) customer app against this API.
- Production hardening: persistent/distributed rate limiting, OTP phone verification before claiming walk-in records, split server.py into modules.
- Multi-pub membership model when a second pub onboards.

## Phase 2 — Customer Mobile App (Expo + React Native + TypeScript) (2026-06)
- Location: `/app/mobile` (separate project; admin web app untouched). Expo SDK 57 / RN 0.86.
- Screens: Login, Register, Home, Wallet, Transactions, Transaction Detail/Confirmation, Pay at Pub (QR), Offers, Profile, Notification Preferences.
- Thin client: no wallet math/financial logic on device; backend is the single source of truth. Connects only to `/api/customer/*`.
- Auth: JWT aud="customer" in expo-secure-store; attached as Bearer; admin endpoints inaccessible.
- Pay at Pub: generates existing opaque single-use ~5-min PAY token; QR holds only the token (no PII); visible countdown; expired handling; resolved by existing admin Fast Service.
- Validation: TypeScript 0 errors; full metro bundle success (`expo export`, 1243 modules). Device interaction requires Expo Go (web-only testing agent cannot drive native RN). Backend APIs already covered by Phase 2.0 tests (31/31 + 36/36 regression).
- Env limitation: Hermes bytecode step can't run in sandbox (hermesc binary); JS bundle builds fine; Hermes works on-device/app-store builds.
- NOT built (scope): OTP/SMS, push delivery, gift vouchers, staff app, POS/payments, multi-pub membership, real events, loyalty, analytics.

## Phase 2 — Used-Code Feedback + Device Smoke Test (2026-06)
- NEW backend endpoint POST /api/customer/action-tokens/status {token}: self-scoped by customer_id + pub_id (IDOR-safe), returns status active/used/expired + used_at. Reuses hash_token(); no new financial logic.
- PayScreen now polls status every 3s while the QR is active; on 'used' it shows a clear "Code used" success state plus the server-authoritative updated balance (GET /customer/wallet) and the resulting transaction (GET /customer/transactions). No client-side math.
- Device Smoke Test: real Expo Go on-device run must be performed by the user (no physical device / native driver in-environment). Full Pay flow validated at the API level (exactly the calls the app makes): login -> wallet -> generate PAY token (active) -> admin Fast Service resolve -> status flips to used -> balance reduced server-side -> reuse blocked -> invalid=404 -> expired structurally verified -> JWT isolation -> admin unaffected.
- Verified: 77/77 backend tests pass (10 new + 67 regression); TypeScript 0 errors; full metro bundle success.
