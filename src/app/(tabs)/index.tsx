import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { FeedViewSwitcher, type FeedView } from '@/components/feed/feed-view-switcher';
import { FilterChips } from '@/components/feed/filter-chips';
import { NowBanner } from '@/components/feed/now-banner';
import { PostCard } from '@/components/feed/post-card';
import { SectionLabel } from '@/components/feed/section-label';
import { TrendingList } from '@/components/feed/trending-list';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import {
  useFeedPosts,
  useDeletePost,
  useGlobalPosts,
  type FeedFilterValue,
  type Post,
} from '@/features/feed/api';
import { useForYouRecs, type ForYouSeed } from '@/features/feed/for-you';
import { computeTrendingInCircle } from '@/features/feed/trending';
import { computeCompatibility } from '@/features/friends/compatibility';
import { useReactions, useToggleReaction } from '@/features/feed/reactions';
import { useLibraryItems } from '@/features/library/api';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const SECTION_TITLES: Record<FeedView, string> = {
  feed: 'Friend Activity',
  circle: 'Trending in My Circle',
  global: 'Trending Globally',
  foryou: 'For You',
};

const VERBS: Record<Post['type'], string> = {
  watch: 'Watching',
  read: 'Reading',
  play: 'Playing',
  listen: 'Listening to',
  podcast: 'Listening to',
};

