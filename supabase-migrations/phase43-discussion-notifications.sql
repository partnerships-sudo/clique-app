-- phase43-discussion-notifications.sql
-- Adds push notification support for discussion activity:
--   • New comment on your discussion
--   • Reply to your comment in a discussion
--   • New comment on a discussion you've previously commented on
--
-- Also adds a `discussions` column to notification_settings so users
-- can opt out of discussion notifications independently.

-- 1. Add the discussions toggle to notification_settings
alter table notification_settings
  add column if not exists discussions boolean not null default true;

-- 2. Trigger: fire the existing notify_webhook function after each new
--    discussion comment. The edge function switch statement handles routing.
drop trigger if exists notify_on_discussion_comment on discussion_comments;
create trigger notify_on_discussion_comment
  after insert on discussion_comments
  for each row execute function notify_webhook();
