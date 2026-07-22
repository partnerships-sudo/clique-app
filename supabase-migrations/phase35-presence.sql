-- Phase 35: Presence tracking and DM read receipts
--
-- last_seen_at: written by the client every ~60 s while the app is open.
--   Values older than 5 minutes are treated as "offline" in the UI.
--
-- dm_read_receipts: upserted whenever a user opens a DM conversation.
--   The sender checks this to show a "Read" indicator below their last message.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS show_online_status boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_read_receipts boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS dm_read_receipts (
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  counterpart_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, counterpart_id)
);
