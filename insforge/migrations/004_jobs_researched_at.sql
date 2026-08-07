-- ============================================================
-- Feature 16 — researched_at on jobs for Recent Activity sort
-- ============================================================

ALTER TABLE jobs
  ADD COLUMN IF NOT EXISTS researched_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_user_researched
  ON jobs (user_id, researched_at DESC)
  WHERE company_research IS NOT NULL;

-- Backfill existing dossiers so they still appear in the activity feed
UPDATE jobs
SET researched_at = found_at
WHERE company_research IS NOT NULL
  AND researched_at IS NULL;
