import { router } from 'expo-router';
import { memo, useRef } from 'react';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { Alert, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { BrandFonts } from '@/constants/theme';
import { type Discussion, timeAgo, useToggleDiscussionVote, useToggleDiscussionDisagree } from '@/features/discussions/api';
import { track, Events } from '@/features/analytics/api';
import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';

const POSTER_W = 90;
const POSTER_H = 135; // 2:3 — matches post-card exactly

// Format palette — separate light/dark values
const FORMAT_PALETTE = {
  poll: {
    light: { border: '#FDE68A', barBg: '#FEF08A', barText: '#92400E' },
    dark:  { border: '#854D0E', barBg: '#422006', barText: '#FEF08A' },
    label: 'POLL',
  },
  hot_take: {
    light: { border: '#FCA5A5', barBg: '#FCA5A5', barText: '#7F1D1D' },
    dark:  { border: '#991B1B', barBg: '#450A0A', barText: '#FCA5A5' },
    label: 'HOT TAKE',
  },
  discussion: {
    light: { border: '#C4B5FD', barBg: '#DDD6FE', barText: '#4C1D95' },
    dark:  { border: '#6D28D9', barBg: '#2E1065', barText: '#DDD6FE' },
    label: 'DISCUSSION',
  },
};

function getPaletteKey(item: Discussion): keyof typeof FORMAT_PALETTE {
  if (item.has_poll || item.format === 'poll') return 'poll';
  if (item.format === 'hot_take') return 'hot_take';
  return 'discussion';
}

export const DiscussionCard = memo(function DiscussionCard({ item, suppressContentRoom }: { item: Discussion; suppressContentRoom?: boolean }) {
  const vote = useToggleDiscussionVote();
  const disagree = useToggleDiscussionDisagree();
  const { user } = useSession();
  const Brand = useBrand();
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const paletteKey = getPaletteKey(item);
  const paletteDef = FORMAT_PALETTE[paletteKey];
  const palette = { ...paletteDef, ...(isDark ? paletteDef.dark : paletteDef.light) };

  const hasLinkedContent = !!(item.content_title && item.content_external_id);

  function handleVote() {
    const event = item.has_voted && !item.has_disagreed ? Events.DISCUSSION_UNVOTED : Events.DISCUSSION_AGREED;
    track(user?.id, event, { discussion_id: item.id });
    vote.mutate(
      { discussionId: item.id, hasVoted: item.has_voted, hasDisagreed: item.has_disagreed },
      { onError: () => Alert.alert('Could not save vote', 'Check your connection and try again.') },
    );
  }

  function handleDisagree() {
    const event = item.has_disagreed && !item.has_voted ? Events.DISCUSSION_UNVOTED : Events.DISCUSSION_DISAGREED;
    track(user?.id, event, { discussion_id: item.id });
    disagree.mutate(
      { discussionId: item.id, hasDisagreed: item.has_disagreed, hasVoted: item.has_voted },
      { onError: () => Alert.alert('Could not save vote', 'Check your connection and try again.') },
    );
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

  // Vote button background — sits on top of the coloured bar
  const voteBtnBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)';
  const voteBtnActiveBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.8)';
  const disagreeBg = isDark ? '#450A0A' : '#FEE2E2';

  return (
    <Pressable
      style={[styles.card, { borderColor: palette.border, backgroundColor: Brand.card }]}
      onPress={handleOpenDiscussion}
      accessibilityLabel={item.title}
      accessibilityHint="Opens discussion"
      accessibilityRole="button">

      {/* ── Top row: poster LEFT + body RIGHT — height locked to POSTER_H ── */}
      <View style={styles.topRow}>
        {/* Poster — flush to card edge */}
        {item.content_poster ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.content_title ?? 'this title'}`}
            onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }}
            disabled={!hasLinkedContent}>
            <Image source={{ uri: item.content_poster }} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={item.content_poster} />
          </Pressable>
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: palette.border }]} />
        )}

        {/* Body column */}
        <View style={styles.body}>
          {/* Meta row: avatar · @username · time */}
          <View style={styles.metaRow}>
            <Avatar avatarUrl={item.author_avatar} name={item.author_name} size={20} />
            <Text style={[styles.authorText, { color: Brand.muted }]} numberOfLines={1}>@{item.author_name}</Text>
            {!!item.author_verified_tier && <VerifiedBadge tier={item.author_verified_tier} size={12} />}
            <Text style={[styles.timeText, { color: Brand.muted }]}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: Brand.ink }]} numberOfLines={3}>{item.title}</Text>

          {/* Show name — hidden when already inside that content room */}
          {item.content_title && !suppressContentRoom ? (
            <Text style={[styles.showName, { color: Brand.muted }]} numberOfLines={1}>{item.content_title}</Text>
          ) : null}

          {/* Hot take body snippet */}
          {item.body && item.format === 'hot_take' ? (
            <Text style={[styles.bodySnippet, { color: Brand.muted }]} numberOfLines={2}>"{item.body}"</Text>
          ) : null}

          <View style={{ flex: 1 }} />

          {/* Stats: voted · 💬 comments */}
          <View style={styles.statsRow}>
            {item.has_poll && voteCount > 0 && (
              <>
                <Text style={[styles.statText, { color: Brand.muted }]}>{voteCount} voted</Text>
                <Text style={[styles.statDot, { color: Brand.border }]}>·</Text>
              </>
            )}
            <View style={styles.commentStat}>
              <SymbolView name="bubble.left" size={11} tintColor={Brand.muted} type="monochrome" style={{ width: 11, height: 11 }} />
              <Text style={[styles.statText, { color: Brand.muted }]}>{item.comment_count}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Bottom bar: full colour bg, type label left, votes right ── */}
      <View style={[styles.bottomBar, { backgroundColor: palette.barBg }]}>
        <Text style={[styles.typeLabel, { color: palette.barText }]}>{palette.label}</Text>

        <View style={styles.voteGroup}>
          <Pressable
            style={[styles.voteBtn, { backgroundColor: voteBtnBg }, item.has_voted && { backgroundColor: voteBtnActiveBg }]}
            onPress={(e) => { e.stopPropagation(); handleVote(); }}
            hitSlop={6}
            accessibilityLabel={item.has_voted ? `Unvote. ${item.upvote_count} agrees` : `Agree. ${item.upvote_count} agrees`}
            accessibilityRole="button">
            <Text style={[styles.voteBtnText, { color: item.has_voted ? palette.barText : Brand.muted }]}>
              👍{item.upvote_count > 0 ? `  ${item.upvote_count}` : ''}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.voteBtn, { backgroundColor: voteBtnBg }, item.has_disagreed && { backgroundColor: disagreeBg }]}
            onPress={(e) => { e.stopPropagation(); handleDisagree(); }}
            hitSlop={6}
            accessibilityLabel={item.has_disagreed ? `Remove disagree. ${item.disagree_count} disagree` : `Disagree. ${item.disagree_count} disagree`}
            accessibilityRole="button">
            <Text style={[styles.voteBtnText, { color: item.has_disagreed ? (isDark ? '#FCA5A5' : '#991B1B') : Brand.muted }]}>
              👎{item.disagree_count > 0 ? `  ${item.disagree_count}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1.5,
  },

  // Top row — height locked to poster height
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
    flex: 1,
  },
  timeText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    flexShrink: 0,
  },

  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 16,
    lineHeight: 21,
  },
  showName: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
  },
  bodySnippet: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
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
  },
  statDot: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
  },
  commentStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },

  // Bottom bar
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
  },
  voteBtnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11.5,
  },
});
