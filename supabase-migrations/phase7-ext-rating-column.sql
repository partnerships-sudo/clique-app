-- Adds a column for the external critic rating (e.g. TMDB/RAWG/Google Books
-- score, like "8.9"), distinct from the existing personal 1-5 star `rating`
-- column. Powers the semi-opaque "★ 8.9" badge overlaid on poster artwork.

alter table posts add column if not exists ext_rating text;
alter table library add column if not exists ext_rating text;
