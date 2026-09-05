-- Database: orarepot_developer
-- Service: orarepot-developer (white-label public API — keys, webhooks; consumes Kafka otp.*)
-- Public host: https://api.orarepot.com
-- Docs host:   https://docs.orarepot.com

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE webhook_event AS ENUM ('otp.sent', 'otp.failed');
CREATE TYPE delivery_status AS ENUM ('success', 'failed');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- merchant_id logical FK → orarepot_merchant.mt_merchants.id
CREATE TABLE mt_api_keys (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  name            text NOT NULL,
  prefix          text NOT NULL,
  last4           text NOT NULL,
  key_hash        text NOT NULL UNIQUE,
  last_used_at    timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX mt_api_keys_merchant_idx
  ON mt_api_keys (merchant_id)
  WHERE revoked_at IS NULL;

CREATE TABLE mt_webhooks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL UNIQUE,
  url             text NOT NULL,
  secret_hash     text NOT NULL,
  events          webhook_event[] NOT NULL DEFAULT ARRAY['otp.sent', 'otp.failed']::webhook_event[],
  enabled         boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt_webhooks_url_https CHECK (url ~* '^https://')
);

-- otp_send_id logical FK → orarepot_otp.tx_otp_sends.id
CREATE TABLE cm_webhook_deliveries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      uuid NOT NULL REFERENCES mt_webhooks (id) ON DELETE CASCADE,
  merchant_id     uuid NOT NULL,
  event           webhook_event NOT NULL,
  otp_send_id     uuid,
  url             text NOT NULL,
  status          delivery_status NOT NULL,
  http_status     integer,
  attempt         integer NOT NULL DEFAULT 1,
  request_body    jsonb,
  response_body   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cm_webhook_deliveries_merchant_idx
  ON cm_webhook_deliveries (merchant_id, created_at DESC);

CREATE TABLE cm_api_request_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid,
  api_key_id      uuid REFERENCES mt_api_keys (id) ON DELETE SET NULL,
  method          text NOT NULL,
  path            text NOT NULL,
  status          integer NOT NULL,
  ip              inet,
  duration_ms     integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cm_api_request_logs_merchant_idx
  ON cm_api_request_logs (merchant_id, created_at DESC);

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

CREATE TRIGGER mt_webhooks_updated_at
  BEFORE UPDATE ON mt_webhooks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
