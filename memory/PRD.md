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

## Next Tasks
- Add QR action-token generation/resolve endpoints when a customer app is introduced.
- Multi-pub tenant switcher once a second pub onboards.
