-- RLS policies for the posts table
-- Run once in the Supabase SQL editor

alter table posts enable row level security;

-- Anyone can read public (everyone) posts
create policy "Public posts are readable by all authenticated users"
  on posts for select
  using (auth.role() = 'authenticated' and visibility = 'everyone');

-- Close-friends posts readable only by the author and their followers
-- (enforced further at the application layer via useCloseFriendsPosts)
create policy "Close friends posts readable by author"
  on posts for select
  using (auth.uid() = user_id);

-- Users can only insert their own posts
create policy "Users can insert own posts"
  on posts for insert
  with check (auth.uid() = user_id);

-- Users can only update their own posts
create policy "Users can update own posts"
  on posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Users can only delete their own posts
create policy "Users can delete own posts"
  on posts for delete
  using (auth.uid() = user_id);
