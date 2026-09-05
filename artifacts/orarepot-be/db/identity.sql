-- Database: orarepot_identity
-- Service: orarepot-identity (auth, session, preferences, login audit)
--
-- Workspace membership lives in orarepot-members, not here.
-- user_id in other databases is a logical FK → mt_users.id

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE locale_code AS ENUM ('id', 'en');
CREATE TYPE appearance_theme AS ENUM ('light', 'dark');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TABLE mt_users (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email             citext NOT NULL UNIQUE,
  phone_e164        text,
  password_hash     text NOT NULL,
  full_name         text NOT NULL,
  image_url         text,
  email_verified_at timestamptz,
  last_login_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt_users_phone_format
    CHECK (phone_e164 IS NULL OR phone_e164 ~ '^\+[1-9][0-9]{7,14}$')
);

CREATE INDEX mt_users_phone_idx ON mt_users (phone_e164);

CREATE TABLE mt_account_preferences (
  user_id         uuid PRIMARY KEY REFERENCES mt_users (id) ON DELETE CASCADE,
  theme           appearance_theme NOT NULL DEFAULT 'light',
  locale          locale_code NOT NULL DEFAULT 'id',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cm_user_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES mt_users (id) ON DELETE CASCADE,
  token_hash      text NOT NULL UNIQUE,
  user_agent      text,
  ip              inet,
  expires_at      timestamptz NOT NULL,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cm_user_sessions_user_idx ON cm_user_sessions (user_id);

CREATE TABLE cm_access_audits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  actor_user_id   uuid REFERENCES mt_users (id) ON DELETE SET NULL,
  action          text NOT NULL,
  resource        text,
  ip              inet,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX cm_access_audits_merchant_idx ON cm_access_audits (merchant_id, created_at DESC);

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

CREATE TRIGGER mt_users_updated_at
  BEFORE UPDATE ON mt_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
