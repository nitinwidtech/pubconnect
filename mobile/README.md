# PubConnect — Customer Mobile App (Expo + React Native + TypeScript)

Phase 2 customer app. Thin client over the existing FastAPI backend — **no wallet math or financial logic runs on the device**; all balances/transactions come from the backend (the single source of truth).

## Run (device testing via Expo Go)
```bash
cd /app/mobile
yarn start           # or: npx expo start
# Scan the QR with Expo Go (iOS/Android). Native features (QR render, secure store) work on device.
```
Backend URL is read from `/app/mobile/.env` → `EXPO_PUBLIC_BACKEND_URL`.

## Seeded demo customer
- Login identifier: `james.demo@crownanchor.demo` OR `07700900001`
- Password: `Customer2026!`

## Screens
Login, Register, Home, Wallet, Transactions, Transaction Detail/Confirmation, Pay at Pub (QR), Offers, Profile, Notification Preferences.

## Auth
- JWT with `aud="customer"` stored in `expo-secure-store` (key `pc_customer_token`), attached as `Authorization: Bearer`.
- Customer tokens are rejected by admin endpoints (and vice-versa) by the backend.

## Pay at Pub
- Calls `POST /api/customer/action-tokens {action_type:"PAY"}` → short-lived (~5 min), single-use, opaque token.
- QR encodes only the opaque token (no name/phone/balance/PII). Visible countdown + progress bar; clear expired state with regenerate.
- Resolved by the existing **admin Fast Service** screen (unchanged).

## Notes / limitations
- Hermes bytecode cannot be generated in the cloud sandbox (`hermesc` binary), but the JS bundle builds fully (verified via `expo export`); Expo Go and real app-store builds use Hermes normally on device.
- "Used" QR state is not surfaced in the app (no customer endpoint to poll); expiry is shown via countdown. Resolution/consumption happens on the staff side.
- Not built (per scope): OTP/SMS, push delivery, gift vouchers, staff app, POS/payments, multi-pub membership, real events, loyalty, analytics.
