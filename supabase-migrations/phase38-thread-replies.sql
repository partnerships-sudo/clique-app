-- Phase 38: Thread replies — adds parent_id to messages so top-level posts
-- can have threaded replies. NULL parent_id = a top-level post.
-- Replies reference their parent message within the same title/post_type thread.

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES messages(id) ON DELETE CASCADE;

-- Index for fetching all replies to a given parent efficiently.
CREATE INDEX IF NOT EXISTS messages_parent_id_idx ON messages (parent_id)
  WHERE parent_id IS NOT NULL;

-- Policy: replies are readable by the same rules as top-level messages.
-- (No new RLS needed — the existing messages policies already cover all rows.)
