-- Allow hosts to delete their own premieres
create policy "hosts can delete their premieres"
on premieres for delete
using (host_user_id = auth.uid());

-- Allow hosts to delete all members of their premiere
create policy "hosts can delete premiere members"
on premiere_members for delete
using (
  exists (
    select 1 from premieres
    where premieres.id = premiere_members.premiere_id
      and premieres.host_user_id = auth.uid()
  )
);

-- Allow hosts to delete all messages in their premiere
create policy "hosts can delete premiere messages"
on premiere_messages for delete
using (
  exists (
    select 1 from premieres
    where premieres.id = premiere_messages.premiere_id
      and premieres.host_user_id = auth.uid()
  )
);
