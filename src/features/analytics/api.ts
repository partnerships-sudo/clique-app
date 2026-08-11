import { supabase } from '@/lib/supabase';

// Fire-and-forget — never blocks the UI, never throws
export async function track(
  userId: string | undefined,
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!userId) return;
  try {
    await supabase.from('analytics_events').insert({
      user_id: userId,
      event_name: event,
      properties: properties ?? null,
    });
  } catch {
    // swallow silently — analytics must never break the app
  }
}

// ── Event name constants ───────────────────────────────────────────────────────
export const Events = {
  // Discussions
  DISCUSSION_VIEWED:       'discussion_viewed',
  DISCUSSION_CREATED:      'discussion_created',
  DISCUSSION_SHARED:       'discussion_shared',

  // Voting
  DISCUSSION_AGREED:       'discussion_agreed',
  DISCUSSION_DISAGREED:    'discussion_disagreed',
  DISCUSSION_UNVOTED:      'discussion_unvoted',

  // Polls & quizzes
  POLL_VOTED:              'poll_voted',
  QUIZ_ANSWER_SUBMITTED:   'quiz_answer_submitted',
  QUIZ_COMPLETED:          'quiz_completed',

  // Saves
  DISCUSSION_SAVED:        'discussion_saved',
  DISCUSSION_UNSAVED:      'discussion_unsaved',

  // Reactions
  REACTION_ADDED:          'reaction_added',
  REACTION_REMOVED:        'reaction_removed',

  // Comments
  COMMENT_ADDED:           'comment_added',
  COMMENT_DELETED:         'comment_deleted',

  // Lounge
  LOUNGE_OPENED:           'lounge_opened',
  LOUNGE_FOLLOWED:         'lounge_followed',
  LOUNGE_UNFOLLOWED:       'lounge_unfollowed',
  LOUNGE_SEARCHED:         'lounge_searched',
  SEARCH_PERFORMED:        'search_performed',

  // Social
  PROFILE_VIEWED:          'profile_viewed',
  FRIEND_ADDED:            'friend_added',

  // Content
  CONTENT_ROOM_OPENED:     'content_room_opened',

  // News
  NEWS_CARD_TAPPED:        'news_card_tapped',
  NEWS_ARTICLE_OPENED:     'news_article_opened',

  // Commerce / Where to find
  PURCHASE_LINK_CLICKED:   'purchase_link_clicked',

  // Posts / Activity
  POST_CREATED:            'post_created',
  POST_RATED:              'post_rated',

  // Session
  SESSION_STARTED:         'session_started',
} as const;
