-- Apply on orarepot_developer (existing installs).
-- psql orarepot_developer -f db/patches/2026-10-04-api-ip-allowlist.sql

CREATE TABLE IF NOT EXISTS mt_api_ip_allowlist (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  cidr            inet NOT NULL,
  label           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mt_api_ip_allowlist_unique UNIQUE (merchant_id, cidr)
);

CREATE INDEX IF NOT EXISTS mt_api_ip_allowlist_merchant_idx
  ON mt_api_ip_allowlist (merchant_id);
