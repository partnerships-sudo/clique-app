-- phase47: spoiler flag on discussion comments
-- Lets commenters mark replies as spoilers — blurred until tapped on the detail screen.

alter table discussion_comments
  add column if not exists is_spoiler boolean not null default false;
