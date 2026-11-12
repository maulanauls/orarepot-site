# Public routes (via orarepot-gateway :8080)

JWT (`Authorization: Bearer`) required unless noted.

## biller-identity — Rust `orarepot-biller-identity` :8104
- `POST /biller/auth/register` public. Writes `TKN_group_wp.mt_users`.
- `POST /biller/auth/login` public (email or WhatsApp + password).
- `GET  /biller/auth/me`
- `POST /biller/auth/logout`

Login and register return a JWT (`kind=biller`, `jti`). The gateway checks the signature, then checks Redis key `biller:session:{jti}` before forwarding.

## biller — Rust `orarepot-biller` :8105
- `GET /biller/catalog` public. Categories and provider brands from `mt_lookup` / `mt_corporate_business_module`.
- `GET /biller/catalog/products?module=&brand=&type=` public. Selling price uses the same margin rule as the WhatsApp bot.
- `POST /biller/orders` body `{ lookup_idf, target }`. Checks stock, operator prefix and target format, recomputes the price, then writes `mt_billing` (INQUIRY) and `mt_transaction_session` with the Digiflazz signature. Returns the `MKINV-…` code and payment options.
- `GET  /biller/orders` last 20 orders of the user (WhatsApp orders included).
- `GET  /biller/orders/{code}` order state: `unpaid`, `waiting` (QR), `processing`, `success`, `failed`, `expired`. While waiting it checks Midtrans status.
- `POST /biller/orders/{code}/pay` body `{ method: "MENUKU_KOIN" | "QRIS" }`. Full koin goes to the n8n paid webhook. Koin short of the price debits the balance and charges QRIS for the rest. Held koin is returned when the QR expires.
- `GET  /biller/wallet` koin balance.

Env: `JWT_SECRET`, `MIDTRANS_URL`, `MIDTRANS_SERVER_KEY`, `DIGIFLAZZ_USERNAME`, `DIGIFLAZZ_KEY`, `PAID_CALLBACK_URL` (n8n `MIDTRANS CALLBACK PAYMENT` webhook).

## identity — Rust :8101
- `POST /auth/register` public
- `POST /auth/login` public (email **or** WhatsApp number + password)
- `POST /auth/google` public — body `{ "code" }` from the Google popup. Verifies the code, then logs in or creates the user.
- `POST /auth/forgot-password` public (WhatsApp OTP, max 2 / user / day)
- `POST /auth/reset-password` public
- `POST /auth/logout`
- `GET  /auth/me`
- `PATCH /auth/me`

## members — Node :8201
- `GET  /members/me` (current user's memberships)
- `GET  /members?merchantId=`
- `POST /members/invites`  sends Mailjet email with accept + decline links (row stays `invited` until accepted)
- `POST /members/invites/:id/accept` JWT
- `POST /members/invites/:id/decline` public (token body) — marks invite revoked + member removed
- `PATCH /members/:id`
- `DELETE /members/:id` remove from team (not owner)
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
- `POST /billing/topups`  creates **pending** Midtrans payment (no wallet credit). `method: "qris"` returns `qr_string`. `method: "va"` with `bank` returns `va_number` (Mandiri also returns `biller_code`). Neither opens Snap.
- `GET  /billing/payments/:orderId`
- `POST /billing/payments/midtrans`  public Midtrans HTTP notification (Snap `X-Override-Notification`). Credits the wallet on `settlement`/`capture` after signature check. `GET /billing/payments/:orderId` and `GET /billing/invoices/:merchantId` also pull Midtrans status for rows still `pending`. (signature SHA512, credits wallet on settlement/capture)
- `GET  /billing/payments/:orderId` and `GET /billing/invoices/:merchantId` also pull Midtrans status for pending orders
- `POST /internal/reserve`  (service key, not on gateway)
- `POST /internal/capture`
- `POST /internal/release`
- `POST /internal/credit`  (service key; seed/admin credit)

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
- `GET  /developer/request-logs?merchantId=`
- `GET  /developer/webhook-deliveries?merchantId=`
- `GET  /developer/ip-allowlist?merchantId=`
- `PUT  /developer/ip-allowlist` body `{ merchantId, ips: string[] }` — empty list = allow all IPs
- `POST /v1/otp/send`  public API key `orp_live_…` body `{ to, template, code? }` — checks IP allowlist + subscription + OTP quota, then sends
- `POST /v1/otp/sends`  same handler

## reporting — Node :8205
- `GET  /reports/otp?merchantId=`
- `GET  /reports/wallet?merchantId=`
