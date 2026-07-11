-- Phase 32: Add TV shows and Podcasts to Collection
--
-- Extends the collection_items type enum to include 'tv' and 'podcast',
-- adds a sharing toggle for podcasts (TV reuses the existing movies toggle
-- since "Movies & TV" is already the label for collection_share_movies),
-- and updates the RLS select policy to cover the new types.

-- 1. Widen the type check constraint
alter table collection_items
  drop constraint collection_items_type_check;

alter table collection_items
  add constraint collection_items_type_check
    check (type = any (array['read','watch','tv','listen','play','podcast']));

-- 2. New sharing column for podcasts
alter table profiles
  add column if not exists collection_share_podcasts boolean not null default false;

-- 3. Update the select policy to cover the two new types
drop policy if exists "Users can view their own or shared collection items" on collection_items;

create policy "Users can view their own or shared collection items" on collection_items
  for select using (
    auth.uid() = user_id
    or (
      type = 'read'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_books = true
      )
    )
    or (
      type in ('watch', 'tv')
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_movies = true
      )
    )
    or (
      type = 'listen'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_music = true
      )
    )
    or (
      type = 'play'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_games = true
      )
    )
    or (
      type = 'podcast'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_podcasts = true
      )
    )
  );
