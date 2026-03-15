ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS base_prompt TEXT,
  ADD COLUMN IF NOT EXISTS title_hint TEXT,
  ADD COLUMN IF NOT EXISTS cover_hint TEXT;

ALTER TABLE songs
  ADD COLUMN IF NOT EXISTS base_prompt TEXT,
  ADD COLUMN IF NOT EXISTS cover_hint TEXT;

UPDATE generation_jobs
SET base_prompt = COALESCE(base_prompt, prompt)
WHERE base_prompt IS NULL;

UPDATE songs
SET base_prompt = COALESCE(base_prompt, prompt)
WHERE base_prompt IS NULL;
