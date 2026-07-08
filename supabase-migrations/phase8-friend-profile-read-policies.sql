-- The friend-profile screen needs to read a friend's full logged history
-- (not just their watchlist, which phase5 already covers) and an accurate
-- total friend count for that friend, not just the slice of friendships
-- that happen to involve the viewer.

drop policy if exists "Friends can view each other's logged items" on library;
create policy "Friends can view each other's logged items" on library
  for select using (
    status != 'watchlist'
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = library.user_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = library.user_id)
        )
    )
  );

drop policy if exists "Authenticated users can view friend counts" on friendships;
create policy "Authenticated users can view friend counts" on friendships
  for select using (auth.uid() is not null);
