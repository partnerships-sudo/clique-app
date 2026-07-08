-- Phase 14: Friend Recommendations
-- Adds rec attribution columns to library and an RLS policy that lets
-- an accepted friend insert a watchlist rec into your library on your behalf.

-- New columns on library
alter table library add column if not exists rec_from_user_name text;
alter table library add column if not exists rec_compat_score   integer;

-- Allow an accepted friend to INSERT a rec row into your library.
-- Gated on rec_from_user_name being set (marks it as a rec, not a plain item)
-- and on an accepted friendship existing between the two users.
drop policy if exists "Friends can insert recs into each other's library" on library;
create policy "Friends can insert recs into each other's library" on library
  for insert with check (
    rec_from_user_name is not null
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id)
        )
    )
  );
