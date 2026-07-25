-- Returns one row per chat thread (title) for a given set of user IDs,
-- avoiding the 500-row full fetch the client currently does.
-- Deploy in Supabase dashboard → SQL Editor → Run.

create or replace function get_chat_threads(user_ids uuid[])
returns table (
  title        text,
  post_type    text,
  last_user_id uuid,
  last_user    text,
  last_text    text,
  last_time    timestamptz
)
language sql
stable
as $$
  select distinct on (m.title)
    m.title,
    m.post_type,
    m.user_id   as last_user_id,
    m.user_name as last_user,
    m.content   as last_text,
    m.created_at as last_time
  from messages m
  where m.user_id = any(user_ids)
  order by m.title, m.created_at desc;
$$;
