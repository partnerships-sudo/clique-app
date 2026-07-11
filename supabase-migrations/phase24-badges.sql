alter table profiles add column if not exists featured_badges text[] not null default '{}';

create table if not exists user_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  badge_key text not null,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists user_badges_user_id_idx on user_badges(user_id);

alter table user_badges enable row level security;

create policy "Anyone can read badges" on user_badges
  for select using (true);

create policy "Users can insert their own badges" on user_badges
  for insert with check (auth.uid() = user_id);
