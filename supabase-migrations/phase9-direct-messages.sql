-- Private 1:1 DMs between friends, separate from the content-bound `messages` threads.
create table if not exists direct_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists direct_messages_sender_idx on direct_messages(sender_id);
create index if not exists direct_messages_recipient_idx on direct_messages(recipient_id);

alter table direct_messages enable row level security;

drop policy if exists "Users can read their own direct messages" on direct_messages;
create policy "Users can read their own direct messages" on direct_messages
  for select using (sender_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "Friends can send each other direct messages" on direct_messages;
create policy "Friends can send each other direct messages" on direct_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from friendships
      where status = 'accepted'
        and (
          (friendships.user_id = auth.uid() and friendships.friend_id = direct_messages.recipient_id)
          or (friendships.friend_id = auth.uid() and friendships.user_id = direct_messages.recipient_id)
        )
    )
  );
