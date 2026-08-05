-- phase45: content room follows
-- Lets users follow a content room (external_id + media_type) to get new-discussion notifications
-- and see room activity in their Community feed.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists content_room_follows (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  external_id text not null,
  media_type  text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, external_id, media_type)
);

alter table content_room_follows enable row level security;

create policy "room_follows_select" on content_room_follows
  for select using (auth.uid() = user_id);

create policy "room_follows_insert" on content_room_follows
  for insert with check (auth.uid() = user_id);

create policy "room_follows_delete" on content_room_follows
  for delete using (auth.uid() = user_id);

-- ── Notification trigger ──────────────────────────────────────────────────────
-- When a new discussion is created for a piece of content, notify all followers
-- of that content room (excluding the author).

drop trigger if exists notify_on_room_discussion on discussions;
create trigger notify_on_room_discussion
  after insert on discussions
  for each row execute function notify_webhook();
