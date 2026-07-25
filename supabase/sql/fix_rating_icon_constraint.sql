-- Update the rating_icon check constraint to match current valid values in the app.
-- Run in Supabase dashboard → SQL Editor.

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_rating_icon_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_rating_icon_check
  CHECK (rating_icon IN ('stars', 'hotdogs', 'popcorn', 'sodas'));
