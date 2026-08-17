import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { Alert, ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscussionCard } from '@/components/feed/discussion-card';
import { NewsCard } from '@/components/news/news-card';
import { BrandFonts } from '@/constants/theme';
import { useContentRoomDiscussions, useRoomFollowState, useToggleRoomFollow, useMuteRoomFollow } from '@/features/discussions/api';
import { useContentRoomNews } from '@/features/news/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: 'Film',
  tv: 'TV',
  book: 'Book',
  game: 'Game',
  album: 'Music',
  podcast: 'Podcast',
};

type Tab = 'discussions' | 'news';

export default function ContentRoomModal() {
  const { externalId, mediaType, title, poster } = useLocalSearchParams<{
    externalId: string;
    mediaType: string;
    title: string;
    poster?: string;
  }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const { user } = useSession();

  const [tab, setTab] = useState<Tab>('discussions');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');

  const { data: discussions = [], isLoading: discussionsLoading } = useContentRoomDiscussions(externalId, mediaType);
  const { data: newsArticles = [], isLoading: newsLoading } = useContentRoomNews(title, mediaType);

  const sortedDiscussions = useMemo(() => {
    if (sort === 'newest') return [...discussions].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return [...discussions].sort((a, b) => (b.comment_count + b.upvote_count) - (a.comment_count + a.upvote_count));
  }, [discussions, sort]);

  const { data: followState = { following: false, muted: false, rowId: null } } = useRoomFollowState(externalId, mediaType);
  const toggleFollow = useToggleRoomFollow();
  const muteFollow = useMuteRoomFollow();

  const typeLabel = MEDIA_TYPE_LABELS[mediaType ?? ''] ?? mediaType ?? '';
  const tcKey = mediaType === 'movie' || mediaType === 'tv' ? 'watch'
    : mediaType === 'book' ? 'read'
    : mediaType === 'game' ? 'play'
    : mediaType === 'album' ? 'listen'
    : mediaType === 'podcast' ? 'podcast'
    : null;
  const typeColors = tcKey ? (TypeColors as any)[tcKey] : { color: '#6B7280', bg: '#F3F4F6' };

  function handleStart() {
    router.push({
      pathname: '/create-discussion-modal',
      params: { prefillExternalId: externalId, prefillMediaType: mediaType, prefillTitle: title, prefillPoster: poster ?? '' },
    });
  }

  // Map mediaType → EntryType for content-detail-modal
  const ENTRY_TYPE: Record<string, string> = {
    tv: 'watch', movie: 'watch', book: 'read', game: 'play', album: 'listen', podcast: 'podcast',
  };

  function handlePosterPress() {
    router.push({
      pathname: '/content-detail-modal',
      params: {
        title: title ?? '',
        type: ENTRY_TYPE[mediaType ?? ''] ?? 'watch',
        poster: poster ?? '',
        externalId: externalId ?? '',
        mediaType: mediaType ?? '',
      },
    });
  }

  // Header shared between both tabs
  const ListHeader = (
    <View style={styles.header}>
      {/* Poster + info */}
      <View style={styles.heroRow}>
        {poster ? (
          <Pressable onPress={handlePosterPress} hitSlop={4} accessibilityRole="button" accessibilityLabel="View content details">
            <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={poster} />
          </Pressable>
        ) : (
          <Pressable onPress={handlePosterPress} hitSlop={4} style={[styles.posterPlaceholder, { backgroundColor: typeColors.bg }]} accessibilityRole="button" accessibilityLabel="View content details">
            <SymbolView name="photo" size={28} tintColor={typeColors.color} type="monochrome" style={{ width: 28, height: 28 }} />
          </Pressable>
        )}
        <View style={styles.heroInfo}>
          <View style={[styles.typePill, { backgroundColor: typeColors.bg }]}>
            <Text style={[styles.typeText, { color: typeColors.color }]}>{typeLabel.toUpperCase()}</Text>
          </View>
          <Text style={[styles.roomTitle, { color: Brand.ink }]}>{title}</Text>
          <Text style={[styles.roomSub, { color: Brand.muted }]}>
            {discussions.length} {discussions.length === 1 ? 'discussion' : 'discussions'}
          </Text>
        </View>
      </View>

      {/* Start discussion CTA */}
      <Pressable style={[styles.startBtn, { backgroundColor: Brand.trust }]} onPress={handleStart}>
        <SymbolView name="plus" size={13} tintColor="#fff" type="monochrome" style={{ width: 13, height: 13 }} />
        <Text style={styles.startBtnText}>Start a discussion</Text>
      </Pressable>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: Brand.border }]}>
        {(['discussions', 'news'] as Tab[]).map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} style={styles.tabItem} accessibilityRole="button" accessibilityLabel={t === 'discussions' ? 'Discussions' : 'News'}>
            <Text style={[styles.tabLabel, { color: tab === t ? Brand.trust : Brand.muted }]}>
              {t === 'discussions' ? 'Discussions' : 'News'}
            </Text>
            {tab === t && <View style={[styles.tabUnderline, { backgroundColor: Brand.trust }]} />}
          </Pressable>
        ))}
      </View>

      {/* Sort row — only on discussions tab */}
      {tab === 'discussions' && discussions.length > 0 && (
        <View style={styles.sortRow}>
          <Text style={[styles.sectionLabel, { color: Brand.muted }]}>DISCUSSIONS</Text>
          <View style={styles.sortToggle}>
            {(['popular', 'newest'] as const).map((opt) => (
              <Pressable
                key={opt}
                onPress={() => setSort(opt)}
                style={[styles.sortBtn, sort === opt && { backgroundColor: Brand.trust }]}
                accessibilityRole="button"
                accessibilityLabel={opt === 'popular' ? 'Sort by most popular' : 'Sort by newest'}>
                <Text style={[styles.sortBtnText, { color: sort === opt ? '#fff' : Brand.muted }]}>
                  {opt === 'popular' ? 'Most Popular' : 'Newest'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Brand.paper }]} edges={['top']}>
      {/* Nav */}
      <View style={[styles.navBar, { borderBottomColor: Brand.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
          <Text style={[styles.backText, { color: Brand.trust }]}>Back</Text>
        </Pressable>
        <View style={styles.navRight}>
          {followState.following && followState.rowId && followState.rowId !== 'optimistic' && (
            <Pressable
              hitSlop={12}
              style={[styles.muteBtn, { borderColor: Brand.border }]}
              onPress={() => muteFollow.mutate(
                { rowId: followState.rowId!, muted: !followState.muted, externalId: externalId!, mediaType: mediaType!, userId: user?.id },
                { onError: (err: any) => Alert.alert('Mute error', err?.message ?? JSON.stringify(err)) },
              )}
              disabled={muteFollow.isPending}
              accessibilityRole="button"
              accessibilityLabel={followState.muted ? 'Unmute room' : 'Mute room'}>
              <SymbolView
                name={followState.muted ? 'bell.slash.fill' : 'bell.fill'}
                size={14}
                tintColor={followState.muted ? Brand.muted : Brand.trust}
                type="monochrome"
                style={{ width: 14, height: 14 }}
              />
            </Pressable>
          )}
          <Pressable
            hitSlop={12}
            style={[styles.followBtn, followState.following
              ? { backgroundColor: Brand.trust }
              : { backgroundColor: 'transparent', borderWidth: 1, borderColor: Brand.trust }]}
            onPress={() => toggleFollow.mutate({ externalId: externalId!, mediaType: mediaType!, following: followState.following })}
            disabled={toggleFollow.isPending}
            accessibilityRole="button"
            accessibilityLabel={followState.following ? 'Unfollow room' : 'Follow room'}>
            <Text style={[styles.followBtnText, { color: followState.following ? '#fff' : Brand.trust }]}>
              {followState.following ? 'Following' : 'Follow'}
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === 'discussions' ? (
        <FlatList
          data={sortedDiscussions}
          keyExtractor={(d) => d.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={() => ListHeader}
          renderItem={({ item }) => <DiscussionCard item={item} suppressContentRoom />}
          ListEmptyComponent={
            discussionsLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Brand.trust} />
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                <Text style={[styles.emptyTitle, { color: Brand.ink }]}>No discussions yet</Text>
                <Text style={[styles.emptySub, { color: Brand.muted }]}>Be the first to start one about {title}</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={newsArticles}
          keyExtractor={(a) => a.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={() => ListHeader}
          renderItem={({ item }) => (
            <View style={styles.newsCardWrap}>
              <NewsCard article={item} onPress={() => Linking.openURL(item.url)} />
            </View>
          )}
          ListEmptyComponent={
            newsLoading ? (
              <ActivityIndicator style={{ marginTop: 40 }} color={Brand.trust} />
            ) : (
              <View style={[styles.emptyCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                <Text style={[styles.emptyTitle, { color: Brand.ink }]}>No news found</Text>
                <Text style={[styles.emptySub, { color: Brand.muted }]}>Nothing yet for "{title}"</Text>
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  navRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  muteBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  followBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  followBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
  backText: { fontFamily: BrandFonts.interMedium, fontSize: 15 },
  list: { padding: 16, paddingBottom: 40 },
  header: { gap: 14, marginBottom: 8 },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  poster: { width: 72, height: 100, borderRadius: 10, flexShrink: 0 },
  posterPlaceholder: {
    width: 72, height: 100, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroInfo: { flex: 1, gap: 6, paddingTop: 2 },
  typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeText: { fontFamily: BrandFonts.interMedium, fontSize: 10, letterSpacing: 0.5 },
  roomTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, lineHeight: 26 },
  roomSub: { fontFamily: BrandFonts.interRegular, fontSize: 13 },
  startBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, borderRadius: 14, paddingVertical: 12,
  },
  startBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  tabItem: {
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginRight: 20,
    position: 'relative',
  },
  tabLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
  },
  tabUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },

  sortRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginTop: 4,
  },
  sectionLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, letterSpacing: 0.8 },
  sortToggle: { flexDirection: 'row', gap: 4 },
  sortBtn: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: 'rgba(0,0,0,0.06)' },
  sortBtnText: { fontFamily: BrandFonts.interMedium, fontSize: 12 },

  newsCardWrap: { marginBottom: 10 },

  emptyCard: {
    alignItems: 'center', borderWidth: 1, borderRadius: 18,
    borderStyle: 'dashed', padding: 32, gap: 6,
  },
  emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15 },
  emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, textAlign: 'center' },
});
