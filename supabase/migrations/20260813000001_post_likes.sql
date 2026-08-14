-- Post likes table
create table if not exists post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (post_id, user_id)
);

alter table post_likes enable row level security;

drop policy if exists "Users can see all likes" on post_likes;
create policy "Users can see all likes"
  on post_likes for select using (true);

drop policy if exists "Users can like posts" on post_likes;
create policy "Users can like posts"
  on post_likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unlike posts" on post_likes;
create policy "Users can unlike posts"
  on post_likes for delete using (auth.uid() = user_id);

-- Fast count index
create index if not exists post_likes_post_id_idx on post_likes (post_id);
create index if not exists post_likes_user_id_idx on post_likes (user_id);
