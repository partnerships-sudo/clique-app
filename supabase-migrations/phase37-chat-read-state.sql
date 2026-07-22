-- Phase 37: Server-side read state for chats, groups, and DMs.
--
-- Replaces AsyncStorage so read state survives reinstalls and new devices.
-- thread_type: 'chat' = content channel (by title), 'group' = group chat,
--              'dm' = direct message thread (by counterpart user_id).

CREATE TABLE IF NOT EXISTS chat_read_state (
  user_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_key   text NOT NULL,
  thread_type  text NOT NULL CHECK (thread_type IN ('chat', 'group', 'dm')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_key, thread_type)
);
