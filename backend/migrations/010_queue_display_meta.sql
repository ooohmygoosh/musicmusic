ALTER TABLE user_song_queue
  ADD COLUMN IF NOT EXISTS display_title TEXT,
  ADD COLUMN IF NOT EXISTS display_cover_url TEXT;
