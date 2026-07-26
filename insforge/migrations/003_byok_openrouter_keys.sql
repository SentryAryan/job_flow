-- ============================================================
-- Feature BYOK — Encrypted OpenRouter keys on profiles
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS openrouter_keys_enc JSONB NOT NULL DEFAULT '[]'::jsonb;
