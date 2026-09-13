-- Existing orarepot_billing databases: trial OTP quota + pending Midtrans topup.
ALTER TABLE mt_wallets
  ADD COLUMN IF NOT EXISTS trial_otp_used integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_otp_limit integer NOT NULL DEFAULT 3;

ALTER TABLE tx_wallet_reservations
  ADD COLUMN IF NOT EXISTS is_trial boolean NOT NULL DEFAULT false;

-- Merchants that already received deposit credit do not get extra free OTPs.
UPDATE mt_wallets w
SET trial_otp_used = trial_otp_limit
WHERE EXISTS (
  SELECT 1 FROM tx_wallet_ledger l
  WHERE l.wallet_id = w.id AND l.entry_type = 'credit'
);
