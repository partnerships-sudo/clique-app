-- Phase 36: Track when the user last read their reaction notifications.
--
-- All reactions with created_at <= reactions_read_at are considered read.
-- DEFAULT now() at migration time so existing users don't get flooded
-- with every historical reaction on their first open after the update.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS reactions_read_at timestamptz DEFAULT now();
