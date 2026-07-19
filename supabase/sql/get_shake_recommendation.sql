-- Run this in the Supabase SQL Editor (dashboard → SQL Editor → New query)
-- It powers the Shake-speare feature: collaborative filtering to find something
-- the current user would like but hasn't logged yet.

CREATE OR REPLACE FUNCTION get_shake_recommendation(p_user_id UUID)
RETURNS TABLE (
  title       TEXT,
  type        TEXT,
  poster      TEXT,
  sub         TEXT,
  avg_rating  NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH
  -- Everything the current user has already logged (to exclude)
  my_logged AS (
    SELECT title, type
    FROM library
    WHERE user_id = p_user_id
  ),

  -- The user's own top-rated items (seed for finding similar users)
  my_top AS (
    SELECT title, type
    FROM library
    WHERE user_id = p_user_id
      AND rating >= 4
      AND status != 'watchlist'
  ),

  -- Other users who also rated those same items 4+ (similar taste)
  similar_users AS (
    SELECT DISTINCT l.user_id
    FROM library l
    JOIN my_top mt ON l.title = mt.title AND l.type = mt.type
    WHERE l.user_id != p_user_id
      AND l.rating >= 4
  ),

  -- Items those similar users loved that the current user hasn't seen
  collab_candidates AS (
    SELECT
      l.title,
      l.type,
      l.poster,
      l.sub,
      AVG(l.rating)  AS avg_rating,
      COUNT(*)       AS log_count
    FROM library l
    JOIN similar_users su ON l.user_id = su.user_id
    LEFT JOIN my_logged ml ON l.title = ml.title AND l.type = ml.type
    WHERE ml.title IS NULL          -- user hasn't logged it
      AND l.rating >= 4
      AND l.status != 'watchlist'
      AND l.poster IS NOT NULL      -- needs an image to display nicely
    GROUP BY l.title, l.type, l.poster, l.sub
    ORDER BY (AVG(l.rating) * LN(COUNT(*) + 1)) DESC  -- balance rating × popularity
    LIMIT 30
  ),

  -- Fallback: broadly popular items the user hasn't seen
  -- (used when there aren't enough similar users yet)
  popular_fallback AS (
    SELECT
      l.title,
      l.type,
      l.poster,
      l.sub,
      AVG(l.rating) AS avg_rating
    FROM library l
    LEFT JOIN my_logged ml ON l.title = ml.title AND l.type = ml.type
    WHERE ml.title IS NULL
      AND l.rating >= 4
      AND l.status != 'watchlist'
      AND l.poster IS NOT NULL
      AND l.user_id != p_user_id
    GROUP BY l.title, l.type, l.poster, l.sub
    HAVING COUNT(*) >= 2
    ORDER BY AVG(l.rating) DESC
    LIMIT 30
  ),

  -- Prefer collab results; fall back to popular if collab returns nothing
  final_pool AS (
    SELECT title, type, poster, sub, avg_rating FROM collab_candidates
    UNION ALL
    SELECT title, type, poster, sub, avg_rating FROM popular_fallback
    WHERE NOT EXISTS (SELECT 1 FROM collab_candidates)
  )

  SELECT title, type, poster, sub, ROUND(avg_rating, 1)
  FROM final_pool
  ORDER BY RANDOM()
  LIMIT 1;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_shake_recommendation(UUID) TO authenticated;
