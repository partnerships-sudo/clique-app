-- Fix: group creation fails because the INSERT policy on group_chat_members
-- checks group_chats to verify the creator, but the group_chats SELECT policy
-- blocks it (no members exist yet when the first batch is inserted).
--
-- Two fixes:
-- 1. SECURITY DEFINER function to check group ownership without hitting RLS.
-- 2. group_chats SELECT policy also lets the creator see their own groups.

create or replace function is_group_creator(p_chat_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from group_chats
    where id = p_chat_id and created_by = p_user_id
  );
$$;

-- group_chat_members INSERT: use definer function so it doesn't hit RLS
drop policy if exists "Creators can add members" on group_chat_members;
create policy "Creators can add members" on group_chat_members
  for insert with check (
    is_group_creator(chat_id, auth.uid())
    or user_id = auth.uid()
  );

-- group_chats SELECT: creator can always read their own group
drop policy if exists "Members can view group chats" on group_chats;
create policy "Members can view group chats" on group_chats
  for select using (
    created_by = auth.uid()
    or is_group_member(id, auth.uid())
  );
