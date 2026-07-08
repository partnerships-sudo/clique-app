-- Group chats: named or unnamed group conversations between friends

create table if not exists group_chats (
  id         uuid primary key default gen_random_uuid(),
  name       text,
  created_by uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null
);

create table if not exists group_chat_members (
  chat_id   uuid references group_chats(id) on delete cascade not null,
  user_id   uuid references profiles(id) on delete cascade not null,
  joined_at timestamptz default now() not null,
  primary key (chat_id, user_id)
);

create table if not exists group_chat_messages (
  id         uuid primary key default gen_random_uuid(),
  chat_id    uuid references group_chats(id) on delete cascade not null,
  user_id    uuid references profiles(id) on delete cascade not null,
  text       text not null,
  created_at timestamptz default now() not null
);

-- RLS
alter table group_chats         enable row level security;
alter table group_chat_members  enable row level security;
alter table group_chat_messages enable row level security;

-- group_chats
drop policy if exists "Members can view group chats" on group_chats;
create policy "Members can view group chats" on group_chats
  for select using (
    exists (select 1 from group_chat_members where chat_id = group_chats.id and user_id = auth.uid())
  );

drop policy if exists "Users can create group chats" on group_chats;
create policy "Users can create group chats" on group_chats
  for insert with check (created_by = auth.uid());

-- group_chat_members
drop policy if exists "Members can view group membership" on group_chat_members;
create policy "Members can view group membership" on group_chat_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from group_chat_members gcm2
      where gcm2.chat_id = group_chat_members.chat_id and gcm2.user_id = auth.uid()
    )
  );

drop policy if exists "Creators can add members" on group_chat_members;
create policy "Creators can add members" on group_chat_members
  for insert with check (
    exists (select 1 from group_chats where id = chat_id and created_by = auth.uid())
    or user_id = auth.uid()
  );

-- group_chat_messages
drop policy if exists "Members can read group messages" on group_chat_messages;
create policy "Members can read group messages" on group_chat_messages
  for select using (
    exists (select 1 from group_chat_members where chat_id = group_chat_messages.chat_id and user_id = auth.uid())
  );

drop policy if exists "Members can send group messages" on group_chat_messages;
create policy "Members can send group messages" on group_chat_messages
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from group_chat_members where chat_id = group_chat_messages.chat_id and user_id = auth.uid())
  );
