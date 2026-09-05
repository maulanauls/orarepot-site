-- Database: orarepot_templates
-- Service: orarepot-templates (Meta message catalog for OTP + broadcast)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE template_category AS ENUM ('AUTHENTICATION', 'UTILITY', 'MARKETING');
CREATE TYPE template_status AS ENUM ('ACTIVE', 'PENDING', 'REJECTED', 'PAUSED');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- merchant_id logical FK → orarepot_merchant.mt_merchants.id
CREATE TABLE mt_templates (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      uuid NOT NULL,
  name             text NOT NULL,
  category         template_category NOT NULL DEFAULT 'AUTHENTICATION',
  language         text NOT NULL DEFAULT 'Indonesian',
  language_code    text NOT NULL DEFAULT 'id',
  status           template_status NOT NULL DEFAULT 'PENDING',
  status_label     text,
  body             text NOT NULL,
  button_label     text,
  meta_template_id text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, name)
);

CREATE INDEX mt_templates_merchant_status_idx
  ON mt_templates (merchant_id, status);

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

CREATE TRIGGER mt_templates_updated_at
  BEFORE UPDATE ON mt_templates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
