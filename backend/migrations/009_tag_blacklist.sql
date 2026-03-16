CREATE TABLE IF NOT EXISTS tag_blacklist (
  id SERIAL PRIMARY KEY,
  word TEXT UNIQUE NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tag_blacklist_word ON tag_blacklist (LOWER(word));
