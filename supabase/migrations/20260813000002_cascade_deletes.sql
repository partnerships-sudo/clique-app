-- Add ON DELETE CASCADE to all foreign keys referencing auth.users
-- so that deleting a user from Authentication automatically cleans up all their data.

-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- posts
ALTER TABLE posts DROP CONSTRAINT IF EXISTS posts_user_id_fkey;
ALTER TABLE posts ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- post_comments
ALTER TABLE post_comments DROP CONSTRAINT IF EXISTS post_comments_user_id_fkey;
ALTER TABLE post_comments ADD CONSTRAINT post_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- post_comment_upvotes
ALTER TABLE post_comment_upvotes DROP CONSTRAINT IF EXISTS post_comment_upvotes_user_id_fkey;
ALTER TABLE post_comment_upvotes ADD CONSTRAINT post_comment_upvotes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- post_likes
ALTER TABLE post_likes DROP CONSTRAINT IF EXISTS post_likes_user_id_fkey;
ALTER TABLE post_likes ADD CONSTRAINT post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- library
ALTER TABLE library DROP CONSTRAINT IF EXISTS library_user_id_fkey;
ALTER TABLE library ADD CONSTRAINT library_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- follows
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_follower_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE follows DROP CONSTRAINT IF EXISTS follows_followed_id_fkey;
ALTER TABLE follows ADD CONSTRAINT follows_followed_id_fkey FOREIGN KEY (followed_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- friendships
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_user_id_fkey;
ALTER TABLE friendships ADD CONSTRAINT friendships_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_friend_id_fkey;
ALTER TABLE friendships ADD CONSTRAINT friendships_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- close_friends
ALTER TABLE close_friends DROP CONSTRAINT IF EXISTS close_friends_user_id_fkey;
ALTER TABLE close_friends ADD CONSTRAINT close_friends_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE close_friends DROP CONSTRAINT IF EXISTS close_friends_friend_id_fkey;
ALTER TABLE close_friends ADD CONSTRAINT close_friends_friend_id_fkey FOREIGN KEY (friend_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- notifications
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_from_user_id_fkey;
ALTER TABLE notifications ADD CONSTRAINT notifications_from_user_id_fkey FOREIGN KEY (from_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- messages
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_user_id_fkey;
ALTER TABLE messages ADD CONSTRAINT messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- message_reactions
ALTER TABLE message_reactions DROP CONSTRAINT IF EXISTS message_reactions_user_id_fkey;
ALTER TABLE message_reactions ADD CONSTRAINT message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- direct_messages
ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_sender_id_fkey;
ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE direct_messages DROP CONSTRAINT IF EXISTS direct_messages_recipient_id_fkey;
ALTER TABLE direct_messages ADD CONSTRAINT direct_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- dm_requests
ALTER TABLE dm_requests DROP CONSTRAINT IF EXISTS dm_requests_sender_id_fkey;
ALTER TABLE dm_requests ADD CONSTRAINT dm_requests_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE dm_requests DROP CONSTRAINT IF EXISTS dm_requests_recipient_id_fkey;
ALTER TABLE dm_requests ADD CONSTRAINT dm_requests_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- reactions
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_user_id_fkey;
ALTER TABLE reactions ADD CONSTRAINT reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- emoji_reactions
ALTER TABLE emoji_reactions DROP CONSTRAINT IF EXISTS emoji_reactions_user_id_fkey;
ALTER TABLE emoji_reactions ADD CONSTRAINT emoji_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- story_views
ALTER TABLE story_views DROP CONSTRAINT IF EXISTS story_views_viewer_id_fkey;
ALTER TABLE story_views ADD CONSTRAINT story_views_viewer_id_fkey FOREIGN KEY (viewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- push_tokens
ALTER TABLE push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey;
ALTER TABLE push_tokens ADD CONSTRAINT push_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- notification_settings
ALTER TABLE notification_settings DROP CONSTRAINT IF EXISTS notification_settings_user_id_fkey;
ALTER TABLE notification_settings ADD CONSTRAINT notification_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- rating_reminders
ALTER TABLE rating_reminders DROP CONSTRAINT IF EXISTS rating_reminders_user_id_fkey;
ALTER TABLE rating_reminders ADD CONSTRAINT rating_reminders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- user_blocks
ALTER TABLE user_blocks DROP CONSTRAINT IF EXISTS user_blocks_blocker_id_fkey;
ALTER TABLE user_blocks ADD CONSTRAINT user_blocks_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE user_blocks DROP CONSTRAINT IF EXISTS user_blocks_target_id_fkey;
ALTER TABLE user_blocks ADD CONSTRAINT user_blocks_target_id_fkey FOREIGN KEY (target_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- analytics_events
ALTER TABLE analytics_events DROP CONSTRAINT IF EXISTS analytics_events_user_id_fkey;
ALTER TABLE analytics_events ADD CONSTRAINT analytics_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ad_events
ALTER TABLE ad_events DROP CONSTRAINT IF EXISTS ad_events_user_id_fkey;
ALTER TABLE ad_events ADD CONSTRAINT ad_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- lists
ALTER TABLE lists DROP CONSTRAINT IF EXISTS lists_user_id_fkey;
ALTER TABLE lists ADD CONSTRAINT lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- list_likes
ALTER TABLE list_likes DROP CONSTRAINT IF EXISTS list_likes_user_id_fkey;
ALTER TABLE list_likes ADD CONSTRAINT list_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- list_comments
ALTER TABLE list_comments DROP CONSTRAINT IF EXISTS list_comments_user_id_fkey;
ALTER TABLE list_comments ADD CONSTRAINT list_comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- comment_likes
ALTER TABLE comment_likes DROP CONSTRAINT IF EXISTS comment_likes_user_id_fkey;
ALTER TABLE comment_likes ADD CONSTRAINT comment_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- content_room_follows
ALTER TABLE content_room_follows DROP CONSTRAINT IF EXISTS content_room_follows_user_id_fkey;
ALTER TABLE content_room_follows ADD CONSTRAINT content_room_follows_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussion_reactions
ALTER TABLE discussion_reactions DROP CONSTRAINT IF EXISTS discussion_reactions_user_id_fkey;
ALTER TABLE discussion_reactions ADD CONSTRAINT discussion_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussion_saves
ALTER TABLE discussion_saves DROP CONSTRAINT IF EXISTS discussion_saves_user_id_fkey;
ALTER TABLE discussion_saves ADD CONSTRAINT discussion_saves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- discussion_poll_votes
ALTER TABLE discussion_poll_votes DROP CONSTRAINT IF EXISTS discussion_poll_votes_user_id_fkey;
ALTER TABLE discussion_poll_votes ADD CONSTRAINT discussion_poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premieres
ALTER TABLE premieres DROP CONSTRAINT IF EXISTS premieres_host_user_id_fkey;
ALTER TABLE premieres ADD CONSTRAINT premieres_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_members
ALTER TABLE premiere_members DROP CONSTRAINT IF EXISTS premiere_members_user_id_fkey;
ALTER TABLE premiere_members ADD CONSTRAINT premiere_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_messages
ALTER TABLE premiere_messages DROP CONSTRAINT IF EXISTS premiere_messages_user_id_fkey;
ALTER TABLE premiere_messages ADD CONSTRAINT premiere_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_message_reactions
ALTER TABLE premiere_message_reactions DROP CONSTRAINT IF EXISTS premiere_message_reactions_user_id_fkey;
ALTER TABLE premiere_message_reactions ADD CONSTRAINT premiere_message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_cohosts
ALTER TABLE premiere_cohosts DROP CONSTRAINT IF EXISTS premiere_cohosts_user_id_fkey;
ALTER TABLE premiere_cohosts ADD CONSTRAINT premiere_cohosts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE premiere_cohosts DROP CONSTRAINT IF EXISTS premiere_cohosts_invited_by_fkey;
ALTER TABLE premiere_cohosts ADD CONSTRAINT premiere_cohosts_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_buy_clicks
ALTER TABLE premiere_buy_clicks DROP CONSTRAINT IF EXISTS premiere_buy_clicks_user_id_fkey;
ALTER TABLE premiere_buy_clicks ADD CONSTRAINT premiere_buy_clicks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- premiere_trivia_responses
ALTER TABLE premiere_trivia_responses DROP CONSTRAINT IF EXISTS premiere_trivia_responses_user_id_fkey;
ALTER TABLE premiere_trivia_responses ADD CONSTRAINT premiere_trivia_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- screening_rooms
ALTER TABLE screening_rooms DROP CONSTRAINT IF EXISTS screening_rooms_host_user_id_fkey;
ALTER TABLE screening_rooms ADD CONSTRAINT screening_rooms_host_user_id_fkey FOREIGN KEY (host_user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- screening_room_members
ALTER TABLE screening_room_members DROP CONSTRAINT IF EXISTS screening_room_members_user_id_fkey;
ALTER TABLE screening_room_members ADD CONSTRAINT screening_room_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- screening_room_messages
ALTER TABLE screening_room_messages DROP CONSTRAINT IF EXISTS screening_room_messages_user_id_fkey;
ALTER TABLE screening_room_messages ADD CONSTRAINT screening_room_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- screening_room_trivia_responses
ALTER TABLE screening_room_trivia_responses DROP CONSTRAINT IF EXISTS screening_room_trivia_responses_user_id_fkey;
ALTER TABLE screening_room_trivia_responses ADD CONSTRAINT screening_room_trivia_responses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
