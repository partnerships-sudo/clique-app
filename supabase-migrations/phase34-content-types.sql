-- Phase 34: Store onboarding content-type preferences on the profile
--
-- Adds a content_types column to profiles so the user's taste picks from
-- onboarding are persisted server-side and available across devices.
-- Values are valid EntryType slugs (watch, read, play, listen, podcast).
-- An empty array means "no preference set" (all types shown).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS content_types text[] NOT NULL DEFAULT '{}';
