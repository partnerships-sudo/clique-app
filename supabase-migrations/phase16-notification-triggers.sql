-- Phase 16: Server-side push notification triggers
-- Fires the send-notification Edge Function whenever a relevant row is
-- inserted/updated, so notifications are delivered reliably server-side
-- regardless of what the sender's client is doing afterward. Uses pg_net
-- directly (async, non-blocking) rather than the supabase_functions helper,
-- since that schema is only provisioned after Database Webhooks has been
-- toggled on once in the dashboard.
--
-- IMPORTANT: replace REPLACE_WITH_SECRET below with the real webhook
-- secret before running this (given separately, not committed to this file).

create extension if not exists pg_net;

create or replace function notify_webhook() returns trigger as $$
declare
  payload jsonb;
begin
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
  );
  perform net.http_post(
    url := 'https://ltimoecvvwgtvgbudyhs.supabase.co/functions/v1/send-notification',
    body := payload,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', 'REPLACE_WITH_SECRET')
  );
  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists notify_on_direct_message on direct_messages;
create trigger notify_on_direct_message
after insert on direct_messages
for each row execute function notify_webhook();

drop trigger if exists notify_on_group_message on group_chat_messages;
create trigger notify_on_group_message
after insert on group_chat_messages
for each row execute function notify_webhook();

drop trigger if exists notify_on_content_chat_message on messages;
create trigger notify_on_content_chat_message
after insert on messages
for each row execute function notify_webhook();

drop trigger if exists notify_on_reaction on reactions;
create trigger notify_on_reaction
after insert on reactions
for each row execute function notify_webhook();

drop trigger if exists notify_on_friendship_change on friendships;
create trigger notify_on_friendship_change
after insert or update of status on friendships
for each row execute function notify_webhook();
