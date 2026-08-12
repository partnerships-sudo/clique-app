-- Add watched_with column to posts (array of user IDs tagged as co-watchers)
alter table posts add column if not exists watched_with uuid[] default '{}';
