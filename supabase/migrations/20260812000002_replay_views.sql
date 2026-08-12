-- Track replay views for watch party analytics
-- Run in Supabase SQL editor after 20260812000001_analytics_watch_time.sql

create table if not exists premiere_replay_views (
  id           uuid primary key default gen_random_uuid(),
  premiere_id  uuid not null references premieres(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  viewed_at    timestamptz not null default now(),
  unique (premiere_id, user_id)  -- one row per viewer (counts unique replays)
);

create index if not exists premiere_replay_views_premiere_id_idx
  on premiere_replay_views (premiere_id);
