-- Phase 18: Daily "what are you up to" nudge
-- Sends one push notification per user per day at 8pm in THEIR OWN local
-- timezone (not a fixed server time). Runs as a pg_cron job that polls every
-- 15 minutes rather than trying to schedule per-user cron entries, which
-- pg_cron doesn't support well at this scale.
--
-- IMPORTANT: replace REPLACE_WITH_SECRET below with the real webhook secret
-- before running this (same one already set for the other notification
-- triggers — never commit the real value to this file).

create extension if not exists pg_cron;

alter table notification_settings
  add column if not exists timezone text not null default 'UTC',
  add column if not exists daily_nudge boolean not null default true,
  add column if not exists last_nudge_sent_date date;

create or replace function trigger_daily_nudges() returns void as $$
declare
  rec record;
begin
  for rec in
    select user_id
    from notification_settings
    where daily_nudge = true
      -- local hour is 8pm right now, and we haven't already sent today
      -- (checked in THEIR local date, so travelers don't get skipped/doubled)
      and extract(hour from (now() at time zone timezone)) = 20
      and coalesce(last_nudge_sent_date, '1970-01-01'::date) <> (now() at time zone timezone)::date
  loop
    perform net.http_post(
      url := 'https://ltimoecvvwgtvgbudyhs.supabase.co/functions/v1/send-notification',
      body := jsonb_build_object(
        'type', 'NUDGE',
        'table', 'daily_nudge',
        'record', jsonb_build_object('user_id', rec.user_id)
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'REPLACE_WITH_SECRET')
    );
    update notification_settings
      set last_nudge_sent_date = (now() at time zone timezone)::date
      where user_id = rec.user_id;
  end loop;
end;
$$ language plpgsql security definer;

select cron.schedule('daily-nudge-check', '*/15 * * * *', $$select trigger_daily_nudges();$$);
