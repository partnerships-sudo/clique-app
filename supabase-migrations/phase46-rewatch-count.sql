-- phase46: rewatch / re-read count on posts
-- Adds watch_count to posts so "2nd watch · ★★★★★" is displayable on feed cards.
-- The column is set at insert time by the client (count of prior posts for this
-- title + 1), so no trigger is needed. Existing posts default to 1.

alter table posts
  add column if not exists watch_count int not null default 1
    check (watch_count >= 1);
