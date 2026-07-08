-- Allow any existing group member to add new members (not just the creator).
-- is_group_member is SECURITY DEFINER so it won't cause recursion.
drop policy if exists "Creators can add members" on group_chat_members;
create policy "Members can add new members" on group_chat_members
  for insert with check (
    is_group_member(chat_id, auth.uid())
    or user_id = auth.uid()
  );
