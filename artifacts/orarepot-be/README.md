# Ora Repot backend

How to run **seluruh FE + BE** (perintah, port, dua mode):

- HTML: buka [`../orarepot-how-to.html`](../orarepot-how-to.html) atau [http://localhost:5173/how-to.html](http://localhost:5173/how-to.html) kalau landing sudah `npm run dev`
- Canvas Cursor: `orarepot-runbook.canvas.tsx` di panel canvas

One Java 25 Spring Cloud Gateway in front of Rust and Node services. Each domain service owns one Postgres database from `db/*.sql`. No cross-database foreign keys.

## Stack

| Piece | Runtime | Port |
|---|---|---|
| `orarepot-gateway` | Java 25 · Spring Cloud Gateway 2025.1 (Oakwood) | 8080 |
| `orarepot-identity` | Rust · Axum | 8101 |
| `orarepot-billing` | Rust · Axum | 8102 |
| `orarepot-otp` | Rust · Axum | 8103 |
| `orarepot-members` | Node · NestJS | 8201 |
| `orarepot-merchant` | Node · NestJS | 8202 |
| `orarepot-templates` | Node · NestJS | 8203 |
| `orarepot-developer` | Node · NestJS | 8204 |
| `orarepot-reporting` | Node · NestJS | 8205 |
| outbox relay | Node | — |
| Postgres 16 | remote `84.247.149.27:5433` | 8 DBs |
| Redis 7 | remote `84.247.149.27:6379` | password in `.env` |
| Kafka 3.9 | remote `84.247.149.27:9094` SASL | outbox topics |
| ClickHouse 24.8 | remote `84.247.149.27:8123` HTTP / `:9000` native | analytics |

## Run

Local services talk to **Postgres, Redis, Kafka, and ClickHouse on `84.247.149.27`** (see `.env`). Kafka uses SASL; ClickHouse uses username/password. A public domain is not required.

```bash
cd orarepot-site/artifacts/orarepot-be
docker compose up --build -d
make seed
```

Optional local Postgres/Redis/Kafka instead of the VPS:

```bash
docker compose --profile local-infra --profile local-kafka up -d
```

Set `KAFKA_BROKERS=localhost:9092` and leave `KAFKA_USERNAME` empty for that profile.

Gateway: http://localhost:8080

Seed account: `hello@orarepot.com` / `orarepot1`

## OTP send saga

`POST /otp/sends` → templates `GetTemplate ACTIVE` → billing `ReserveDebit` → WhatsApp Cloud API (`META_PHONE_NUMBER_ID=1241209412413230`, template `otp_merchant_id`/`id` or `otp_merchant`/`en`) → `Capture` or `Release` → Kafka `otp.sent` / `otp.failed`.

Set `META_WA_TOKEN` in `.env`. `WHATSAPP_STUB=true` skips Graph and returns a fake `wamid`. Without a token and with stub off, send fails instead of pretending success.

White-label merchants call `POST /v1/otp/sends` with `Authorization: Bearer orp_live_…`. That stays on `orarepot-developer`; it never talks to billing or templates directly.

## Layout

```
gateway/     Spring Cloud Gateway
rust/        workspace: common, identity, billing, otp
node/        NestJS: members, merchant, templates, developer, reporting, relay
db/          one SQL file per database
contracts/   routes + Kafka topics
```
