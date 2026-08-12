-- Analytics: share tracking + follows timestamp for growth metrics

-- Share tracking for watch parties
create table if not exists premiere_shares (
  id           uuid primary key default gen_random_uuid(),
  premiere_id  uuid not null references premieres(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  shared_at    timestamptz not null default now()
  -- allows multiple shares per user (every tap of Share counts)
);

create index if not exists premiere_shares_premiere_id_idx on premiere_shares (premiere_id);

-- Share tracking for screening rooms
create table if not exists screening_room_shares (
  id       uuid primary key default gen_random_uuid(),
  room_id  uuid not null references screening_rooms(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  shared_at timestamptz not null default now()
);

create index if not exists screening_room_shares_room_id_idx on screening_room_shares (room_id);

-- Ensure follows has a created_at column for event-window follower-gain queries
-- (Supabase auto-adds created_at on most tables; this is a no-op if it already exists)
alter table follows
  add column if not exists created_at timestamptz not null default now();
