-- Let friends see each other's watchlist items (for the "Friend Recs" tab),
-- without exposing logged/finished items or non-friends' data.
drop policy if exists "Friends can view each other's watchlist" on library;
create policy "Friends can view each other's watchlist" on library
  for select using (
    status = 'watchlist'
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id)
        )
    )
  );
