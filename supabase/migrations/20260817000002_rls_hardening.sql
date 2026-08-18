-- RLS fixes applied by hand in the dashboard on 2026-08-17, recorded here so a
-- rebuild or a fresh environment doesn't silently reopen them.
--
-- Follows the existing convention of DROP POLICY IF EXISTS before CREATE POLICY
-- so the file can be re-run safely.

-- ── ads ──────────────────────────────────────────────────────────────────────
-- "admin can update ads" was granted to `public` with USING/WITH CHECK of true,
-- so any caller holding the bundled anon key could rewrite any ad — including
-- cta_url, which controls where "Watch Trailer" sends people. "brands can submit
-- ads" likewise let anyone insert rows as long as status = 'pending'.
--
-- Ads are managed by us through the dashboard, which uses the service role and
-- bypasses RLS. So the table needs no write policies at all: reads stay public,
-- writes become service-role only.
drop policy if exists "admin can update ads" on public.ads;
drop policy if exists "brands can submit ads" on public.ads;

-- ── messages ─────────────────────────────────────────────────────────────────
-- SELECT was `true` for `public`, exposing every title-chat transcript to
-- unauthenticated callers. INSERT only checked that a session existed, never
-- that user_id matched it, so any account could post as any other user.
drop policy if exists "Anyone can read messages" on public.messages;
drop policy if exists "Logged in users can insert messages" on public.messages;

create policy "Logged in users can read messages"
  on public.messages for select to authenticated
  using (true);

create policy "Users can insert their own messages"
  on public.messages for insert to authenticated
  with check (user_id = auth.uid());

-- ── notifications ────────────────────────────────────────────────────────────
-- INSERT checked only `auth.uid() IS NOT NULL`, leaving from_user_id
-- unconstrained: any account could send a notification appearing to come from
-- anyone else, with arbitrary message text.
--
-- Recipients are deliberately unconstrained — following someone or liking their
-- post legitimately notifies a stranger. Only the sender identity is pinned.
drop policy if exists "Logged in users can insert notifications" on public.notifications;

create policy "Users can send notifications as themselves"
  on public.notifications for insert to authenticated
  with check (from_user_id = auth.uid());
