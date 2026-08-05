-- phase44-discussion-polls.sql
-- Lightweight polls attached to discussions.
-- A discussion can have at most one poll (one-to-one via discussion_id).
-- Options are stored as a jsonb array of strings (ordered, max 4).

create table if not exists discussion_polls (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  question      text not null,
  options       jsonb not null,            -- e.g. ["Option A", "Option B", "Option C"]
  created_at    timestamptz not null default now(),
  unique (discussion_id)
);

create table if not exists discussion_poll_votes (
  id            uuid primary key default gen_random_uuid(),
  poll_id       uuid not null references discussion_polls(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  option_index  int  not null,             -- 0-based index into options array
  created_at    timestamptz not null default now(),
  unique (poll_id, user_id)               -- one vote per user per poll
);

-- RLS
alter table discussion_polls enable row level security;
alter table discussion_poll_votes enable row level security;

drop policy if exists "Anyone can read polls" on discussion_polls;
create policy "Anyone can read polls" on discussion_polls
  for select using (true);

drop policy if exists "Author can insert poll" on discussion_polls;
create policy "Author can insert poll" on discussion_polls
  for insert with check (
    auth.uid() = (select user_id from discussions where id = discussion_id)
  );

drop policy if exists "Author can delete poll" on discussion_polls;
create policy "Author can delete poll" on discussion_polls
  for delete using (
    auth.uid() = (select user_id from discussions where id = discussion_id)
  );

drop policy if exists "Anyone can read poll votes" on discussion_poll_votes;
create policy "Anyone can read poll votes" on discussion_poll_votes
  for select using (true);

drop policy if exists "Authenticated users can vote" on discussion_poll_votes;
create policy "Authenticated users can vote" on discussion_poll_votes
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own vote" on discussion_poll_votes;
create policy "Users can delete own vote" on discussion_poll_votes
  for delete using (auth.uid() = user_id);
