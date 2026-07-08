-- Users can update their own posts (needed to write rating back to the feed
-- when a library item is rated after the initial log).
drop policy if exists "Users can update own posts" on posts;
create policy "Users can update own posts" on posts
  for update using (user_id = auth.uid());
