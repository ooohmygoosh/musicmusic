ALTER TABLE users
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE tags
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_song_queue (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  song_id INT REFERENCES songs(id) ON DELETE CASCADE,
  generation_job_id INT REFERENCES generation_jobs(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'generated',
  is_hidden BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  acted_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_song_queue_user_created
  ON user_song_queue(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_song_queue_song
  ON user_song_queue(song_id);

INSERT INTO tags (name, type, is_active, is_system, description, sort_order)
VALUES
  ('忧郁', '情绪', true, true, '情绪偏低沉、克制、带一点夜晚感', 10),
  ('开心', '情绪', true, true, '轻快、积极、明亮', 11),
  ('治愈', '情绪', true, true, '柔和、温暖、放松', 12),
  ('热血', '情绪', true, true, '高能、鼓舞、向上', 13),
  ('梦幻', '情绪', true, true, '朦胧、漂浮、浪漫', 14),
  ('钢琴', '乐器', true, true, '以钢琴为主导乐器', 20),
  ('吉他', '乐器', true, true, '以吉他为主导乐器', 21),
  ('长笛', '乐器', true, true, '以长笛为主导乐器', 22),
  ('弦乐', '乐器', true, true, '以弦乐组增强层次', 23),
  ('sax', '乐器', true, true, '以萨克斯为主导乐器', 24),
  ('流行', '风格', true, true, '主流流行旋律导向', 30),
  ('爵士', '风格', true, true, '带有摇摆和爵士和声色彩', 31),
  ('电子', '风格', true, true, '电子音色和律动', 32),
  ('民谣', '风格', true, true, '更偏原声与叙事', 33),
  ('轻音乐', '风格', true, true, '适合背景播放的轻编制音乐', 34),
  ('夜晚', '场景', true, true, '夜间独处或通勤', 40),
  ('学习', '场景', true, true, '适合学习、专注', 41),
  ('通勤', '场景', true, true, '适合移动途中播放', 42),
  ('清晨', '场景', true, true, '适合晨间、唤醒', 43),
  ('雨天', '场景', true, true, '适合雨天氛围', 44),
  ('慢节奏', '节奏', true, true, '舒缓、中低速', 50),
  ('中速', '节奏', true, true, '稳定、中等速度', 51),
  ('快节奏', '节奏', true, true, '推动感更强、偏兴奋', 52)
ON CONFLICT DO NOTHING;
