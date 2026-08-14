-- Rec read receipts: track when a recipient first taps a recommendation card
ALTER TABLE messages ADD COLUMN IF NOT EXISTS rec_read_at timestamptz DEFAULT NULL;

-- Only the recipient (anyone who is not the sender) marks it; index for sender lookups
CREATE INDEX IF NOT EXISTS idx_messages_rec_read_at ON messages (id) WHERE rec_read_at IS NOT NULL;
