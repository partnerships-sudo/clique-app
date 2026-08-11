-- Add format column to discussions so hot_take vs discussion vs poll is persisted
alter table discussions
  add column if not exists format text not null default 'discussion'
    check (format in ('discussion', 'poll', 'hot_take'));
