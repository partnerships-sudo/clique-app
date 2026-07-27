-- Phase 39: Add note column to collection_items so imported reviews
-- (e.g. Letterboxd reviews.csv) can be stored alongside ratings.

ALTER TABLE collection_items
  ADD COLUMN IF NOT EXISTS note text;
