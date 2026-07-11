-- Phase 22: Personal rating for collection items
-- Replaces the external (TMDB/Google Books) rating shown on the collection
-- grid tiles with the user's own 1-5 star rating, set at add-time via the
-- search/scan flows. ext_rating is kept around (unused by the UI now) in
-- case it's useful again later — cheap to keep, no reason to drop it.

alter table collection_items add column if not exists user_rating smallint check (user_rating between 1 and 5);
