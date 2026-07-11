-- Phase 26: Replace mutual Friends with a one-way Follow model + private
-- accounts (Instagram-style), plus open direct messages gated by
-- recipient-side acceptance instead of a pre-existing relationship.
--
-- The `friendships` table is intentionally left in place, unused, for
-- safety/rollback — see phase26 notes in the plan doc for why.

-- ---------------------------------------------------------------------------
-- 1. Private accounts
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists is_private boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2. follows: one row per direction. Public targets auto-accept; private
--    targets start pending until the target approves.
-- ---------------------------------------------------------------------------
create table if not exists follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  followed_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (follower_id, followed_id)
);
create index if not exists follows_follower_id_idx on follows(follower_id);
create index if not exists follows_followed_id_idx on follows(followed_id);

alter table follows enable row level security;

drop policy if exists "Authenticated users can view follows" on follows;
create policy "Authenticated users can view follows" on follows
  for select using (auth.uid() is not null);

drop policy if exists "Users can insert their own follow rows" on follows;
create policy "Users can insert their own follow rows" on follows
  for insert with check (
    auth.uid() = follower_id
    and (
      (status = 'accepted' and exists (select 1 from profiles where id = followed_id and is_private = false))
      or
      (status = 'pending' and exists (select 1 from profiles where id = followed_id and is_private = true))
    )
  );

drop policy if exists "Followed users can respond to follow requests" on follows;
create policy "Followed users can respond to follow requests" on follows
  for update using (followed_id = auth.uid()) with check (followed_id = auth.uid());

drop policy if exists "Either side can delete a follow row" on follows;
create policy "Either side can delete a follow row" on follows
  for delete using (auth.uid() = follower_id or auth.uid() = followed_id);

-- ---------------------------------------------------------------------------
-- 3. dm_requests: tracks whether a recipient has accepted a non-mutual
--    sender's messages. Mutual follows skip this entirely (see app code).
-- ---------------------------------------------------------------------------
create table if not exists dm_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id)
);
create index if not exists dm_requests_recipient_id_idx on dm_requests(recipient_id);

alter table dm_requests enable row level security;

drop policy if exists "Participants can view their dm requests" on dm_requests;
create policy "Participants can view their dm requests" on dm_requests
  for select using (auth.uid() = sender_id or auth.uid() = recipient_id);

drop policy if exists "Senders can create a dm request" on dm_requests;
create policy "Senders can create a dm request" on dm_requests
  for insert with check (auth.uid() = sender_id);

drop policy if exists "Recipients can accept a dm request" on dm_requests;
create policy "Recipients can accept a dm request" on dm_requests
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

drop policy if exists "Recipients can decline a dm request" on dm_requests;
create policy "Recipients can decline a dm request" on dm_requests
  for delete using (recipient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. posts: public accounts visible to everyone, private accounts only to
--    accepted followers. Replaces the fully-open "Anyone can read posts".
-- ---------------------------------------------------------------------------
drop policy if exists "Anyone can read posts" on posts;
create policy "Posts visible to public accounts or accepted followers" on posts
  for select using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = posts.user_id and p.is_private = false)
    or exists (
      select 1 from follows f
      where f.follower_id = auth.uid() and f.followed_id = posts.user_id and f.status = 'accepted'
    )
  );

-- ---------------------------------------------------------------------------
-- 5. library: same public/private-or-accepted-follow rule for viewing;
--    inserting a rec into someone's library requires mutual accepted follows.
-- ---------------------------------------------------------------------------
drop policy if exists "Friends can view each other's watchlist" on library;
drop policy if exists "Friends can view each other's logged items" on library;
drop policy if exists "Friends can insert recs into each other's library" on library;

create policy "Watchlist visible to public accounts or accepted followers" on library
  for select using (
    status = 'watchlist'
    and (
      exists (select 1 from profiles p where p.id = library.user_id and p.is_private = false)
      or exists (
        select 1 from follows f
        where f.follower_id = auth.uid() and f.followed_id = library.user_id and f.status = 'accepted'
      )
    )
  );

create policy "Logged items visible to public accounts or accepted followers" on library
  for select using (
    status <> 'watchlist'
    and (
      exists (select 1 from profiles p where p.id = library.user_id and p.is_private = false)
      or exists (
        select 1 from follows f
        where f.follower_id = auth.uid() and f.followed_id = library.user_id and f.status = 'accepted'
      )
    )
  );

create policy "Mutual follows can insert recs into each other's library" on library
  for insert with check (
    rec_from_user_name is not null
    and exists (
      select 1 from follows f1, follows f2
      where f1.follower_id = auth.uid() and f1.followed_id = library.user_id and f1.status = 'accepted'
        and f2.follower_id = library.user_id and f2.followed_id = auth.uid() and f2.status = 'accepted'
    )
  );

-- ---------------------------------------------------------------------------
-- 6. direct_messages: open to send to anyone; acceptance is tracked
--    separately via dm_requests (app-level gate, not an RLS gate).
-- ---------------------------------------------------------------------------
drop policy if exists "Friends can send each other direct messages" on direct_messages;
create policy "Any authenticated user can send a direct message" on direct_messages
  for insert with check (auth.uid() = sender_id);

-- ---------------------------------------------------------------------------
-- 7. Notification trigger for follows (mirrors notify_on_friendship_change)
-- ---------------------------------------------------------------------------
drop trigger if exists notify_on_follow_change on follows;
create trigger notify_on_follow_change
after insert or update of status on follows
for each row execute function notify_webhook();

-- ---------------------------------------------------------------------------
-- 8. Data migration: existing accepted friendships become mutual accepted
--    follows, so nobody's current connections disappear. Pending
--    (never-accepted) requests are not carried forward.
-- ---------------------------------------------------------------------------
insert into follows (follower_id, followed_id, status)
select user_id, friend_id, 'accepted' from friendships where status = 'accepted'
union
select friend_id, user_id, 'accepted' from friendships where status = 'accepted'
on conflict do nothing;
