-- Add current_page to library for book reading progress
alter table library add column if not exists current_page integer null;
