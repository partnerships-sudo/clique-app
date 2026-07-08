-- Lets a user pick how their 1-5 ratings are displayed (stars, hotdogs, popcorn buckets)
-- instead of always rendering stars.
alter table profiles add column if not exists rating_icon text not null default 'stars';

alter table profiles drop constraint if exists profiles_rating_icon_check;
alter table profiles add constraint profiles_rating_icon_check
  check (rating_icon in ('stars', 'hotdogs', 'popcorn'));
