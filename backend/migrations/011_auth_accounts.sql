ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_id TEXT,
  ADD COLUMN IF NOT EXISTS password_hash TEXT,
  ADD COLUMN IF NOT EXISTS avatar TEXT;

UPDATE users
SET account_id = LOWER(device_id)
WHERE account_id IS NULL AND device_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_id_unique
  ON users(account_id)
  WHERE account_id IS NOT NULL;
