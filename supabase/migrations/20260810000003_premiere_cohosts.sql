-- Co-hosts for watch parties
-- Only the host can add co-hosts; co-hosts can start/end the party and moderate chat

create table if not exists premiere_cohosts (
  id              uuid primary key default gen_random_uuid(),
  premiere_id     uuid not null references premieres(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  invited_by      uuid not null references auth.users(id) on delete cascade,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at      timestamptz not null default now(),
  unique (premiere_id, user_id)
);

-- Hosts can manage their own party's co-hosts; co-hosts can see their own row
alter table premiere_cohosts enable row level security;

create policy "Host can manage cohosts"
  on premiere_cohosts for all
  using (
    exists (
      select 1 from premieres
      where premieres.id = premiere_cohosts.premiere_id
        and premieres.host_user_id = auth.uid()
    )
  );

create policy "Cohost can read and update own row"
  on premiere_cohosts for all
  using (premiere_cohosts.user_id = auth.uid());

create policy "Members can read cohosts"
  on premiere_cohosts for select
  using (
    exists (
      select 1 from premiere_members
      where premiere_members.premiere_id = premiere_cohosts.premiere_id
        and premiere_members.user_id = auth.uid()
    )
  );
