-- Database: orarepot_billing
-- Service: orarepot-billing (wallet, Midtrans, invoice, OTP debit reserve)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE feature_code AS ENUM ('ai', 'broadcast', 'otp');
CREATE TYPE ledger_entry_type AS ENUM ('credit', 'debit');
CREATE TYPE ledger_reason AS ENUM (
  'topup',
  'otp_send',
  'broadcast_send',
  'ai_usage',
  'refund',
  'adjustment'
);
CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'expired',
  'failed',
  'canceled'
);
CREATE TYPE invoice_status AS ENUM ('pending', 'paid', 'void');
CREATE TYPE reservation_status AS ENUM ('held', 'captured', 'released');

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- merchant_id logical FK → orarepot_merchant.mt_merchants.id
CREATE TABLE mt_wallets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE mt_feature_rates (
  feature         feature_code PRIMARY KEY,
  unit_cost_idr   bigint NOT NULL CHECK (unit_cost_idr >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

INSERT INTO mt_feature_rates (feature, unit_cost_idr) VALUES
  ('ai', 50),
  ('broadcast', 450),
  ('otp', 600);

CREATE TABLE tx_wallet_ledger (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id       uuid NOT NULL REFERENCES mt_wallets (id) ON DELETE CASCADE,
  merchant_id     uuid NOT NULL,
  entry_type      ledger_entry_type NOT NULL,
  reason          ledger_reason NOT NULL,
  feature         feature_code,
  amount_idr      bigint NOT NULL CHECK (amount_idr > 0),
  units           integer,
  reference_type  text,
  reference_id    uuid,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tx_wallet_ledger_wallet_idx ON tx_wallet_ledger (wallet_id, created_at DESC);
CREATE INDEX tx_wallet_ledger_merchant_idx ON tx_wallet_ledger (merchant_id, created_at DESC);
CREATE UNIQUE INDEX tx_wallet_ledger_reference_idx
  ON tx_wallet_ledger (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;

-- OTP/broadcast calls Reserve → Capture/Release (saga, not a cross-DB transaction)
CREATE TABLE tx_wallet_reservations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  wallet_id       uuid NOT NULL REFERENCES mt_wallets (id),
  feature         feature_code NOT NULL,
  amount_idr      bigint NOT NULL CHECK (amount_idr > 0),
  units           integer NOT NULL DEFAULT 1,
  status          reservation_status NOT NULL DEFAULT 'held',
  reference_type  text NOT NULL,
  reference_id    uuid NOT NULL,
  ledger_id       uuid REFERENCES tx_wallet_ledger (id),
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reference_type, reference_id)
);

CREATE INDEX tx_wallet_reservations_held_idx
  ON tx_wallet_reservations (status, expires_at)
  WHERE status = 'held';

CREATE TABLE tx_payments (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id             uuid NOT NULL,
  order_id                text NOT NULL UNIQUE,
  amount_idr              bigint NOT NULL CHECK (amount_idr >= 10000),
  status                  payment_status NOT NULL DEFAULT 'pending',
  snap_token              text,
  snap_redirect_url       text,
  customer_name           text NOT NULL,
  customer_ref            text NOT NULL DEFAULT 'ORAREPOT',
  expires_at              timestamptz NOT NULL,
  paid_at                 timestamptz,
  midtrans_transaction_id text,
  midtrans_payment_type   text,
  midtrans_payload        jsonb,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tx_payments_merchant_idx ON tx_payments (merchant_id, created_at DESC);
CREATE INDEX tx_payments_status_idx ON tx_payments (status);

CREATE TABLE tx_invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id     uuid NOT NULL,
  payment_id      uuid REFERENCES tx_payments (id) ON DELETE SET NULL,
  number          text NOT NULL UNIQUE,
  label           text NOT NULL,
  amount_idr      bigint NOT NULL CHECK (amount_idr >= 0),
  status          invoice_status NOT NULL DEFAULT 'pending',
  issued_on       date NOT NULL DEFAULT CURRENT_DATE,
  paid_at         timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tx_invoices_merchant_idx ON tx_invoices (merchant_id, issued_on DESC);

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

CREATE VIEW vw_wallet_balances AS
SELECT
  w.merchant_id,
  COALESCE(SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount_idr ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN l.entry_type = 'debit' THEN l.amount_idr ELSE 0 END), 0)
    AS remaining_idr,
  COALESCE(SUM(CASE WHEN l.entry_type = 'credit' THEN l.amount_idr ELSE 0 END), 0)
    AS deposit_idr,
  COALESCE(SUM(CASE WHEN l.reason = 'otp_send' THEN l.amount_idr ELSE 0 END), 0)
    AS used_otp_idr,
  COALESCE(SUM(CASE WHEN l.reason = 'broadcast_send' THEN l.amount_idr ELSE 0 END), 0)
    AS used_broadcast_idr,
  COALESCE(SUM(CASE WHEN l.reason = 'ai_usage' THEN l.amount_idr ELSE 0 END), 0)
    AS used_ai_idr
FROM mt_wallets w
LEFT JOIN tx_wallet_ledger l ON l.wallet_id = w.id
GROUP BY w.merchant_id;

CREATE TRIGGER tx_payments_updated_at
  BEFORE UPDATE ON tx_payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER tx_wallet_reservations_updated_at
  BEFORE UPDATE ON tx_wallet_reservations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
