-- Adds a verification tier to profiles.
-- 0 = unverified (default), 1 = identity-verified.
-- To manually verify a user in the Supabase dashboard:
--   UPDATE profiles SET verified_tier = 1 WHERE id = '<user-id>';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verified_tier smallint NOT NULL DEFAULT 0;
