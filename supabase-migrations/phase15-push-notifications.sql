-- Phase 15: Push Notifications
-- Stores each device's Expo push token and per-category notification
-- preferences so the app can send push notifications for messages,
-- friend requests, reactions, and recommendations.

create table if not exists push_tokens (
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table push_tokens enable row level security;

drop policy if exists "Users can manage their own push tokens" on push_tokens;
create policy "Users can manage their own push tokens" on push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Any authenticated user can read push tokens" on push_tokens;
create policy "Any authenticated user can read push tokens" on push_tokens
  for select using (auth.role() = 'authenticated');

create table if not exists notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  messages boolean not null default true,
  friend_requests boolean not null default true,
  reactions boolean not null default true,
  recommendations boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table notification_settings enable row level security;

drop policy if exists "Users can manage their own notification settings" on notification_settings;
create policy "Users can manage their own notification settings" on notification_settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Any authenticated user can read notification settings" on notification_settings;
create policy "Any authenticated user can read notification settings" on notification_settings
  for select using (auth.role() = 'authenticated');
