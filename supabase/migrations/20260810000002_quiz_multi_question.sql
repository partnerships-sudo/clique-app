-- Add multi-question support for quiz format
-- `questions` stores [{question, options}] for quizzes; null = single-question poll (existing)
alter table discussion_polls
  add column if not exists questions jsonb default null;

-- question_index tracks which question a vote belongs to (default 0 = existing single-question polls)
alter table discussion_poll_votes
  add column if not exists question_index integer not null default 0;

-- Drop the old unique constraint (user can now vote once per question, not once per poll)
alter table discussion_poll_votes
  drop constraint if exists discussion_poll_votes_poll_id_user_id_key;

-- New unique: one vote per user per question per poll
alter table discussion_poll_votes
  add constraint discussion_poll_votes_poll_question_user_key
  unique (poll_id, question_index, user_id);
