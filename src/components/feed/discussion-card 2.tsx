import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts } from '@/constants/theme';
import { type Discussion, timeAgo, useToggleDiscussionVote } from '@/features/discussions/api';
import { useSession } from '@/hooks/use-session';

// Per-type card palette: background, badge bg, badge text, fire badge
const TYPE_PALETTE: Record<string, { cardBg: string; badgeBg: string; badgeText: string }> = {
  watch:   { cardBg: '#EDE9FE', badgeBg: '#DDD6FE', badgeText: '#6D28D9' },
  tv:      { cardBg: '#EDE9FE', badgeBg: '#DDD6FE', badgeText: '#6D28D9' },
  read:    { cardBg: '#FEF9C3', badgeBg: '#FDE68A', badgeText: '#92400E' },
  play:    { cardBg: '#D1FAE5', badgeBg: '#A7F3D0', badgeText: '#065F46' },
  listen:  { cardBg: '#DBEAFE', badgeBg: '#BFDBFE', badgeText: '#1E40AF' },
  podcast: { cardBg: '#FCE7F3', badgeBg: '#FBCFE8', badgeText: '#9D174D' },
  general: { cardBg: '#F3F4F6', badgeBg: '#E5E7EB', badgeText: '#374151' },
};

const TYPE_LABELS: Record<string, string> = {
  read: 'Books', watch: 'TV & Film', tv: 'TV & Film',
  play: 'Games', listen: 'Music', podcast: 'Podcasts', general: 'General',
};

export function DiscussionCard({ item }: { item: Discussion }) {
  const { user } = useSession();
  const vote = useToggleDiscussionVote();

  const typeKey = item.type === 'tv' ? 'watch' : item.type;
  const palette = TYPE_PALETTE[typeKey] ?? TYPE_PALETTE.general;
  const typeLabel = TYPE_LABELS[item.type] ?? 'Discussion';

  const hasLinkedContent = !!(item.content_title && item.content_external_id);

  function handleVote() {
    vote.mutate({ discussionId: item.id, hasVoted: item.has_voted });
  }

  function handleOpenDiscussion() {
    router.push({ pathname: '/discussion-detail-modal', params: { id: item.id } });
  }

  function handleOpenContentRoom() {
    if (!hasLinkedContent) return;
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

  return (
    <Pressable
      style={[styles.card, { backgroundColor: palette.cardBg }]}
      onPress={handleOpenDiscussion}>

      <View style={styles.inner}>
        {/* Left: badge + title + show name + avatars */}
        <View style={styles.left}>
          {/* Type badge */}
          <View style={[styles.badge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.badgeText, { color: palette.badgeText }]}>
              {typeLabel.toUpperCase()}
            </Text>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={3}>{item.title}</Text>

          {/* Show / content name */}
          {item.content_title ? (
            <Pressable onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }} hitSlop={4}>
              <Text style={styles.showName} numberOfLines={1}>{item.content_title}</Text>
            </Pressable>
          ) : null}

          {/* Spacer */}
          <View style={{ flex: 1 }} />

          {/* Stacked avatars + talking count */}
          <View style={styles.avatarRow}>
            {/* Author avatar */}
            <View style={styles.avatarStack}>
              <Avatar avatarUrl={item.author_avatar} name={item.author_name} size={22} />
              {/* Extra placeholder circles to suggest community */}
              {item.comment_count > 0 && (
                <View style={[styles.avatarExtra, { marginLeft: -8, backgroundColor: palette.badgeBg, borderColor: palette.cardBg }]}>
                  <Text style={[styles.avatarExtraText, { color: palette.badgeText }]}>+</Text>
                </View>
              )}
            </View>
            <Text style={styles.talkingText}>
              {item.comment_count > 0
                ? `${item.comment_count} talking`
                : `@${item.author_name} · ${timeAgo(item.created_at)}`}
            </Text>
          </View>
        </View>

        {/* Right: poster with upvote badge */}
        {item.content_poster ? (
          <Pressable
            style={styles.posterWrap}
            onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }}
            hitSlop={4}>
            <Image source={{ uri: item.content_poster }} style={styles.poster} resizeMode="cover" />
            {/* Fire / upvote badge */}
            <Pressable
              style={styles.voteBadge}
              onPress={(e) => { e.stopPropagation(); handleVote(); }}
              hitSlop={6}>
              <Text style={styles.voteFire}>🔥</Text>
              <Text style={[styles.voteCount, { color: item.has_voted ? '#7C3AED' : '#374151' }]}>
                {item.upvote_count}
              </Text>
            </Pressable>
          </Pressable>
        ) : (
          /* No poster — show vote badge standalone */
          <Pressable style={styles.voteStandalone} onPress={(e) => { e.stopPropagation(); handleVote(); }} hitSlop={6}>
            <Text style={styles.voteFire}>🔥</Text>
            <Text style={[styles.voteCount, { color: item.has_voted ? '#7C3AED' : '#374151' }]}>
              {item.upvote_count}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
  },
  inner: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    alignItems: 'stretch',
    minHeight: 140,
  },
  left: {
    flex: 1,
    gap: 6,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 2,
  },
  badgeText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 10,
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 17,
    color: '#111827',
    lineHeight: 22,
  },
  showName: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: '#6B7280',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarExtra: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarExtraText: {
    fontSize: 11,
    fontFamily: BrandFonts.syneBold,
  },
  talkingText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 12,
    color: '#6B7280',
  },
  posterWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  poster: {
    width: 90,
    height: 120,
    borderRadius: 12,
  },
  voteBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  voteFire: { fontSize: 12 },
  voteCount: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12,
  },
  voteStandalone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
});
