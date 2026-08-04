-- Phase 42: Community Discussions (Reddit-style boards)
--
-- discussions     — the top-level post (title, body, type, optional content link)
-- discussion_votes — one row per user per discussion; triggers keep upvote_count in sync
-- discussion_comments — threaded comments on a discussion

-- ── 1. discussions ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discussions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 300),
  body                text        CHECK (char_length(body) <= 10000),
  type                text        NOT NULL DEFAULT 'general'
                                  CHECK (type IN ('read','watch','tv','play','listen','podcast','general')),
  -- optional linked content
  content_title       text,
  content_poster      text,
  content_external_id text,
  content_media_type  text,
  -- counters (maintained by triggers)
  upvote_count        integer     NOT NULL DEFAULT 0,
  comment_count       integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussions_created_at_idx ON discussions (created_at DESC);
CREATE INDEX IF NOT EXISTS discussions_type_idx       ON discussions (type);
CREATE INDEX IF NOT EXISTS discussions_user_id_idx    ON discussions (user_id);

-- RLS
ALTER TABLE discussions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "discussions_select" ON discussions
  FOR SELECT USING (true);

CREATE POLICY "discussions_insert" ON discussions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "discussions_delete" ON discussions
  FOR DELETE USING (auth.uid() = user_id);

-- ── 2. discussion_votes ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discussion_votes (
  discussion_id uuid NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (discussion_id, user_id)
);

ALTER TABLE discussion_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "votes_select" ON discussion_votes
  FOR SELECT USING (true);

CREATE POLICY "votes_insert" ON discussion_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "votes_delete" ON discussion_votes
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: keep upvote_count in sync
CREATE OR REPLACE FUNCTION sync_discussion_upvote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions SET upvote_count = upvote_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_discussion_votes ON discussion_votes;
CREATE TRIGGER trg_discussion_votes
  AFTER INSERT OR DELETE ON discussion_votes
  FOR EACH ROW EXECUTE FUNCTION sync_discussion_upvote_count();

-- ── 3. discussion_comments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discussion_comments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id uuid        NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  body          text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
  parent_id     uuid        REFERENCES discussion_comments(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS discussion_comments_discussion_idx ON discussion_comments (discussion_id, created_at);
CREATE INDEX IF NOT EXISTS discussion_comments_parent_idx     ON discussion_comments (parent_id) WHERE parent_id IS NOT NULL;

ALTER TABLE discussion_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON discussion_comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert" ON discussion_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete" ON discussion_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger: keep comment_count in sync
CREATE OR REPLACE FUNCTION sync_discussion_comment_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE discussions SET comment_count = comment_count + 1 WHERE id = NEW.discussion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE discussions SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.discussion_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_discussion_comments ON discussion_comments;
CREATE TRIGGER trg_discussion_comments
  AFTER INSERT OR DELETE ON discussion_comments
  FOR EACH ROW EXECUTE FUNCTION sync_discussion_comment_count();
