-- Run this in the Supabase SQL Editor (dashboard → SQL Editor → New query)
-- Adds episode progress tracking columns to the library table.

ALTER TABLE library
  ADD COLUMN IF NOT EXISTS ep_season  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ep_episode INTEGER DEFAULT NULL;
