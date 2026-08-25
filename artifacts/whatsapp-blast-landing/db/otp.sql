-- Database: orarepot_otp
-- Service: orarepot-otp (send execution — consumes templates + billing APIs)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE otp_send_mode AS ENUM ('single', 'bulk');
CREATE TYPE otp_send_status AS ENUM ('pending', 'success', 'failed', 'cancelled');

CREATE TABLE tx_otp_sends (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         uuid NOT NULL,               -- → merchant.mt_merchants
  template_id         uuid NOT NULL,               -- → templates.mt_templates
  waba_account_id     uuid,                        -- → merchant.mt_waba_accounts
  reservation_id      uuid,                        -- → billing.tx_wallet_reservations
  ledger_id           uuid,                        -- → billing.tx_wallet_ledger (after capture)
  batch_id            uuid,
  mode                otp_send_mode NOT NULL DEFAULT 'single',
  request_id          text NOT NULL UNIQUE,
  phone_e164          text NOT NULL,
  status              otp_send_status NOT NULL DEFAULT 'pending',
  error_code          text,
  error_message       text,
  cost_idr            bigint NOT NULL DEFAULT 600,
  provider_message_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tx_otp_sends_phone_format CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX tx_otp_sends_merchant_created_idx ON tx_otp_sends (merchant_id, created_at DESC);
CREATE INDEX tx_otp_sends_template_idx ON tx_otp_sends (template_id, created_at DESC);
CREATE INDEX tx_otp_sends_phone_idx ON tx_otp_sends (phone_e164);
CREATE INDEX tx_otp_sends_batch_idx ON tx_otp_sends (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX tx_otp_sends_status_idx ON tx_otp_sends (merchant_id, status);

CREATE TABLE tx_otp_template_daily_stats (
  template_id      uuid NOT NULL,
  day              date NOT NULL,
  sent             integer NOT NULL DEFAULT 0,
  delivered        integer NOT NULL DEFAULT 0,
  read             integer NOT NULL DEFAULT 0,
  failed           integer NOT NULL DEFAULT 0,
  amount_spent_idr bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (template_id, day)
);

CREATE TABLE cm_outbox (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic           text NOT NULL,
  aggregate_type  text NOT NULL,
  aggregate_id    uuid NOT NULL,
  payload         jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  published_at    timestamptz
);

CREATE INDEX cm_outbox_unpublished_idx ON cm_outbox (created_at) WHERE published_at IS NULL;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tx_otp_sends_updated_at
  BEFORE UPDATE ON tx_otp_sends
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
