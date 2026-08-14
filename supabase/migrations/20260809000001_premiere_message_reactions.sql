create table if not exists premiere_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid references premiere_messages(id) on delete cascade not null,
  premiere_id uuid references premieres(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

alter table premiere_message_reactions enable row level security;

drop policy if exists "Anyone can read reactions" on premiere_message_reactions;
create policy "Anyone can read reactions"
  on premiere_message_reactions for select using (true);

drop policy if exists "Users can insert their own reactions" on premiere_message_reactions;
create policy "Users can insert their own reactions"
  on premiere_message_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own reactions" on premiere_message_reactions;
create policy "Users can delete their own reactions"
  on premiere_message_reactions for delete
  using (auth.uid() = user_id);

create index premiere_message_reactions_premiere_id_idx
  on premiere_message_reactions(premiere_id);

create index premiere_message_reactions_message_id_idx
  on premiere_message_reactions(message_id);
