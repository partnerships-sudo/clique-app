-- Phase 27: Block & Mute accounts.
--
-- Blocking and muting are one-sided, private relationships: only the
-- blocker/muter can see their own list, and the target is never told.
-- A single row per (blocker, target) pair carries both flags so a user can
-- independently toggle either one; the row is deleted once both are false
-- (mirrors how `follows` rows are deleted on unfollow rather than kept
-- around in a "false" state).

-- ---------------------------------------------------------------------------
-- 1. user_blocks
-- ---------------------------------------------------------------------------
create table if not exists user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  is_blocked boolean not null default false,
  is_muted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (blocker_id, target_id),
  check (blocker_id <> target_id)
);
create index if not exists user_blocks_blocker_id_idx on user_blocks(blocker_id);
create index if not exists user_blocks_target_id_idx on user_blocks(target_id);

alter table user_blocks enable row level security;

-- Only the blocker can ever see their own block/mute rows — the target
-- should never learn they've been blocked or muted.
drop policy if exists "Users can view their own block/mute rows" on user_blocks;
create policy "Users can view their own block/mute rows" on user_blocks
  for select using (auth.uid() = blocker_id);

drop policy if exists "Users can create their own block/mute rows" on user_blocks;
create policy "Users can create their own block/mute rows" on user_blocks
  for insert with check (auth.uid() = blocker_id);

drop policy if exists "Users can update their own block/mute rows" on user_blocks;
create policy "Users can update their own block/mute rows" on user_blocks
  for update using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);

drop policy if exists "Users can delete their own block/mute rows" on user_blocks;
create policy "Users can delete their own block/mute rows" on user_blocks
  for delete using (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------------
-- 2. A blocked target can no longer follow the blocker, and an existing
--    follow relationship in either direction is severed immediately.
-- ---------------------------------------------------------------------------
create or replace function sever_follows_on_block()
returns trigger as $$
begin
  if new.is_blocked and not coalesce(old.is_blocked, false) then
    delete from follows
    where (follower_id = new.blocker_id and followed_id = new.target_id)
       or (follower_id = new.target_id and followed_id = new.blocker_id);
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists sever_follows_on_block_trigger on user_blocks;
create trigger sever_follows_on_block_trigger
after insert or update of is_blocked on user_blocks
for each row execute function sever_follows_on_block();

drop policy if exists "Users can insert their own follow rows" on follows;
create policy "Users can insert their own follow rows" on follows
  for insert with check (
    auth.uid() = follower_id
    and not exists (
      select 1 from user_blocks b
      where b.is_blocked
        and ((b.blocker_id = follower_id and b.target_id = followed_id)
          or (b.blocker_id = followed_id and b.target_id = follower_id))
    )
    and (
      (status = 'accepted' and exists (select 1 from profiles where id = followed_id and is_private = false))
      or
      (status = 'pending' and exists (select 1 from profiles where id = followed_id and is_private = true))
    )
  );
