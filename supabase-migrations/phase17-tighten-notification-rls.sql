-- Phase 17: Tighten push notification RLS
-- Now that notifications are sent server-side (Edge Function using the
-- service role key, which bypasses RLS), clients no longer need to read
-- each other's push tokens or notification preferences. Lock both tables
-- back down to strictly owner-only access.

drop policy if exists "Any authenticated user can read push tokens" on push_tokens;
drop policy if exists "Any authenticated user can read notification settings" on notification_settings;
