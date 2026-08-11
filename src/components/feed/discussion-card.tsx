import { router } from 'expo-router';
import { useRef } from 'react';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts } from '@/constants/theme';
import { type Discussion, timeAgo, useToggleDiscussionVote, useToggleDiscussionDisagree } from '@/features/discussions/api';
import { track, Events } from '@/features/analytics/api';
import { useSession } from '@/hooks/use-session';

const POSTER_W = 90;
const POSTER_H = 135; // 2:3 — matches post-card exactly

// Format palette — border + bottom bar colour
const FORMAT_PALETTE = {
  poll:       { border: '#FDE68A', barBg: '#FEF08A', barText: '#92400E', label: 'POLL' },
  hot_take:   { border: '#FCA5A5', barBg: '#FCA5A5', barText: '#7F1D1D', label: 'HOT TAKE' },
  discussion: { border: '#C4B5FD', barBg: '#DDD6FE', barText: '#4C1D95', label: 'DISCUSSION' },
};

function getPalette(item: Discussion) {
  if (item.has_poll || item.format === 'poll') return FORMAT_PALETTE.poll;
  if (item.format === 'hot_take') return FORMAT_PALETTE.hot_take;
  return FORMAT_PALETTE.discussion;
}

export function DiscussionCard({ item, suppressContentRoom }: { item: Discussion; suppressContentRoom?: boolean }) {
  const vote = useToggleDiscussionVote();
  const disagree = useToggleDiscussionDisagree();
  const { user } = useSession();

  const palette = getPalette(item);
  const hasLinkedContent = !!(item.content_title && item.content_external_id);

  function handleVote() {
    const event = item.has_voted && !item.has_disagreed ? Events.DISCUSSION_UNVOTED : Events.DISCUSSION_AGREED;
    track(user?.id, event, { discussion_id: item.id });
    vote.mutate({ discussionId: item.id, hasVoted: item.has_voted, hasDisagreed: item.has_disagreed });
  }

  function handleDisagree() {
    const event = item.has_disagreed && !item.has_voted ? Events.DISCUSSION_UNVOTED : Events.DISCUSSION_DISAGREED;
    track(user?.id, event, { discussion_id: item.id });
    disagree.mutate({ discussionId: item.id, hasDisagreed: item.has_disagreed, hasVoted: item.has_voted });
  }

  const navigating = useRef(false);
  function handleOpenDiscussion() {
    if (navigating.current) return;
    navigating.current = true;
    router.push({ pathname: '/discussion-detail-modal', params: { id: item.id } });
    setTimeout(() => { navigating.current = false; }, 1000);
  }

  function handleOpenContentRoom() {
    if (!hasLinkedContent || suppressContentRoom) return;
    router.push({
      pathname: '/content-room-modal',
      params: {
        externalId: item.content_external_id!,
        mediaType: item.content_media_type ?? '',
        title: item.content_title!,
        poster: item.content_poster ?? '',
      },
    });
  }

  const voteCount = item.upvote_count + item.disagree_count;

  return (
    <Pressable
      style={[styles.card, { borderColor: palette.border }]}
      onPress={handleOpenDiscussion}>

      {/* ── Top row: poster LEFT + body RIGHT — height locked to POSTER_H ── */}
      <View style={styles.topRow}>
        {/* Poster — flush to card edge */}
        {item.content_poster ? (
          <Pressable
            onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }}
            disabled={!hasLinkedContent}>
            <Image source={{ uri: item.content_poster }} style={styles.poster} resizeMode="cover" />
          </Pressable>
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: palette.border }]} />
        )}

        {/* Body column */}
        <View style={styles.body}>
          {/* Meta row: avatar · @username · time — type label moved to bottom bar */}
          <View style={styles.metaRow}>
            <Avatar avatarUrl={item.author_avatar} name={item.author_name} size={20} />
            <Text style={styles.authorText} numberOfLines={1}>@{item.author_name}</Text>
            <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={3}>{item.title}</Text>

          {/* Show name */}
          {item.content_title ? (
            <Text style={styles.showName} numberOfLines={1}>{item.content_title}</Text>
          ) : null}

          {/* Hot take body snippet */}
          {item.body && item.format === 'hot_take' ? (
            <Text style={styles.bodySnippet} numberOfLines={2}>"{item.body}"</Text>
          ) : null}

          <View style={{ flex: 1 }} />

          {/* Stats: voted · 💬 comments */}
          <View style={styles.statsRow}>
            {item.has_poll && voteCount > 0 && (
              <>
                <Text style={styles.statText}>{voteCount} voted</Text>
                <Text style={styles.statDot}>·</Text>
              </>
            )}
            <View style={styles.commentStat}>
              <SymbolView name="bubble.left" size={11} tintColor="#9CA3AF" type="monochrome" style={{ width: 11, height: 11 }} />
              <Text style={styles.statText}>{item.comment_count}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom bar: full colour bg, type label left, votes right ── */}
      <View style={[styles.bottomBar, { backgroundColor: palette.barBg }]}>
        <Text style={[styles.typeLabel, { color: palette.barText }]}>{palette.label}</Text>

        <View style={styles.voteGroup}>
          <Pressable
            style={[styles.voteBtn, item.has_voted && styles.voteBtnActive]}
            onPress={(e) => { e.stopPropagation(); handleVote(); }}
            hitSlop={6}>
            <Text style={[styles.voteBtnText, { color: item.has_voted ? palette.barText : '#6B7280' }]}>
              👍{item.upvote_count > 0 ? `  ${item.upvote_count}` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.voteBtn, item.has_disagreed && styles.voteBtnDisagree]}
            onPress={(e) => { e.stopPropagation(); handleDisagree(); }}
            hitSlop={6}>
            <Text style={[styles.voteBtnText, { color: item.has_disagreed ? '#991B1B' : '#6B7280' }]}>
              👎{item.disagree_count > 0 ? `  ${item.disagree_count}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
  },

  // Top row — height locked to poster height, same as post-card (135pt)
  topRow: {
    flexDirection: 'row',
    height: POSTER_H,
  },

  poster: {
    width: POSTER_W,
    height: POSTER_H,
    flexShrink: 0,
  },
  posterPlaceholder: {
    opacity: 0.25,
  },

  // Body — internal padding matches post-card body
  body: {
    flex: 1,
    minWidth: 0,
    padding: 10,
    paddingTop: 8,
    paddingBottom: 8,
    overflow: 'hidden',
    gap: 4,
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  authorText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 12,
    color: '#374151',
    flex: 1,
  },
  timeText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: '#9CA3AF',
    flexShrink: 0,
  },

  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 16,
    color: '#111827',
    lineHeight: 21,
  },
  showName: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
    color: '#6B7280',
  },
  bodySnippet: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
    lineHeight: 16,
  },

  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: '#9CA3AF',
  },
  statDot: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: '#D1D5DB',
  },
  commentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  // Bottom bar — full color bg, same paddingVertical: 8 as post-card (keeps total at 171pt)
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  typeLabel: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 10,
    letterSpacing: 0.6,
    flex: 1,
  },
  voteGroup: {
    flexDirection: 'row',
    gap: 6,
  },
  voteBtn: {
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  voteBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.8)',
  },
  voteBtnDisagree: {
    backgroundColor: '#FEE2E2',
  },
  voteBtnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11.5,
  },
});
