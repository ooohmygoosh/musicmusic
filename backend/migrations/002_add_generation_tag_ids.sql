ALTER TABLE generation_jobs ADD COLUMN IF NOT EXISTS tag_ids INT[] DEFAULT '{}';
