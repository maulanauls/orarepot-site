-- Database: orarepot_warehouse
-- Service: orarepot-reporting (CDC / analytics — no FK to operational DBs)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE fact_otp_sends (
  id                  uuid PRIMARY KEY,
  merchant_id         uuid NOT NULL,
  template_id         uuid,
  phone_e164          text,
  status              text NOT NULL,
  cost_idr            bigint NOT NULL DEFAULT 0,
  request_id          text,
  occurred_at         timestamptz NOT NULL,
  ingested_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fact_otp_sends_merchant_idx
  ON fact_otp_sends (merchant_id, occurred_at DESC);

CREATE TABLE fact_wallet_events (
  id                  uuid PRIMARY KEY,
  merchant_id         uuid NOT NULL,
  entry_type          text NOT NULL,
  reason              text NOT NULL,
  amount_idr          bigint NOT NULL,
  occurred_at         timestamptz NOT NULL,
  ingested_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX fact_wallet_events_merchant_idx
  ON fact_wallet_events (merchant_id, occurred_at DESC);

CREATE TABLE dim_merchants (
  merchant_id         uuid PRIMARY KEY,
  slug                text,
  display_name        text,
  updated_at          timestamptz NOT NULL DEFAULT now()
);
