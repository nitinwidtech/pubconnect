# PubConnect Auth Testing

Auth uses JWT Bearer tokens (returned by login, sent as `Authorization: Bearer <token>`).

## Accounts (seeded)
- OWNER: nitinwidtech@gmail.com / PubConnect2026!
- MANAGER: manager@crownanchor.demo / Manager2026!
- BAR_STAFF: barstaff@crownanchor.demo / BarStaff2026!

## API Test
```
curl -X POST http://localhost:8001/api/auth/login -H "Content-Type: application/json" \
  -d '{"email":"nitinwidtech@gmail.com","password":"PubConnect2026!"}'
# -> { token, user, pub, permissions }

TOKEN=<token from above>
curl http://localhost:8001/api/auth/me -H "Authorization: Bearer $TOKEN"
curl http://localhost:8001/api/dashboard -H "Authorization: Bearer $TOKEN"
```

## Permission checks
- BAR_STAFF must get 403 on: /api/offers (POST), /api/staff, /api/audit-logs, /api/ledger/refund, /api/ledger/reversal, /api/ledger/adjustment, /api/pub (PATCH)
- MANAGER allowed on refund/reversal/adjustment/staff/offers but 403 on /api/pub (PATCH)
- OWNER allowed everything
