-- Storefront buyers for the per-merchant PPOB site.
-- Same identity database as /auth/login, separate from merchant staff
-- (owner / admin / agent in orarepot_members).
-- merchant_id is a logical FK → orarepot_merchant.mt_merchants.id
-- role is always customer: one buyer belongs to one merchant store.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS mt_store_customers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  role            text NOT NULL DEFAULT 'customer',
  email           citext,
  phone_e164      text,
  password_hash   text NOT NULL,
  full_name       text NOT NULL,
  status          text NOT NULL DEFAULT 'active',
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt_store_customers_role CHECK (role = 'customer'),
  CONSTRAINT mt_store_customers_status CHECK (status IN ('active', 'suspended')),
  CONSTRAINT mt_store_customers_contact CHECK (email IS NOT NULL OR phone_e164 IS NOT NULL),
  CONSTRAINT mt_store_customers_phone_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS mt_store_customers_merchant_email_idx
  ON mt_store_customers (merchant_id, email)
  WHERE email IS NOT NULL AND status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS mt_store_customers_merchant_phone_idx
  ON mt_store_customers (merchant_id, phone_e164)
  WHERE phone_e164 IS NOT NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS mt_store_customers_merchant_idx
  ON mt_store_customers (merchant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cm_store_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id   uuid NOT NULL REFERENCES mt_store_customers (id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  expires_at    timestamptz NOT NULL,
  revoked_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cm_store_sessions_customer_idx
  ON cm_store_sessions (customer_id);
