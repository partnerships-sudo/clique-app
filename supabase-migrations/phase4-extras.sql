-- Persistent reactions ("Me too!" on feed posts)
create table if not exists reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  user_name text not null,
  created_at timestamptz default now(),
  unique(post_id, user_id)
);

alter table reactions enable row level security;

drop policy if exists "Reactions are viewable by everyone" on reactions;
create policy "Reactions are viewable by everyone" on reactions
  for select using (true);

drop policy if exists "Users can add their own reactions" on reactions;
create policy "Users can add their own reactions" on reactions
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own reactions" on reactions;
create policy "Users can remove their own reactions" on reactions
  for delete using (auth.uid() = user_id);

-- Spoiler guard: tag each chat message with the sender's episode progress
alter table messages add column if not exists ep_season int;
alter table messages add column if not exists ep_episode int;

-- Real profile photo uploads
alter table profiles add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly accessible" on storage.objects;
create policy "Avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "Users can upload their own avatar" on storage.objects;
create policy "Users can upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can update their own avatar" on storage.objects;
create policy "Users can update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
