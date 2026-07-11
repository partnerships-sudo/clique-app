-- Phase 21: Collection item rating
-- Captures the external rating (TMDB vote average / Google Books average
-- rating) at the moment an item is added to the collection, so the grid
-- view can overlay it on the cover art without a live API call.

alter table collection_items add column if not exists ext_rating text;
