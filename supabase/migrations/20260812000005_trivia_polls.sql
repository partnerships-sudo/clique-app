-- Trivia & live polls for watch parties and screening rooms
-- trigger_ms = milliseconds from live_started_at when the card should fire

-- ── Watch party trivia ────────────────────────────────────────────────────────
create table if not exists premiere_trivia (
  id          uuid primary key default gen_random_uuid(),
  premiere_id uuid not null references premieres(id) on delete cascade,
  type        text not null check (type in ('trivia', 'poll', 'message')),
  question    text not null,  -- for 'message' this is the full chat message text
  options     jsonb not null default '[]',   -- [{label, is_correct?}] — empty for 'message'
  trigger_ms  bigint not null,               -- ms from live_started_at
  fired_at    timestamptz,                   -- null until fired by host timer
  created_at  timestamptz not null default now()
);

create index if not exists premiere_trivia_premiere_id_idx
  on premiere_trivia (premiere_id);

create table if not exists premiere_trivia_responses (
  id          uuid primary key default gen_random_uuid(),
  trivia_id   uuid not null references premiere_trivia(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  option_idx  int not null,
  answered_at timestamptz not null default now(),
  unique (trivia_id, user_id)
);

create index if not exists premiere_trivia_responses_trivia_id_idx
  on premiere_trivia_responses (trivia_id);

-- ── Screening room trivia ─────────────────────────────────────────────────────
create table if not exists screening_room_trivia (
  id                uuid primary key default gen_random_uuid(),
  screening_room_id uuid not null references screening_rooms(id) on delete cascade,
  type              text not null check (type in ('trivia', 'poll', 'message')),
  question          text not null,
  options           jsonb not null default '[]',
  trigger_ms        bigint not null,
  fired_at          timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists screening_room_trivia_room_id_idx
  on screening_room_trivia (screening_room_id);

create table if not exists screening_room_trivia_responses (
  id                uuid primary key default gen_random_uuid(),
  trivia_id         uuid not null references screening_room_trivia(id) on delete cascade,
  user_id           uuid not null references auth.users(id) on delete cascade,
  option_idx        int not null,
  answered_at       timestamptz not null default now(),
  unique (trivia_id, user_id)
);

create index if not exists screening_room_trivia_responses_trivia_id_idx
  on screening_room_trivia_responses (trivia_id);
