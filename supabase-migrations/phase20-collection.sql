-- Phase 20: My Collection
-- Tracks physical media a user owns (books, DVDs/Blu-rays/4Ks) — distinct
-- from the "logged" activity library, which tracks what they've watched/read
-- regardless of ownership. Fully private: only the owner can see their own
-- collection, unlike posts which are visible to friends.

create table if not exists collection_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('read', 'watch')),
  format text check (format in ('book', 'dvd', 'bluray', '4k')),
  title text not null,
  sub text,
  poster text,
  external_id text,
  media_type text,
  created_at timestamptz not null default now()
);

create index if not exists collection_items_user_id_idx on collection_items(user_id);

alter table collection_items enable row level security;

drop policy if exists "Users can manage their own collection" on collection_items;
create policy "Users can manage their own collection" on collection_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
