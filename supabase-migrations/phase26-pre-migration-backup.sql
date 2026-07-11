-- Snapshot of state immediately BEFORE phase26-follow-system.sql was applied,
-- captured 2026-07-09 via the Supabase Management API. Not meant to be run
-- as-is during normal operation — this is a rollback reference only, in case
-- phase26 needs to be reverted.
--
-- Nothing destructive happened in phase26 itself (no table was dropped, no
-- rows were deleted — `friendships` is untouched and still holds this exact
-- data), so this file exists purely so the exact prior RLS wording is on
-- record without having to reconstruct it from memory.

-- ---------------------------------------------------------------------------
-- To roll back the RLS policy changes from phase26, run:
-- ---------------------------------------------------------------------------

drop policy if exists "Posts visible to public accounts or accepted followers" on posts;
create policy "Anyone can read posts" on posts for select using (true);

drop policy if exists "Watchlist visible to public accounts or accepted followers" on library;
drop policy if exists "Logged items visible to public accounts or accepted followers" on library;
drop policy if exists "Mutual follows can insert recs into each other's library" on library;

create policy "Friends can view each other's watchlist" on library
  for select using (
    status = 'watchlist'
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and ((friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id))
    )
  );

create policy "Friends can view each other's logged items" on library
  for select using (
    status <> 'watchlist'
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and ((friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id))
    )
  );

create policy "Friends can insert recs into each other's library" on library
  for insert with check (
    rec_from_user_name is not null
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and ((friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id))
    )
  );

drop policy if exists "Any authenticated user can send a direct message" on direct_messages;
create policy "Friends can send each other direct messages" on direct_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and ((friendships.user_id = auth.uid() and friendships.friend_id = direct_messages.recipient_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = direct_messages.recipient_id))
    )
  );

-- To fully remove the new schema (only if you also want to undo the
-- additive parts, not just the RLS rewiring above):
--
-- drop trigger if exists notify_on_follow_change on follows;
-- drop table if exists dm_requests;
-- drop table if exists follows;
-- alter table profiles drop column if exists is_private;

-- ---------------------------------------------------------------------------
-- Full data snapshot of `friendships` immediately before migration (8 rows,
-- untouched by phase26 — kept here only for reference/audit, not needed for
-- an actual restore since the table itself was never modified):
-- ---------------------------------------------------------------------------
-- id                                   | user_id                              | friend_id                            | status   | created_at
-- a55438e3-5868-4297-989d-3a202b724815 | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 076f136c-72d2-425b-86e0-8694380a344f | accepted | 2026-06-24 01:31:38.574036+00
-- 1f712186-c8a5-4cfd-8ce9-d18cebd43c1b | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 076f136c-72d2-425b-86e0-8694380a344f | accepted | 2026-06-24 01:39:01.02892+00
-- d5367bd6-c27c-472a-9d4f-9fd4be1c493b | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 076f136c-72d2-425b-86e0-8694380a344f | accepted | 2026-06-24 01:43:06.222106+00
-- bba2856c-2f2f-43df-8617-275cdd060394 | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 076f136c-72d2-425b-86e0-8694380a344f | accepted | 2026-06-24 01:46:39.640842+00
-- 52a8aee8-192f-4822-b367-f7feec786d1b | 076f136c-72d2-425b-86e0-8694380a344f | 4b653142-be27-4566-8385-89baaf12fc40 | accepted | 2026-06-27 16:31:10.524255+00
-- cc9dfff9-c936-4c6d-8cb7-14b34472ab04 | 6db2a4a0-377a-4695-b614-3d447b9903b0 | 076f136c-72d2-425b-86e0-8694380a344f | accepted | 2026-06-29 14:28:05.159943+00
-- 489b5e2b-04aa-40c3-9318-5d2b56b61fd7 | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 6db2a4a0-377a-4695-b614-3d447b9903b0 | pending  | 2026-07-07 06:04:22.210093+00
-- 21631343-2982-4780-8d3a-a1c0e6404d76 | 1eaf37ad-8906-4a18-bd08-052dca0b8cf9 | 4b653142-be27-4566-8385-89baaf12fc40 | pending  | 2026-07-09 00:49:15.346861+00
