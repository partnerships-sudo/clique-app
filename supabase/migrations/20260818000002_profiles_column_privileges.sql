-- `profiles` is readable by anonymous callers on purpose: the web /[username]
-- and /post pages are public, and RLS allows it. But "public profile" should
-- mean username, avatar and bio — not gender, age range and location, which
-- were readable by anyone holding the bundled anon key.
--
-- RLS cannot filter columns, so this is done with column privileges. A blanket
-- table-level SELECT grant cannot be narrowed by revoking single columns, so
-- the grant is replaced with an explicit column list.
--
-- Only the `anon` role is touched. `authenticated` keeps full access, which
-- matters because useDiscoverPeople filters on `location` with ilike, and
-- filtering requires SELECT privilege on the column.
--
-- gender and age_range are collected during onboarding and never displayed
-- anywhere in the app, so nothing reads them back at all.
--
-- Side benefit: this fails closed. A column added later is invisible to anon
-- until deliberately granted.

revoke select on public.profiles from anon;

grant select (
  id,
  username,
  full_name,
  avatar_url,
  banner_url,
  bio,
  verified_tier,
  rating_icon,
  featured_badges,
  content_types,
  created_at,
  onboarded_at,
  is_private,
  show_online_status,
  show_read_receipts,
  messages_following_only,
  last_seen_at,
  timezone,
  reactions_read_at,
  collection_share_books,
  collection_share_movies,
  collection_share_music,
  collection_share_games,
  collection_share_podcasts
) on public.profiles to anon;
