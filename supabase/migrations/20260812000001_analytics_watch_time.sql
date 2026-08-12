-- Analytics: per-member watch time tracking for watch parties and screening rooms
-- Run in Supabase SQL editor: Dashboard → SQL Editor → paste and run

-- Watch parties (premieres)
alter table premiere_members
  add column if not exists joined_at  timestamptz,
  add column if not exists left_at    timestamptz,
  add column if not exists watch_ms   bigint generated always as (
    case
      when joined_at is not null and left_at is not null
      then extract(epoch from (left_at - joined_at)) * 1000
      else null
    end
  ) stored;

-- Add peak_viewer_count to premieres if missing
alter table premieres
  add column if not exists peak_viewer_count int default 0;

-- Screening rooms (already has peak_viewer_count)
alter table screening_room_members
  add column if not exists joined_at  timestamptz,
  add column if not exists left_at    timestamptz,
  add column if not exists watch_ms   bigint generated always as (
    case
      when joined_at is not null and left_at is not null
      then extract(epoch from (left_at - joined_at)) * 1000
      else null
    end
  ) stored;

-- RPC: atomically bump peak_viewer_count when current count exceeds stored peak
create or replace function update_premiere_peak_viewers(p_premiere_id uuid, p_count int)
returns void language sql security definer as $$
  update premieres
     set peak_viewer_count = greatest(peak_viewer_count, p_count)
   where id = p_premiere_id;
$$;
