-- Onboarding completion was tracked only in AsyncStorage under
-- `clique:onboarding:<user_id>`, which is per-device. Reinstalling the app or
-- signing in on a second phone lost the flag and would push an established user
-- back through the 9-step flow.
--
-- Move the source of truth to the profile. AsyncStorage stays as a fast local
-- cache so the common case doesn't wait on a network round trip.

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

-- Everyone who already exists has, by definition, been through onboarding (or
-- deliberately skipped it). Backfill so the change doesn't re-onboard them.
update public.profiles
   set onboarded_at = coalesce(onboarded_at, created_at, now())
 where onboarded_at is null;
