-- Ads table: one row per campaign
create table if not exists ads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),

  -- Brand info
  brand_name text not null,
  brand_logo_url text,

  -- Creative
  headline text not null,
  body text,
  image_url text,
  cta_label text not null default 'Learn More',
  cta_url text not null,

  -- Scheduling & status
  status text not null default 'pending' check (status in ('pending', 'approved', 'live', 'ended', 'rejected')),
  starts_at timestamptz,
  ends_at timestamptz,

  -- Budget (impression cap; null = unlimited)
  budget_impressions int,

  -- Running totals (denormalised for fast reads)
  impressions_count int not null default 0,
  taps_count int not null default 0
);

-- Ad events table: one row per impression or tap
create table if not exists ad_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  ad_id uuid not null references ads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('impression', 'tap'))
);

-- Index for fetching active ads quickly
create index if not exists ads_status_idx on ads(status, starts_at, ends_at);

-- RLS
alter table ads enable row level security;
alter table ad_events enable row level security;

-- Anyone can read live ads
create policy "live ads are public" on ads
  for select using (status = 'live');

-- Authenticated users can log events
create policy "users can log ad events" on ad_events
  for insert to authenticated with check (auth.uid() = user_id);

-- Function to atomically increment counters
create or replace function increment_ad_counter(p_ad_id uuid, p_event text)
returns void language plpgsql security definer as $$
begin
  if p_event = 'impression' then
    update ads set impressions_count = impressions_count + 1 where id = p_ad_id;
  elsif p_event = 'tap' then
    update ads set taps_count = taps_count + 1 where id = p_ad_id;
  end if;
end;
$$;
