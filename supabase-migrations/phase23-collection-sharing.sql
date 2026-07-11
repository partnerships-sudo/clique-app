-- Phase 23: Collection sharing controls
-- Lets a user choose, per category (books vs movies/TV), whether their
-- collection is visible to others. Defaults to private (false) — sharing is
-- opt-in, never on by default. Splits the previous single "owner only"
-- collection_items policy into a select policy that also allows a friend
-- to read rows of a type the owner has explicitly made shareable, plus
-- separate write policies that stay owner-only no matter what.

alter table profiles add column if not exists collection_share_books boolean not null default false;
alter table profiles add column if not exists collection_share_movies boolean not null default false;

drop policy if exists "Users can manage their own collection" on collection_items;

create policy "Users can view their own or shared collection items" on collection_items
  for select using (
    auth.uid() = user_id
    or (
      type = 'read'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_books = true
      )
    )
    or (
      type = 'watch'
      and exists (
        select 1 from profiles p where p.id = collection_items.user_id and p.collection_share_movies = true
      )
    )
  );

create policy "Users can insert their own collection items" on collection_items
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own collection items" on collection_items
  for update using (auth.uid() = user_id);

create policy "Users can delete their own collection items" on collection_items
  for delete using (auth.uid() = user_id);
