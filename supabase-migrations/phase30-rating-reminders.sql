-- Phase 30: Rating reminder push notifications
--
-- After logging a movie, TV show, or game, users get push notifications
-- nudging them to add a rating at intervals that match how long each type
-- of content typically takes to finish/form an opinion on:
--
--   Movie  →  4 h, 24 h
--   TV     →  1 week, 2 weeks, 3 months
--   Game   →  2 weeks, 1 month
--
-- Architecture: a `rating_reminders` table holds one row per pending
-- notification; an INSERT trigger on `posts` populates it; a pg_cron job
-- running every 15 minutes fires due rows via the existing send-notification
-- Edge Function, then marks them sent.

-- ── 1. Reminders table ───────────────────────────────────────────────────────

create table if not exists rating_reminders (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  post_id    uuid        not null references posts(id) on delete cascade,
  post_title text        not null,
  post_type  text        not null check (post_type in ('movie', 'tv', 'play')),
  send_at    timestamptz not null,
  sent_at    timestamptz,
  created_at timestamptz not null default now()
);

alter table rating_reminders enable row level security;

-- Service role only — users have no direct access to this table.

-- ── 2. Notification settings column ─────────────────────────────────────────

alter table notification_settings
  add column if not exists rating_reminders boolean not null default true;

-- ── 3. INSERT trigger on posts ───────────────────────────────────────────────
-- Schedules reminders based on post type and media_type.
-- `media_type` is 'movie' or 'tv' (from TMDB) for watch posts;
-- play posts don't need it since the schedule is fixed regardless.

create or replace function schedule_rating_reminders() returns trigger as $$
begin
  if NEW.type = 'watch' and NEW.media_type = 'movie' then
    insert into rating_reminders (user_id, post_id, post_title, post_type, send_at) values
      (NEW.user_id, NEW.id, NEW.title, 'movie', NEW.created_at + interval '4 hours'),
      (NEW.user_id, NEW.id, NEW.title, 'movie', NEW.created_at + interval '24 hours');

  elsif NEW.type = 'watch' and NEW.media_type = 'tv' then
    insert into rating_reminders (user_id, post_id, post_title, post_type, send_at) values
      (NEW.user_id, NEW.id, NEW.title, 'tv', NEW.created_at + interval '1 week'),
      (NEW.user_id, NEW.id, NEW.title, 'tv', NEW.created_at + interval '2 weeks'),
      (NEW.user_id, NEW.id, NEW.title, 'tv', NEW.created_at + interval '3 months');

  elsif NEW.type = 'play' then
    insert into rating_reminders (user_id, post_id, post_title, post_type, send_at) values
      (NEW.user_id, NEW.id, NEW.title, 'play', NEW.created_at + interval '2 weeks'),
      (NEW.user_id, NEW.id, NEW.title, 'play', NEW.created_at + interval '1 month');
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists schedule_rating_reminders_on_post on posts;
create trigger schedule_rating_reminders_on_post
  after insert on posts
  for each row execute function schedule_rating_reminders();

-- ── 4. Cron processor ────────────────────────────────────────────────────────
-- Runs every 15 minutes, fires the Edge Function for each due reminder,
-- and marks it sent so it never fires twice.

create or replace function process_rating_reminders() returns void as $$
declare
  rec record;
begin
  for rec in
    select id, user_id, post_id, post_title, post_type
    from rating_reminders
    where sent_at is null
      and send_at <= now()
  loop
    perform net.http_post(
      url := 'https://ltimoecvvwgtvgbudyhs.supabase.co/functions/v1/send-notification',
      body := jsonb_build_object(
        'type',  'RATING_REMINDER',
        'table', 'rating_reminder',
        'record', jsonb_build_object(
          'user_id',    rec.user_id,
          'post_id',    rec.post_id,
          'post_title', rec.post_title,
          'post_type',  rec.post_type
        )
      ),
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', '49c6b032879477aafdb14a5a2e5d558b4ec12e8c2cec98f4bd273612b9a7cb37'
      )
    );
    update rating_reminders set sent_at = now() where id = rec.id;
  end loop;
end;
$$ language plpgsql security definer;

select cron.schedule(
  'rating-reminder-check',
  '*/15 * * * *',
  $$select process_rating_reminders();$$
);
