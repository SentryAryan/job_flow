-- ============================================================
-- Feature 04 — Initial database schema
-- Tables: profiles, agent_runs, jobs, agent_logs
-- Storage: resumes bucket (created via MCP, not SQL)
-- ============================================================

-- ------------------------------------
-- 1. profiles
-- ------------------------------------
CREATE TABLE profiles (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name          TEXT,
  email              TEXT,
  phone              TEXT,
  location           TEXT,
  current_title      TEXT,
  experience_level   TEXT,
  years_experience   INTEGER,
  skills             TEXT[] DEFAULT '{}',
  industries         TEXT[] DEFAULT '{}',
  work_experience    JSONB DEFAULT '[]'::jsonb,
  education          JSONB DEFAULT '{}'::jsonb,
  job_titles_seeking TEXT[] DEFAULT '{}',
  remote_preference  TEXT,
  preferred_locations TEXT[] DEFAULT '{}',
  salary_expectation TEXT,
  cover_letter_tone  TEXT,
  linkedin_url       TEXT,
  portfolio_url      TEXT,
  work_authorization TEXT,
  resume_pdf_url     TEXT,
  is_complete        BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_owner_all" ON profiles
  FOR ALL TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- ------------------------------------
-- 2. agent_runs
-- ------------------------------------
CREATE TABLE agent_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'completed', 'failed')),
  job_title_searched TEXT,
  location_searched  TEXT,
  jobs_found         INTEGER NOT NULL DEFAULT 0,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ
);

CREATE INDEX idx_agent_runs_user_started
  ON agent_runs (user_id, started_at DESC);

ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_runs_owner_all" ON agent_runs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------
-- 3. jobs
-- ------------------------------------
CREATE TABLE jobs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id             UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  user_id            UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source             TEXT NOT NULL CHECK (source IN ('search', 'url')),
  source_url         TEXT,
  external_apply_url TEXT,
  title              TEXT,
  company            TEXT,
  location           TEXT,
  salary             TEXT,
  job_type           TEXT,
  about_role         TEXT,
  responsibilities   TEXT[] DEFAULT '{}',
  requirements       TEXT[] DEFAULT '{}',
  nice_to_have       TEXT[] DEFAULT '{}',
  benefits           TEXT[] DEFAULT '{}',
  about_company      TEXT,
  match_score        INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  match_reason       TEXT,
  matched_skills     TEXT[] DEFAULT '{}',
  missing_skills     TEXT[] DEFAULT '{}',
  company_research   JSONB,
  found_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_user_found ON jobs (user_id, found_at DESC);
CREATE INDEX idx_jobs_user_score ON jobs (user_id, match_score DESC);
CREATE INDEX idx_jobs_run        ON jobs (run_id);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "jobs_owner_all" ON jobs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------
-- 4. agent_logs
-- ------------------------------------
CREATE TABLE agent_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message    TEXT NOT NULL,
  level      TEXT NOT NULL DEFAULT 'info'
             CHECK (level IN ('info', 'success', 'warning', 'error')),
  job_id     UUID REFERENCES jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_logs_run     ON agent_logs (run_id, created_at);
CREATE INDEX idx_agent_logs_user    ON agent_logs (user_id, created_at DESC);

ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agent_logs_owner_all" ON agent_logs
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- ------------------------------------
-- 5. Auto-create profile on signup
-- ------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_complete)
  VALUES (NEW.id, NEW.email, false);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------
-- 6. Storage RLS for resumes bucket
-- (bucket itself created via MCP create-bucket)
-- ------------------------------------
CREATE POLICY "resumes_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.uid()::text)
  )
  WITH CHECK (
    bucket = 'resumes'
    AND (storage.foldername(key))[1] = (SELECT auth.uid()::text)
  );
