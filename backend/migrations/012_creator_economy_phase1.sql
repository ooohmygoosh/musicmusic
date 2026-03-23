ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'listener',
  ADD COLUMN IF NOT EXISTS membership_status TEXT DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS membership_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS wallet_balance NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wallet_frozen NUMERIC DEFAULT 0;

ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS requested_by_user_id INT REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS generation_intent TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS should_publish BOOLEAN DEFAULT FALSE;

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS owner_user_id INT REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS creator_type TEXT DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS generation_source TEXT DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publish_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS revenue_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS visibility_scope TEXT DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS official_fallback BOOLEAN DEFAULT FALSE;

UPDATE generation_jobs
SET requested_by_user_id = COALESCE(requested_by_user_id, user_id),
    owner_user_id = COALESCE(owner_user_id, user_id),
    generation_intent = COALESCE(NULLIF(generation_intent, ''), 'manual'),
    should_publish = COALESCE(should_publish, FALSE)
WHERE requested_by_user_id IS NULL
   OR owner_user_id IS NULL
   OR generation_intent IS NULL
   OR should_publish IS NULL;

UPDATE songs
SET owner_user_id = COALESCE(owner_user_id, user_id),
    creator_type = COALESCE(NULLIF(creator_type, ''), 'user'),
    generation_source = COALESCE(NULLIF(generation_source, ''), 'legacy'),
    is_public = COALESCE(is_public, FALSE),
    publish_status = COALESCE(NULLIF(publish_status, ''), CASE WHEN COALESCE(is_public, FALSE) THEN 'published' ELSE 'draft' END),
    revenue_enabled = COALESCE(revenue_enabled, FALSE),
    visibility_scope = COALESCE(NULLIF(visibility_scope, ''), CASE WHEN COALESCE(is_public, FALSE) THEN 'public' ELSE 'private' END),
    official_fallback = COALESCE(official_fallback, FALSE)
WHERE owner_user_id IS NULL
   OR creator_type IS NULL
   OR generation_source IS NULL
   OR is_public IS NULL
   OR publish_status IS NULL
   OR revenue_enabled IS NULL
   OR visibility_scope IS NULL
   OR official_fallback IS NULL;

UPDATE users
SET role = COALESCE(NULLIF(role, ''), 'listener'),
    membership_status = COALESCE(NULLIF(membership_status, ''), 'free'),
    wallet_balance = COALESCE(wallet_balance, 0),
    wallet_frozen = COALESCE(wallet_frozen, 0)
WHERE role IS NULL
   OR membership_status IS NULL
   OR wallet_balance IS NULL
   OR wallet_frozen IS NULL;

CREATE INDEX IF NOT EXISTS idx_generation_jobs_requested_user_status
  ON generation_jobs(requested_by_user_id, status, id DESC);

CREATE INDEX IF NOT EXISTS idx_songs_owner_user_id
  ON songs(owner_user_id, created_at DESC);