export default function FeedScreen() {
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();

  const [feedView, setFeedView] = useState<FeedView>('feed');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [showMenu, setShowMenu] = useState(false);
  const { posts, allPosts, isLoading, isFetching, refetch } = useFeedPosts(filter);
  const { data: globalPosts } = useGlobalPosts();
  const deletePost = useDeletePost();
  const { logged } = useLibraryItems();
  const { byPost: reactionsByPost } = useReactions(posts.map((p) => p.id));
  const toggleReaction = useToggleReaction();

  const loggedTitles = new Set(logged.map((item) => item.title.toLowerCase()));
  const matchesFilter = (type: Post['type']) => filter === 'all' || type === filter;

  const circleTrending = computeTrendingInCircle(allPosts, 20).filter((e) => matchesFilter(e.type));
  const globalTrending = computeTrendingInCircle(globalPosts ?? [], 20).filter((e) => matchesFilter(e.type));

  const compatScores = useMemo(() => {
    const map = new Map<string, number>();
    if (!user?.id) return map;
    const myPosts = allPosts.filter((p) => p.user_id === user.id);
    const byUser = new Map<string, Post[]>();
    for (const p of allPosts) {
      if (p.user_id === user.id) continue;
      const bucket = byUser.get(p.user_id) ?? [];
      bucket.push(p);
      byUser.set(p.user_id, bucket);
    }
    for (const [uid, uPosts] of byUser) {
      map.set(uid, computeCompatibility(myPosts, uPosts));
    }
    return map;
  }, [allPosts, user?.id]);

  // One best-rated seed per content type so API recs cover every type the user has logged.
  // Taking top-5 overall skewed to all-games when games were the user's highest-rated items.
  const bestByType = new Map<EntryType, (typeof logged)[0]>();
  for (const item of logged) {
    const cur = bestByType.get(item.type);
    if (!cur || (item.rating ?? 0) > (cur.rating ?? 0)) bestByType.set(item.type, item);
  }
  const forYouSeeds: ForYouSeed[] = [...bestByType.values()].map((item) => ({
    title: item.title,
    type: item.type,
    externalId: item.external_id,
    mediaType: item.media_type,
  }));

  const { data: rawApiRecs = [] } = useForYouRecs(forYouSeeds);

  // For types the API returned results for, show those discoveries.
  // For types it didn't cover (or where the user has no logged items of that type),
  // fall back to circle-based trending so the section always has variety.
  const circleTitles = new Set(circleTrending.map((e) => e.title.toLowerCase()));
  const apiTypes = new Set(rawApiRecs.map((e) => e.type));

  const apiEntries = rawApiRecs.filter(
    (e) =>
      matchesFilter(e.type) &&
      !loggedTitles.has(e.title.toLowerCase()) &&
      !circleTitles.has(e.title.toLowerCase()),
  );

  const circleFallbackEntries = computeTrendingInCircle(allPosts, 30).filter(
    (e) =>
      !apiTypes.has(e.type) &&
      matchesFilter(e.type) &&
      !loggedTitles.has(e.title.toLowerCase()),
  );

  const forYouTrending = [...apiEntries, ...circleFallbackEntries]
    .sort((a, b) => b.count - a.count)
    .slice(0, 60);

  const latest = logged[0] ?? allPosts[0];
  const nowLabel = latest ? `You're ${VERBS[latest.type].toLowerCase()}` : 'Get started';
  const nowTitle = latest ? latest.title : 'Log your first watch, read, or play';
  const nowPoster = latest?.poster ?? null;

  function openProfile() {
    setShowMenu(false);
    router.push('/profile');
  }

  function openSettings() {
    setShowMenu(false);
    router.push('/settings');
  }

  const header = (
    <View>
      <View style={styles.headerTop}>
        <View style={styles.logoWrap}>
          <View style={styles.logoCircles}>
            <View style={styles.logoCirclePurple} />
            <View style={styles.logoCircleOrange} />
          </View>
          <Text style={styles.logoThe}>the</Text>
          <Text style={styles.logoClique}>clique</Text>
        </View>
        <Pressable onPress={() => setShowMenu((v) => !v)} style={styles.avatarBtn} hitSlop={8}>
          <Avatar
            name={profile?.full_name ?? user?.email ?? 'You'}
            size={42}
            avatarUrl={profile?.avatar_url}
            ring={Brand.trust}
          />
        </Pressable>
      </View>
      <FeedViewSwitcher value={feedView} onChange={setFeedView} />
      {feedView === 'feed' && (
        <NowBanner
          label={nowLabel}
          title={nowTitle}
          poster={nowPoster}
          onPressLog={() => router.push('/log-modal')}
        />
      )}
      <FilterChips value={filter} onChange={setFilter} />
      <SectionLabel>{SECTION_TITLES[feedView]}</SectionLabel>
    </View>
  );

  const entries = feedView === 'circle' ? circleTrending : feedView === 'global' ? globalTrending : forYouTrending;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {feedView !== 'feed' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <TrendingList
            entries={entries}
            showTop10Banner
            bannerTitle={feedView === 'foryou' ? 'Top recos for you' : 'Top 10 right now'}
          />
        </ScrollView>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={posts}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Brand.trust} />
          }
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const reactions = reactionsByPost.get(item.id) ?? [];
            const meReacted = reactions.some((r) => r.user_id === user?.id);
            return (
              <PostCard
                post={item}
                isMine={item.user_id === user?.id}
                currentUserId={user?.id}
                reactions={reactions}
                compatScore={item.user_id === user?.id ? undefined : compatScores.get(item.user_id)}
                onToggleReaction={() => toggleReaction.mutate({ postId: item.id, reacted: meReacted })}
                onDelete={() => deletePost.mutate(item.id)}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>👋</Text>
                <Text style={styles.emptyTitle}>Your feed is empty</Text>
                <Text style={styles.emptyBody}>
                  Log something to see it show up here. Friend activity is coming in Phase 3.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Avatar dropdown menu */}
      {showMenu && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setShowMenu(false)} />
          <View style={styles.menuCard}>
            <Pressable style={styles.menuItem} onPress={openProfile}>
              <Text style={styles.menuItemText}>👤  Profile</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={openSettings}>
              <Text style={styles.menuItemText}>⚙️  Settings</Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.four,
    },
    logoWrap: { alignItems: 'flex-start' },
    avatarBtn: { position: 'absolute', right: 0, top: 0 },
    logoCircles: { width: 56, height: 42, marginBottom: 6 },
    logoCirclePurple: {
      position: 'absolute',
      left: 0,
      top: 0,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Brand.trust,
      opacity: 0.85,
    },
    logoCircleOrange: {
      position: 'absolute',
      left: 20,
      top: 0,
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: Brand.warm,
      opacity: 0.85,
    },
    logoThe: { fontFamily: BrandFonts.poppinsMedium, fontSize: 14, color: Brand.muted },
    logoClique: {
      fontFamily: BrandFonts.poppinsExtraBold,
      fontSize: 32,
      color: Brand.ink,
      letterSpacing: -0.5,
      lineHeight: 34,
    },
    empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, marginBottom: 8 },
    emptyBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 19,
    },

    // Dropdown menu
    menuBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    menuCard: {
      position: 'absolute',
      top: 48,
      right: Spacing.three,
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      minWidth: 180,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 8,
      zIndex: 100,
    },
    menuItem: { paddingVertical: 14, paddingHorizontal: 18 },
    menuItemText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    menuDivider: { height: 1, backgroundColor: Brand.border, marginHorizontal: 14 },
  });
}
