-- Phase 29: Close-Friends-only post visibility.
--
-- A post can be shared to "everyone" (existing public/accepted-follower
-- rule) or restricted to just the poster's Close Friends list (phase28's
-- close_friends table). Membership on that list already implies a mutual
-- follow (see close-friends-settings.tsx, which only lists mutual follows
-- as candidates), so no separate follow check is needed for the
-- close_friends branch below.

alter table posts add column if not exists visibility text not null default 'everyone'
  check (visibility in ('everyone', 'close_friends'));

drop policy if exists "Posts visible to public accounts or accepted followers" on posts;
create policy "Posts visible respecting close-friends visibility" on posts
  for select using (
    auth.uid() = user_id
    or (
      visibility = 'everyone'
      and (
        exists (select 1 from profiles p where p.id = posts.user_id and p.is_private = false)
        or exists (
          select 1 from follows f
          where f.follower_id = auth.uid() and f.followed_id = posts.user_id and f.status = 'accepted'
        )
      )
    )
    or (
      visibility = 'close_friends'
      and exists (
        select 1 from close_friends cf where cf.user_id = posts.user_id and cf.friend_id = auth.uid()
      )
    )
  );
