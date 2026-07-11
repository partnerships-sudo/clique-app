-- Phase 19: Profile banner image
-- Lets a user pick a wide banner photo shown behind their profile card.
-- Reuses the existing public `avatars` storage bucket and its per-user-folder
-- RLS policies (phase4-extras.sql) — banners are stored at
-- `${user_id}/banner.jpg`, same folder convention as the avatar upload, so
-- no new bucket or policy is needed.

alter table profiles add column if not exists banner_url text;
