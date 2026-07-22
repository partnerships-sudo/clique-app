-- Run this in the Supabase SQL Editor (dashboard → SQL Editor → New query)
-- Atomically rates a library item, inserts it into collection_items, deletes it
-- from library, and updates the matching post rating — all in one transaction.

CREATE OR REPLACE FUNCTION rate_and_move_to_collection(
  p_library_id  UUID,
  p_user_id     UUID,
  p_type        TEXT,
  p_title       TEXT,
  p_sub         TEXT,
  p_poster      TEXT,
  p_external_id TEXT,
  p_media_type  TEXT,
  p_ext_rating  TEXT,
  p_rating      NUMERIC
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO collection_items (
    user_id, type, format, title, sub, poster,
    external_id, media_type, ext_rating, user_rating
  ) VALUES (
    p_user_id, p_type, null, p_title, p_sub, p_poster,
    p_external_id, p_media_type, p_ext_rating, p_rating
  );

  DELETE FROM library WHERE id = p_library_id;

  UPDATE posts
  SET rating = p_rating
  WHERE user_id = p_user_id
    AND title   = p_title
    AND type    = p_type;
END;
$$;

GRANT EXECUTE ON FUNCTION rate_and_move_to_collection(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC) TO authenticated;
