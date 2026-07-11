alter table collection_items drop constraint if exists collection_items_type_check;
alter table collection_items add constraint collection_items_type_check
  check (type = any (array['read', 'watch', 'listen']));

alter table collection_items drop constraint if exists collection_items_format_check;
alter table collection_items add constraint collection_items_format_check
  check (format = any (array['book', 'dvd', 'bluray', '4k', 'cd', 'vinyl']));

alter table profiles add column if not exists collection_share_music boolean not null default false;

drop policy if exists "Users can view their own or shared collection items" on collection_items;
create policy "Users can view their own or shared collection items" on collection_items
  for select using (
    auth.uid() = user_id
    or (type = 'read' and exists (select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_books = true))
    or (type = 'watch' and exists (select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_movies = true))
    or (type = 'listen' and exists (select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_music = true))
  );
