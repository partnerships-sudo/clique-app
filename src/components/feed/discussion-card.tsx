import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { type Discussion, timeAgo, useToggleDiscussionVote } from '@/features/discussions/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const TYPE_LABELS: Record<string, string> = {
  read: 'Books',
  watch: 'TV & Film',
  tv: 'TV & Film',
  play: 'Games',
  listen: 'Music',
  podcast: 'Podcasts',
  general: 'General',
};

export function DiscussionCard({ item }: { item: Discussion }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const { user } = useSession();
  const vote = useToggleDiscussionVote();

  const typeKey = item.type === 'tv' ? 'watch' : item.type;
  const typeColor = (TypeColors as any)[typeKey] ?? { color: '#6B7280', bg: '#F3F4F6' };
  const typeLabel = TYPE_LABELS[item.type] ?? item.type;

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
    <Pressable style={[styles.card, { backgroundColor: Brand.card, borderColor: Brand.border }]} onPress={handleOpenDiscussion}>
      {/* Content row: text + optional poster */}
      <View style={styles.contentRow}>
        <View style={styles.textBlock}>
          {/* Content title pill — taps into content room */}
          {hasLinkedContent ? (
            <Pressable onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }} hitSlop={4} style={styles.pillWrap}>
              <View style={[styles.contentPill, { backgroundColor: Brand.tlight }]}>
                <Text style={[styles.contentPillText, { color: Brand.trust }]} numberOfLines={1}>
                  {item.content_title}
                </Text>
              </View>
            </Pressable>
          ) : null}

          {/* Discussion question */}
          <Text style={[styles.title, { color: Brand.ink }]} numberOfLines={2}>{item.title}</Text>

          {item.body ? (
            <Text style={[styles.body, { color: Brand.muted }]} numberOfLines={2}>{item.body}</Text>
          ) : null}
        </View>

        {/* Poster — taps into content room */}
        {item.content_poster ? (
          <Pressable onPress={(e) => { e.stopPropagation(); handleOpenContentRoom(); }} hitSlop={4}>
            <Image source={{ uri: item.content_poster }} style={styles.poster} resizeMode="cover" />
          </Pressable>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={styles.authorRow}
          onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: item.user_id } })}
          hitSlop={6}>
          <Avatar avatarUrl={item.author_avatar} name={item.author_name} size={20} />
          <Text style={[styles.meta, { color: Brand.muted }]}>
            @{item.author_name} · {timeAgo(item.created_at)}
          </Text>
        </Pressable>

        <View style={styles.footerRight}>
          {/* Comments */}
          <Pressable style={styles.stat} onPress={handleOpenDiscussion} hitSlop={8}>
            <SymbolView name="bubble.left" size={13} tintColor={Brand.muted} type="monochrome" style={{ width: 13, height: 13 }} />
            <Text style={[styles.statText, { color: Brand.muted }]}>{item.comment_count}</Text>
          </Pressable>

          {/* Upvote */}
          <Pressable style={styles.stat} onPress={handleVote} hitSlop={8}>
            <SymbolView
              name={item.has_voted ? 'arrow.up.circle.fill' : 'arrow.up.circle'}
              size={15}
              tintColor={item.has_voted ? Brand.trust : Brand.muted}
              type="monochrome"
              style={{ width: 15, height: 15 }}
            />
            <Text style={[styles.statText, { color: item.has_voted ? Brand.trust : Brand.muted }]}>
              {item.upvote_count}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
    gap: 4,
    marginBottom: 6,
  },
  pillWrap: { alignSelf: 'flex-start' },
  contentPill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  contentPillText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  typePill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  typeText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  contentRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 13,
    lineHeight: 17,
  },
  body: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    lineHeight: 15,
  },
  contentTitle: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 10,
    marginTop: 2,
  },
  poster: {
    width: 44,
    height: 62,
    borderRadius: 6,
    flexShrink: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  meta: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 10,
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 11,
  },
});
