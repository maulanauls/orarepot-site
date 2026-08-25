-- Database: orarepot_merchant
-- Service: orarepot-merchant (tenant, plan, WABA, affiliate)

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE merchant_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE locale_code AS ENUM ('id', 'en');
CREATE TYPE plan_id AS ENUM ('trial', 'otp', 'broadcast', 'full');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'canceled');
CREATE TYPE waba_status AS ENUM ('disconnected', 'pending', 'connected');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE mt_merchants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            citext NOT NULL UNIQUE,
  display_name    text NOT NULL,
  status          merchant_status NOT NULL DEFAULT 'active',
  locale          locale_code NOT NULL DEFAULT 'id',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mt_subscriptions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id           uuid NOT NULL REFERENCES mt_merchants (id) ON DELETE CASCADE,
  plan                  plan_id NOT NULL DEFAULT 'trial',
  status                subscription_status NOT NULL DEFAULT 'trial',
  trial_ends_at         timestamptz,
  current_period_start  timestamptz NOT NULL DEFAULT now(),
  current_period_end    timestamptz NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mt_subscriptions_one_active_idx
  ON mt_subscriptions (merchant_id)
  WHERE status IN ('trial', 'active', 'past_due');

CREATE TABLE mt_waba_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL REFERENCES mt_merchants (id) ON DELETE CASCADE,
  phone_e164      text,
  display_name    text,
  meta_waba_id    text,
  meta_phone_id   text,
  status          waba_status NOT NULL DEFAULT 'disconnected',
  connected_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mt_waba_accounts_merchant_phone_idx
  ON mt_waba_accounts (merchant_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE TABLE mt_affiliates (
  merchant_id     uuid PRIMARY KEY REFERENCES mt_merchants (id) ON DELETE CASCADE,
  enabled         boolean NOT NULL DEFAULT false,
  referral_code   citext NOT NULL UNIQUE,
  commission_bps  integer NOT NULL DEFAULT 1000 CHECK (commission_bps BETWEEN 0 AND 10000),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
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

CREATE TRIGGER mt_merchants_updated_at
  BEFORE UPDATE ON mt_merchants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER mt_subscriptions_updated_at
  BEFORE UPDATE ON mt_subscriptions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER mt_waba_accounts_updated_at
  BEFORE UPDATE ON mt_waba_accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER mt_affiliates_updated_at
  BEFORE UPDATE ON mt_affiliates
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
