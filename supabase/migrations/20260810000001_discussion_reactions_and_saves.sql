-- Discussion emoji reactions
create table if not exists discussion_reactions (
  id          uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  emoji       text not null,
  created_at  timestamptz not null default now(),
  unique (discussion_id, user_id, emoji)
);

alter table discussion_reactions enable row level security;

drop policy if exists "Anyone can read discussion reactions" on discussion_reactions;
create policy "Anyone can read discussion reactions"
  on discussion_reactions for select using (true);

drop policy if exists "Users can manage own discussion reactions" on discussion_reactions;
create policy "Users can manage own discussion reactions"
  on discussion_reactions for all using (auth.uid() = user_id);

-- Discussion saves (bookmarks)
create table if not exists discussion_saves (
  id            uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references discussions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  created_at    timestamptz not null default now(),
  unique (discussion_id, user_id)
);

alter table discussion_saves enable row level security;

drop policy if exists "Users can manage own saves" on discussion_saves;
create policy "Users can manage own saves"
  on discussion_saves for all using (auth.uid() = user_id);

drop policy if exists "Users can read own saves" on discussion_saves;
create policy "Users can read own saves"
  on discussion_saves for select using (auth.uid() = user_id);
