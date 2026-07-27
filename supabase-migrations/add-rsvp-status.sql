-- Add rsvp_status to premiere_members
-- Values: 'invited' | 'attending' | 'not_attending'
alter table premiere_members
  add column if not exists rsvp_status text not null default 'attending';

-- Existing rows joined via the waiting room = attending
-- Rows inserted from now on will be 'invited' when sent via DM invite
