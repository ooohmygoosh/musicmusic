BEGIN;

TRUNCATE TABLE
  feedback,
  playlist_songs,
  playlists,
  user_song_queue,
  song_tags,
  song_assets,
  songs,
  generation_jobs,
  users,
  tpy_callbacks
RESTART IDENTITY CASCADE;

COMMIT;
