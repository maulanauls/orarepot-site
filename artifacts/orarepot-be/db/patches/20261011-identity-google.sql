-- Existing orarepot_identity databases: link a Google account to mt_users.
ALTER TABLE mt_users ADD COLUMN IF NOT EXISTS google_sub text;
CREATE UNIQUE INDEX IF NOT EXISTS mt_users_google_sub_idx
  ON mt_users (google_sub)
  WHERE google_sub IS NOT NULL;
