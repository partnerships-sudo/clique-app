-- Phase 40: Per-post comments with upvotes and threading

CREATE TABLE post_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content     text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 500),
  parent_id   uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX post_comments_post_id_idx    ON post_comments (post_id);
CREATE INDEX post_comments_parent_id_idx  ON post_comments (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX post_comments_user_id_idx    ON post_comments (user_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all"    ON post_comments FOR SELECT USING (true);
CREATE POLICY "insert own"  ON post_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own"  ON post_comments FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE post_comment_upvotes (
  comment_id  uuid REFERENCES post_comments(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES profiles(id)    ON DELETE CASCADE NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE post_comment_upvotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read all"         ON post_comment_upvotes FOR SELECT USING (true);
CREATE POLICY "insert own"       ON post_comment_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own"       ON post_comment_upvotes FOR DELETE USING (auth.uid() = user_id);

-- notification_settings: add reactions category for post comments
-- (reuses the 'reactions' toggle — already exists, no migration needed)
