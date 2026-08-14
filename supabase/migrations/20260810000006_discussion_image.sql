-- Add image_url column to discussions for user-uploaded photos
alter table discussions add column if not exists image_url text;

-- Storage bucket for discussion images (idempotent)
insert into storage.buckets (id, name, public)
values ('discussion-images', 'discussion-images', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload to their own folder
drop policy if exists "Users can upload discussion images" on storage.objects;
create policy "Users can upload discussion images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'discussion-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read
drop policy if exists "Public read discussion images" on storage.objects;
create policy "Public read discussion images"
  on storage.objects for select
  to public
  using (bucket_id = 'discussion-images');

-- Allow users to delete their own uploads
drop policy if exists "Users can delete own discussion images" on storage.objects;
create policy "Users can delete own discussion images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'discussion-images' AND (storage.foldername(name))[1] = auth.uid()::text);
