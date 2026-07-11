-- Phase 28: Close Friends list.
--
-- A private, one-sided tag a user can put on their own mutual follows —
-- like Instagram's Close Friends. Only the owner can ever see their own
-- list; the tagged friend is never notified or shown the list.

create table if not exists close_friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  friend_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists close_friends_user_id_idx on close_friends(user_id);
create index if not exists close_friends_friend_id_idx on close_friends(friend_id);

alter table close_friends enable row level security;

drop policy if exists "Users can view their own close friends" on close_friends;
create policy "Users can view their own close friends" on close_friends
  for select using (auth.uid() = user_id);

drop policy if exists "Users can add their own close friends" on close_friends;
create policy "Users can add their own close friends" on close_friends
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own close friends" on close_friends;
create policy "Users can remove their own close friends" on close_friends
  for delete using (auth.uid() = user_id);
