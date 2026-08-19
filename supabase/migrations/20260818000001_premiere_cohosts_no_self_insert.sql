-- "Cohost can read and update own row" was FOR ALL with only a USING clause.
-- When WITH CHECK is omitted, Postgres reuses USING as the insert check, so the
-- policy permitted INSERT of a row where user_id = auth.uid() for ANY
-- premiere_id — any user could appoint themselves cohost of anyone's premiere.
--
-- The app never does this: useInviteCoHost is run by the host and inserts a row
-- for the invited friend (user_id = friendId), which "Host can manage cohosts"
-- already covers. A cohost only ever needs to read their row, update its status
-- when responding to the invite, and delete it to step down.
--
-- Splitting the FOR ALL into explicit verbs removes the insert path while
-- keeping every legitimate flow.

drop policy if exists "Cohost can read and update own row" on public.premiere_cohosts;

create policy "Cohost can read own row"
  on public.premiere_cohosts for select to authenticated
  using (user_id = auth.uid());

-- WITH CHECK repeats the condition so a cohost cannot reassign their row to a
-- different user or premiere while updating it.
create policy "Cohost can respond to own invite"
  on public.premiere_cohosts for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Cohost can step down"
  on public.premiere_cohosts for delete to authenticated
  using (user_id = auth.uid());
