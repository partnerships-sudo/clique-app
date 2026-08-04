-- Phase 41: get_most_reviewed RPC
--
-- Returns the most-logged titles globally, grouped by title+type,
-- ordered by log count descending. Used by the Global tab's
-- "Most Reviewed" section. Accepts an optional since_date to filter
-- by week / month / year; NULL means all time.

CREATE OR REPLACE FUNCTION get_most_reviewed(since_date timestamptz DEFAULT NULL)
RETURNS TABLE (
  title        text,
  type         text,
  poster       text,
  sub          text,
  external_id  text,
  media_type   text,
  count        bigint,
  avg_rating   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    p.title,
    p.type,
    MAX(p.poster)        AS poster,
    MAX(p.sub)           AS sub,
    MAX(p.external_id)   AS external_id,
    MAX(p.media_type)    AS media_type,
    COUNT(*)             AS count,
    AVG(p.rating)        AS avg_rating
  FROM posts p
  WHERE
    (since_date IS NULL OR p.created_at >= since_date)
    AND p.visibility IN ('public', 'friends', 'everyone')
  GROUP BY p.title, p.type
  ORDER BY count DESC
  LIMIT 50;
$$;
