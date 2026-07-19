-- Phase 33: Streak-aware daily nudge
--
-- Upgrades the phase-18 daily nudge so it only fires when the user has NOT
-- logged anything yet today (their local date). Users who already logged
-- are skipped entirely — no notification needed, streak is intact.
--
-- The cron schedule and 8pm-local-time logic stay unchanged; we just add
-- a NOT EXISTS guard that joins against the `posts` table.

create or replace function trigger_daily_nudges() returns void as $$
declare
  rec record;
begin
  for rec in
    select ns.user_id, ns.timezone
    from notification_settings ns
    where ns.daily_nudge = true
      -- 8pm in the user's local timezone right now
      and extract(hour from (now() at time zone ns.timezone)) = 19
      -- haven't already sent this nudge today (local date)
      and coalesce(ns.last_nudge_sent_date, '1970-01-01'::date)
            <> (now() at time zone ns.timezone)::date
      -- haven't logged anything today yet — don't nudge people who already did
      and not exists (
        select 1
        from posts p
        where p.user_id = ns.user_id
          and (p.created_at at time zone ns.timezone)::date
                = (now() at time zone ns.timezone)::date
      )
  loop
    perform net.http_post(
      url := 'https://ltimoecvvwgtvgbudyhs.supabase.co/functions/v1/send-notification',
      body := jsonb_build_object(
        'type',  'NUDGE',
        'table', 'daily_nudge',
        'record', jsonb_build_object('user_id', rec.user_id)
      ),
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', '49c6b032879477aafdb14a5a2e5d558b4ec12e8c2cec98f4bd273612b9a7cb37'
      )
    );
    update notification_settings
      set last_nudge_sent_date = (now() at time zone rec.timezone)::date
    where user_id = rec.user_id;
  end loop;
end;
$$ language plpgsql security definer;
