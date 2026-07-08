-- Fixes: tapping "Accept" or "Decline" on an incoming friend request does
-- nothing. Root cause: the friendships RLS policies likely only let the
-- request SENDER (user_id) update/delete the row, but accepting/declining
-- is done by the RECIPIENT (friend_id). Supabase doesn't error in this case
-- — the update/delete just matches zero rows and "succeeds" silently.

create policy "Recipients can respond to friend requests"
on friendships
for update
using (friend_id = auth.uid())
with check (friend_id = auth.uid());

create policy "Recipients can decline friend requests"
on friendships
for delete
using (friend_id = auth.uid());
