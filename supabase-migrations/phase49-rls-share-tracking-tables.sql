-- phase49: enable RLS on the three share/view tracking tables
--
-- Audit finding: these were the only tables in the public schema with
-- rowsecurity = false. Because the anon key ships in the app bundle by
-- design, a table without RLS is readable and writable by anyone who
-- extracts that key — they could enumerate who viewed which replay, or
-- insert/delete rows to distort the host's analytics.
--
-- Verify before and after with:
--   SELECT tablename, rowsecurity FROM pg_tables
--   WHERE schemaname = 'public' AND rowsecurity = false;
--
-- SELECT stays open (USING true) because the watch-party and screening-room
-- analytics screens read these as aggregate counts, matching the existing
-- "read all" convention used by post_comments, discussions and votes.
-- Writes are restricted to the authenticated owner of the row.
--
-- Idempotent: safe to re-run.

-- ── premiere_shares ──────────────────────────────────────────────────────────
alter table premiere_shares enable row level security;

drop policy if exists "read all"   on premiere_shares;
drop policy if exists "insert own" on premiere_shares;

create policy "read all"   on premiere_shares for select using (true);
create policy "insert own" on premiere_shares for insert with check (auth.uid() = user_id);

-- ── premiere_replay_views ────────────────────────────────────────────────────
-- useTrackReplayView() upserts, so this needs UPDATE as well as INSERT.
alter table premiere_replay_views enable row level security;

drop policy if exists "read all"   on premiere_replay_views;
drop policy if exists "insert own" on premiere_replay_views;
drop policy if exists "update own" on premiere_replay_views;

create policy "read all"   on premiere_replay_views for select using (true);
create policy "insert own" on premiere_replay_views for insert with check (auth.uid() = user_id);
create policy "update own" on premiere_replay_views for update using (auth.uid() = user_id)
                                                        with check (auth.uid() = user_id);

-- ── screening_room_shares ────────────────────────────────────────────────────
alter table screening_room_shares enable row level security;

drop policy if exists "read all"   on screening_room_shares;
drop policy if exists "insert own" on screening_room_shares;

create policy "read all"   on screening_room_shares for select using (true);
create policy "insert own" on screening_room_shares for insert with check (auth.uid() = user_id);
