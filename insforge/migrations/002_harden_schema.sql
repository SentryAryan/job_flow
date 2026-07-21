-- Feature 04 follow-up — apply after 001_initial_schema.sql (and resumes bucket creation)
-- Idempotent where possible for environments that already ran 001.

-- Harden signup trigger: tolerate duplicate profile rows on auth retry
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_complete)
  VALUES (NEW.id, NEW.email, false)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE profiles.email IS DISTINCT FROM EXCLUDED.email;
  RETURN NEW;
END;
$$;

-- Backfill profiles for auth users created before the trigger existed
INSERT INTO public.profiles (id, email, is_complete)
SELECT u.id, u.email, false
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
