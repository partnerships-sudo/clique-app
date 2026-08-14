-- Add ON DELETE CASCADE to tables that pre-date the migrations folder and were
-- therefore missed by 20260813000002_cascade_deletes.sql.

-- collection_items
ALTER TABLE collection_items DROP CONSTRAINT IF EXISTS collection_items_user_id_fkey;
ALTER TABLE collection_items ADD CONSTRAINT collection_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussions (author)
ALTER TABLE discussions DROP CONSTRAINT IF EXISTS discussions_user_id_fkey;
ALTER TABLE discussions ADD CONSTRAINT discussions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussion_comments
ALTER TABLE discussion_comments DROP CONSTRAINT IF EXISTS discussion_comments_user_id_fkey;
ALTER TABLE discussion_comments ADD CONSTRAINT discussion_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussion_votes
ALTER TABLE discussion_votes DROP CONSTRAINT IF EXISTS discussion_votes_user_id_fkey;
ALTER TABLE discussion_votes ADD CONSTRAINT discussion_votes_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- group_chats (membership rows)
ALTER TABLE group_chats DROP CONSTRAINT IF EXISTS group_chats_user_id_fkey;
ALTER TABLE group_chats ADD CONSTRAINT group_chats_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- list_items
ALTER TABLE list_items DROP CONSTRAINT IF EXISTS list_items_user_id_fkey;
ALTER TABLE list_items ADD CONSTRAINT list_items_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
