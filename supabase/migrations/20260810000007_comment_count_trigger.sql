-- Trigger to keep discussions.comment_count in sync automatically
-- SECURITY DEFINER bypasses RLS so any user's comment increments/decrements correctly

CREATE OR REPLACE FUNCTION sync_discussion_comment_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions
      SET comment_count = comment_count + 1
      WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions
      SET comment_count = GREATEST(0, comment_count - 1)
      WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_discussion_comment_count ON discussion_comments;
CREATE TRIGGER trg_discussion_comment_count
  AFTER INSERT OR DELETE ON discussion_comments
  FOR EACH ROW EXECUTE FUNCTION sync_discussion_comment_count();
