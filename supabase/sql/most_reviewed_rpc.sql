-- RPC: get_most_reviewed
-- Aggregates post counts and average ratings server-side, returning only the top 20 rows.
-- Replaces the client-side approach of fetching up to 500 raw posts.
--
-- Run in Supabase SQL Editor, then update the client to call:
--   supabase.rpc('get_most_reviewed', { since_date: '2026-01-01' })

create or replace function get_most_reviewed(since_date timestamptz default null)
returns table (
  title        text,
  type         text,
  poster       text,
  sub          text,
  external_id  text,
  media_type   text,
  count        bigint,
  avg_rating   numeric
)
language sql
stable
as $$
  select
    p.title,
    p.type,
    max(p.poster)       as poster,
    max(p.sub)          as sub,
    max(p.external_id)  as external_id,
    max(p.media_type)   as media_type,
    count(*)            as count,
    case when count(p.rating) > 0
      then round(avg(p.rating)::numeric, 2)
      else null
    end                 as avg_rating
  from posts p
  where
    p.title is not null
    and p.visibility = 'everyone'
    and (since_date is null or p.created_at >= since_date)
  group by p.title, p.type
  order by count desc
  limit 20;
$$;
