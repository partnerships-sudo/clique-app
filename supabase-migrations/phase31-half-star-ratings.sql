-- Phase 31: Half-star rating support
--
-- Converts the three rating columns from integer to numeric(3,1) so they
-- can store .5 values (e.g. 2.5, 3.5). Existing whole-number ratings are
-- preserved exactly via implicit cast.

alter table posts
  alter column rating type numeric(3,1) using rating::numeric(3,1);

alter table library
  alter column rating type numeric(3,1) using rating::numeric(3,1);

alter table collection_items
  alter column user_rating type numeric(3,1) using user_rating::numeric(3,1);
