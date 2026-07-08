-- Fix: infinite recursion in group_chat_members RLS.
-- Policies that check "is the caller a member of this group?" were querying
-- group_chat_members from within a group_chat_members policy, causing a loop.
-- Solution: a SECURITY DEFINER helper that bypasses RLS when called.

create or replace function is_group_member(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from group_chat_members
    where chat_id = p_chat_id and user_id = p_user_id
  );
$$;

-- Re-create all three policies that touch group_chat_members

-- group_chat_members: any member can see all rows for their groups
drop policy if exists "Members can view group membership" on group_chat_members;
create policy "Members can view group membership" on group_chat_members
  for select using (
    is_group_member(chat_id, auth.uid())
  );

-- group_chats: members can read the chat row
drop policy if exists "Members can view group chats" on group_chats;
create policy "Members can view group chats" on group_chats
  for select using (
    is_group_member(id, auth.uid())
  );

-- group_chat_messages: members can read messages
drop policy if exists "Members can read group messages" on group_chat_messages;
create policy "Members can read group messages" on group_chat_messages
  for select using (
    is_group_member(chat_id, auth.uid())
  );

-- group_chat_messages: members can send messages
drop policy if exists "Members can send group messages" on group_chat_messages;
create policy "Members can send group messages" on group_chat_messages
  for insert with check (
    user_id = auth.uid()
    and is_group_member(chat_id, auth.uid())
  );
