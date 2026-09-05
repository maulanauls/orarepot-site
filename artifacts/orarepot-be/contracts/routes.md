# Public routes (via orarepot-gateway :8080)

JWT (`Authorization: Bearer`) required unless noted.

## identity — Rust :8101
- `POST /auth/register` public
- `POST /auth/login` public
- `POST /auth/logout`
- `GET  /auth/me`
- `PATCH /auth/me`

## members — Node :8201
- `GET  /members/me` (current user's memberships)
- `GET  /members?merchantId=`
- `POST /members/invites`
- `POST /members/invites/:id/accept`
- `PATCH /members/:id`
- `GET  /teams?merchantId=`
- `POST /teams`

## merchant — Node :8202
- `GET  /merchant/:id`
- `POST /merchant`
- `PATCH /merchant/:id`
- `GET  /merchant/:id/waba`
- `POST /merchant/:id/waba`

## billing — Rust :8102
- `GET  /billing/wallets/:merchantId`
- `GET  /billing/invoices/:merchantId`
- `POST /billing/wallets`
- `POST /billing/topups`
- `POST /internal/reserve`  (service key, not on gateway)
- `POST /internal/capture`
- `POST /internal/release`

## templates — Node :8203
- `GET  /templates?merchantId=`
- `POST /templates`
- `PATCH /templates/:id`
- `GET  /internal/templates/:id` (service key)

## otp — Rust :8103
- `POST /otp/sends`
- `GET  /otp/sends?merchantId=`

## developer — Node :8204
- `GET  /developer/keys?merchantId=`
- `POST /developer/keys`
- `DELETE /developer/keys/:id`
- `GET  /developer/webhooks?merchantId=`
- `PUT  /developer/webhooks`
- `POST /v1/otp/sends`  public API key `orp_live_…`

## reporting — Node :8205
- `GET  /reports/otp?merchantId=`
- `GET  /reports/wallet?merchantId=`
