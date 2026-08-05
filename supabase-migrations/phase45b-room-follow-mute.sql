-- phase45b: add muted flag to content_room_follows
-- Lets users follow a room for the feed without receiving push notifications.

alter table content_room_follows
  add column if not exists muted boolean not null default false;

-- Allow users to update their own follow rows (to toggle mute)
create policy "room_follows_update" on content_room_follows
  for update using (auth.uid() = user_id);
