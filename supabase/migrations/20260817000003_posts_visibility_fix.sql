-- `posts` carried four SELECT policies. RLS ORs them together, so the loosest
-- one defines what is actually readable, and two of them were too loose.
--
-- 1. "Public posts are readable by all authenticated users" granted every post
--    with visibility='everyone' to any signed-in user, ignoring is_private and
--    follow status. Since visibility defaults to 'everyone' (feed/api.ts), this
--    made private accounts readable by any logged-in user — the private-account
--    feature did not work.
--
-- 2. "Close friends posts readable by author and close friends" tested the
--    close-friends relationship backwards: close_friends.user_id = auth.uid()
--    AND friend_id = posts.user_id, i.e. "I added the author to MY list".
--    Anyone can insert their own close_friends rows, so a viewer could grant
--    themselves access to another user's close-friends-only posts.
--
-- "Posts visible respecting close-friends visibility" already expresses the
-- intended model correctly and covers every legitimate case:
--   - the author
--   - visibility='everyone' from a public profile (also readable logged-out,
--     which the web /[username] and /post routes depend on)
--   - visibility='everyone' from a private profile, for accepted followers
--   - visibility='close_friends', for people the AUTHOR listed
--
-- So the other three are redundant at best and holes at worst.

drop policy if exists "Public posts are readable by all authenticated users" on public.posts;
drop policy if exists "Close friends posts readable by author and close friends" on public.posts;
drop policy if exists "Close friends posts readable by author" on public.posts;
