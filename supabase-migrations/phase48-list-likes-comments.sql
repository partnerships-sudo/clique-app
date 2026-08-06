-- phase48: likes and comments on lists

-- List likes (one per user per list)
create table if not exists list_likes (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (list_id, user_id)
);

alter table list_likes enable row level security;
create policy "list_likes_select" on list_likes for select using (true);
create policy "list_likes_insert" on list_likes for insert with check (auth.uid() = user_id);
create policy "list_likes_delete" on list_likes for delete using (auth.uid() = user_id);

-- List comments (flat, no threading needed for v1)
create table if not exists list_comments (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references lists(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 500),
  created_at  timestamptz not null default now()
);

alter table list_comments enable row level security;
create policy "list_comments_select" on list_comments for select using (true);
create policy "list_comments_insert" on list_comments for insert with check (auth.uid() = user_id);
create policy "list_comments_delete" on list_comments for delete using (auth.uid() = user_id);
