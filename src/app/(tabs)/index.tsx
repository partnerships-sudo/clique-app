import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BecauseYouRow } from '@/components/feed/because-you-row';
import { FeedViewSwitcher, type FeedView } from '@/components/feed/feed-view-switcher';
import { FilterChips } from '@/components/feed/filter-chips';
import { MostReviewedSection } from '@/components/feed/most-reviewed-section';
import { NowBanner } from '@/components/feed/now-banner';
import { PostCard } from '@/components/feed/post-card';
import { CloseFriendsButton } from '@/components/feed/stories-strip';
import { SectionHeader } from '@/components/feed/section-header';
import { SectionLabel } from '@/components/feed/section-label';
import { TopPicksRow } from '@/components/feed/top-picks-row';
import { TrendingList } from '@/components/feed/trending-list';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import {
  useFeedPosts,
  useCircleLogActivity,
  useDeletePost,
  useGlobalPosts,
  type FeedFilterValue,
  type Post,
} from '@/features/feed/api';
import { useHiddenCategories } from '@/features/feed/category-prefs';
import { useBecauseYouRecs, useForYouRecs, type ForYouSeed } from '@/features/feed/for-you';
import { computeTrendingInCircle, type TrendingEntry } from '@/features/feed/trending';
import { computeCompatibility } from '@/features/friends/compatibility';
import { applyGameCovers, useGameCoverOverrides } from '@/features/games/igdb';
import { useReactions, useToggleReaction } from '@/features/feed/reactions';
import { useLibraryItems } from '@/features/library/api';
import { useCollectionItems, useFollowingCollections } from '@/features/collection/api';
import { useCompatItems, useFollowing } from '@/features/follows/api';
import { useProfile } from '@/features/profile/api';
import { useCloseFriendsPosts } from '@/features/close-friends/posts';
import { useUnreadCount } from '@/features/notifications/inbox';
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

const PAST_VERBS: Record<Post['type'], string> = {
  watch: 'watched',
  read: 'read',
  play: 'played',
  listen: 'listened to',
  podcast: 'listened to',
};

export default function FeedScreen() {
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const { data: storyPosts = [] } = useCloseFriendsPosts();
  const unreadCount = useUnreadCount();

  const [feedView, setFeedView] = useState<FeedView>('feed');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [showMenu, setShowMenu] = useState(false);
  const { hidden: hiddenCategories, hideCategory, showCategory } = useHiddenCategories(profile?.content_types);
  const { posts: rawPosts, allPosts, isLoading, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeedPosts(filter);
  const { data: circleActivity = [] } = useCircleLogActivity();
  // Long-press-removed categories (see filter-chips.tsx) drop out of the feed
  // entirely, not just the chip row — same treatment as the active filter.
  const posts = rawPosts.filter((p) => !hiddenCategories.has(p.type));
  const { data: globalPosts } = useGlobalPosts();
  const deletePost = useDeletePost();
  const { logged } = useLibraryItems();
  const { items: collectionItems } = useCollectionItems();
  const { data: followingCollections = [] } = useFollowingCollections();
  const { data: followingProfiles = [] } = useFollowing();
  const { data: compatItemsMap } = useCompatItems();
  const followingProfileMap = useMemo(
    () => Object.fromEntries(followingProfiles.map((p) => [p.id, p])),
    [followingProfiles],
  );
  const { byPost: reactionsByPost } = useReactions(posts.map((p) => p.id));
  const myLatestCFPost = useMemo(() => {
    if (!user?.id) return null;
    return allPosts
      .filter((p) => p.user_id === user.id && p.visibility === 'close_friends')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  }, [allPosts, user?.id]);
  const toggleReaction = useToggleReaction();

  // Keyed by type + title, not title alone — a logged book and a recommended
  // game can share an exact title (e.g. "Dune"), and a title-only check would
  // wrongly treat the game as "already logged" and filter it out.
  const loggedTitles = new Set([
    ...logged.map((item) => `${item.type}:${item.title.toLowerCase()}`),
    ...collectionItems.map((item) => `${item.type}:${item.title.toLowerCase()}`),
  ]);
  const matchesFilter = (type: Post['type']) => (filter === 'all' || type === filter) && !hiddenCategories.has(type);

  const circleTrendingRaw = computeTrendingInCircle(circleActivity, 20).filter((e) => matchesFilter(e.type));
  const globalTrendingRaw = computeTrendingInCircle(globalPosts ?? [], 20).filter((e) => matchesFilter(e.type));

  const compatScores = useMemo(() => {
    const map = new Map<string, number>();
    if (!user?.id || !compatItemsMap) return map;
    const myItems = compatItemsMap.get(user.id) ?? [];
    for (const [uid, items] of compatItemsMap) {
      if (uid === user.id) continue;
      map.set(uid, computeCompatibility(myItems, items));
    }
    return map;
  }, [compatItemsMap, user?.id]);

  // ── Seed building ──────────────────────────────────────────────────────────
  // Seeds drive the API recommendation calls. Score = rating + recency bonus
  // so something you rated 5★ last week outranks something you rated 5★ two
  // years ago. Collection items get a +10 bonus (they carry a deliberate rating).
  // Top 5 per type so we explore your taste more broadly.
  const MAX_SEEDS_PER_TYPE = 5;
  const now = Date.now();

  function recencyBonus(createdAt: string): number {
    const ageMs = now - new Date(createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays <= 14) return 6;
    if (ageDays <= 30) return 4;
    if (ageDays <= 90) return 2;
    return 0;
  }

  type SeedCandidate = { title: string; type: EntryType; external_id: string | null; media_type: string | null; seedScore: number };
  const candidatesByType = new Map<EntryType, SeedCandidate[]>();

  for (const item of collectionItems) {
    const type = item.type as EntryType;
    const bucket = candidatesByType.get(type) ?? [];
    // Scale collection rating (0–5) to 0–100 so it dominates; recency is a small tie-breaker
    const rating = (item.user_rating ?? 0) * 20;
    bucket.push({ title: item.title, type, external_id: item.external_id, media_type: item.media_type, seedScore: rating + recencyBonus(item.created_at) });
    candidatesByType.set(type, bucket);
  }
  for (const item of logged) {
    const bucket = candidatesByType.get(item.type) ?? [];
    // Scale feed rating (0–10) to 0–100 so it dominates; recency is a small tie-breaker
    const rating = (item.rating ?? 0) * 10;
    bucket.push({ title: item.title, type: item.type, external_id: item.external_id, media_type: item.media_type, seedScore: rating + recencyBonus(item.created_at) });
    candidatesByType.set(item.type, bucket);
  }

  const forYouSeeds: ForYouSeed[] = [...candidatesByType.values()].flatMap((items) =>
    [...items]
      .sort((a, b) => b.seedScore - a.seedScore)
      .slice(0, MAX_SEEDS_PER_TYPE)
      .map((item) => ({
        title: item.title,
        type: item.type,
        externalId: item.external_id,
        mediaType: item.media_type,
      })),
  );

  const { data: rawApiRecs = [] } = useForYouRecs(forYouSeeds);

  // ── Friend-sourced picks ───────────────────────────────────────────────────
  // Two sources: (1) items friends have in their collection with a high rating,
  // (2) items friends have posted/logged. Both are weighted by compat score so
  // a 🔥 90%+ match recommending something scores much higher than a 55% match.
  // Score formula: compat drives 70% of the signal, rating the other 30%.
  // Items the user already has in their own library are excluded.
  function friendScore(compat: number, rating: number, maxRating: number): number {
    const ratingNorm = (rating / maxRating) * 100;
    return Math.round(compat * 0.7 + ratingNorm * 0.3);
  }

  const friendPickMap = new Map<string, TrendingEntry>();

  // Source 1: following collections (explicit ratings)
  for (const item of followingCollections) {
    const key = `${item.type}:${item.title.toLowerCase()}`;
    if (loggedTitles.has(key)) continue;
    if (!matchesFilter(item.type as Post['type'])) continue;
    const rating = item.user_rating ?? 0;
    if (rating < 3) continue;
    const compat = compatScores.get(item.user_id) ?? 0;
    const score = friendScore(compat, rating, 5);
    const existing = friendPickMap.get(key);
    if (!existing || score > existing.score!) {
      friendPickMap.set(key, {
        title: item.title,
        sub: item.sub ?? null,
        type: item.type as EntryType,
        poster: item.poster ?? null,
        count: 1,
        score,
        users: [],
        loggers: [{ name: followingProfileMap[item.user_id]?.username ?? 'Friend', avatarUrl: followingProfileMap[item.user_id]?.avatar_url ?? null }],
        externalId: item.external_id ?? undefined,
        mediaType: item.media_type ?? undefined,
      });
    }
  }

  // Source 2: friend posts (logged activity) — rating out of 10
  for (const p of allPosts) {
    if (p.user_id === user?.id) continue;
    if (!p.rating) continue;
    if (p.rating < 6) continue; // only well-rated posts
    const key = `${p.type}:${p.title.toLowerCase()}`;
    if (loggedTitles.has(key)) continue;
    if (!matchesFilter(p.type)) continue;
    const compat = compatScores.get(p.user_id) ?? 0;
    const score = friendScore(compat, p.rating, 10);
    const existing = friendPickMap.get(key);
    if (!existing || score > existing.score!) {
      friendPickMap.set(key, {
        title: p.title,
        sub: p.sub ?? null,
        type: p.type as EntryType,
        poster: p.poster ?? null,
        count: 1,
        score,
        users: [],
        loggers: [{ name: p.user_name, avatarUrl: p.user_avatar_url ?? null }],
        externalId: p.external_id ?? undefined,
        mediaType: p.media_type ?? undefined,
      });
    }
  }

  const friendCollectionPicks: TrendingEntry[] = [...friendPickMap.values()]
    .sort((a, b) => b.score! - a.score!);

  // For types the API returned results for, show those discoveries.
  // For types it didn't cover (or where the user has no logged items of that type),
  // fall back to circle-based trending so the section always has variety.
  // Type + title keyed for the same reason as loggedTitles above.
  const circleTitles = new Set(circleTrendingRaw.map((e) => `${e.type}:${e.title.toLowerCase()}`));
  const apiTypes = new Set(rawApiRecs.map((e) => e.type));

  // Build a map of type:title → friend posts so we can surface recs that
  // overlap with what high-compat friends have logged.
  const friendPostsByKey = new Map<string, Post[]>();
  for (const p of allPosts) {
    if (p.user_id === user?.id) continue;
    const key = `${p.type}:${p.title.toLowerCase()}`;
    const bucket = friendPostsByKey.get(key) ?? [];
    bucket.push(p);
    friendPostsByKey.set(key, bucket);
  }

  const apiEntries = rawApiRecs
    .filter(
      (e) =>
        matchesFilter(e.type) &&
        !loggedTitles.has(`${e.type}:${e.title.toLowerCase()}`) &&
        !circleTitles.has(`${e.type}:${e.title.toLowerCase()}`),
    )
    .map((e) => {
      const friendPosts = friendPostsByKey.get(`${e.type}:${e.title.toLowerCase()}`) ?? [];
      if (friendPosts.length === 0) return e;
      // Weight by the highest compat among friends who logged it — one 🔥 friend
      // is a stronger signal than averaging across all friends including weak matches.
      const maxCompat = Math.max(...friendPosts.map((p) => compatScores.get(p.user_id) ?? 50));
      return {
        ...e,
        loggers: friendPosts.map((p) => ({ name: p.user_name, avatarUrl: p.user_avatar_url ?? null })),
        score: Math.min(100, (e.score ?? 50) * 0.3 + maxCompat * 0.7),
      };
    });

  const circleFallbackEntriesRaw = computeTrendingInCircle(circleActivity, 30).filter(
    (e) =>
      !apiTypes.has(e.type) &&
      matchesFilter(e.type) &&
      !loggedTitles.has(`${e.type}:${e.title.toLowerCase()}`),
  );

  // Trending entries carry whatever poster was saved on the post at log
  // time — for games logged before IGDB was wired in, that's RAWG's
  // landscape screenshot, permanently. Resolve fresh covers for every game
  // title in play here and override the stale stored one.
  const gameCovers = useGameCoverOverrides(
    [...circleTrendingRaw, ...globalTrendingRaw, ...circleFallbackEntriesRaw]
      .filter((e) => e.type === 'play')
      .map((e) => e.title),
  );
  const circleTrending = applyGameCovers(circleTrendingRaw, gameCovers);
  const globalTrending = applyGameCovers(globalTrendingRaw, gameCovers);
  const circleFallbackEntries = applyGameCovers(circleFallbackEntriesRaw, gameCovers);

  // apiEntries carry a real normalized 0-100 `score` (see for-you.ts). Circle
  // entries only have a raw log count, which isn't on the same scale — approximate
  // one so a couple of friends logging something can still compete fairly
  // against algorithmic picks, without a single log always losing outright.
  const forYouTrending = [...friendCollectionPicks, ...apiEntries, ...circleFallbackEntries]
    .filter((e, i, arr) => arr.findIndex((x) => x.type === e.type && x.title.toLowerCase() === e.title.toLowerCase()) === i)
    .sort((a, b) => (b.score ?? Math.min(100, b.count * 20)) - (a.score ?? Math.min(100, a.count * 20)))
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

  function openWatchParty() {
    setShowMenu(false);
    router.push('/premiere-modal');
  }

  const header = (
    <View>
      <View style={styles.headerTop}>
        {/* Left: close friends / stories button */}
        <CloseFriendsButton
          posts={storyPosts}
          onPress={() => router.push('/stories-modal')}
        />

        {/* Center: logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require('@/assets/images/logo-icon.png')}
            style={styles.logoIcon}
            resizeMode="contain"
          />
          <View style={styles.logoWordRow}>
            <Text style={styles.logoClique}>cl</Text>
            <View style={styles.logoIWrap}>
              <View style={styles.logoIDot} />
              <Text style={styles.logoClique}>{'ı'}</Text>
            </View>
            <Text style={styles.logoClique}>que</Text>
          </View>
        </View>

        {/* Right: bell + avatar */}
        <View style={styles.headerRight}>
          <Pressable hitSlop={8} onPress={() => router.push('/notifications-modal')} style={styles.bellWrap}>
            <SymbolView name="bell" size={22} tintColor={Brand.ink} style={{ width: 24, height: 24 }} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => setShowMenu((v) => !v)} hitSlop={8}>
            <Avatar
              name={profile?.full_name ?? user?.email ?? 'You'}
              size={36}
              avatarUrl={profile?.avatar_url}
              ring={Brand.trust}
            />
          </Pressable>
        </View>
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
      {feedView === 'feed' && myLatestCFPost ? (() => {
        const hearts = reactionsByPost.get(myLatestCFPost.id) ?? [];
        return (
          <Pressable
            style={styles.cfBanner}
            onPress={() => router.push({ pathname: '/stories-modal', params: { postId: myLatestCFPost.id } })}>
            <Text style={styles.cfBannerText}>
              💚 Your close friends can see this
              {hearts.length > 0 ? ` · ${hearts.length} ❤️` : ''}
            </Text>
            <Text style={styles.cfBannerChevron}>›</Text>
          </Pressable>
        );
      })() : null}
      <FilterChips
        value={filter}
        onChange={setFilter}
        hiddenTypes={hiddenCategories}
        onHide={hideCategory}
        onShow={showCategory}
      />
      {feedView !== 'foryou' && <SectionLabel>{SECTION_TITLES[feedView]}</SectionLabel>}
    </View>
  );

  const entries = feedView === 'circle' ? circleTrending : globalTrending;

  // One seed per content type — prefer highest-rated logged item, fall back to
  // collection items so all 5 category rows can appear even if the user hasn't
  // posted to the feed for that type yet.
  const SEED_TYPES = ['watch', 'play', 'read', 'listen', 'podcast'] as const;

  function bestSeedForType(t: typeof SEED_TYPES[number]) {
    // Gather candidates from both feed logs and collection, preferring items with
    // a known external ID (IGDB/TMDB/etc) since those have richer rec data.
    const feedCandidates = logged
      .filter((item) => item.type === t)
      .map((item) => ({ title: item.title, type: item.type, external_id: item.external_id, media_type: item.media_type, rating: item.rating ?? 0, hasId: !!item.external_id }));
    const collCandidates = collectionItems
      .filter((item) => item.type === t)
      .map((item) => ({ title: item.title, type: item.type as typeof t, external_id: item.external_id, media_type: item.media_type, rating: (item.user_rating ?? 0) * 2, hasId: !!item.external_id }));
    const all = [...feedCandidates, ...collCandidates];
    if (!all.length) return null;
    // Sort: has external ID first, then by rating descending
    all.sort((a, b) => (b.hasId ? 1 : 0) - (a.hasId ? 1 : 0) || b.rating - a.rating);
    const best = all[0];
    return { title: best.title, type: best.type, external_id: best.external_id, media_type: best.media_type };
  }

  const seedByType = Object.fromEntries(
    SEED_TYPES.map((t) => [t, bestSeedForType(t)]),
  ) as Record<typeof SEED_TYPES[number], ReturnType<typeof bestSeedForType>>;

  const toSeedParam = (item: ReturnType<typeof bestSeedForType>) =>
    item ? { title: item.title, type: item.type, externalId: item.external_id, mediaType: item.media_type } : null;


  const { data: watchRecs = [] } = useBecauseYouRecs(toSeedParam(seedByType.watch));
  const { data: playRecs = [] } = useBecauseYouRecs(toSeedParam(seedByType.play));
  const { data: readRecs = [] } = useBecauseYouRecs(toSeedParam(seedByType.read));
  const { data: listenRecs = [] } = useBecauseYouRecs(toSeedParam(seedByType.listen));
  const { data: podcastRecs = [] } = useBecauseYouRecs(toSeedParam(seedByType.podcast));

  const filterRecs = (recs: typeof watchRecs, seed: (typeof logged)[0] | null) =>
    recs
      .filter(
        (e) =>
          e.title.toLowerCase() !== seed?.title.toLowerCase() &&
          !loggedTitles.has(`${e.type}:${e.title.toLowerCase()}`),
      )
      .slice(0, 10);

  const becauseRows = [
    { seed: seedByType.watch, entries: filterRecs(watchRecs, seedByType.watch) },
    { seed: seedByType.read, entries: filterRecs(readRecs, seedByType.read) },
    { seed: seedByType.play, entries: filterRecs(playRecs, seedByType.play) },
    { seed: seedByType.podcast, entries: filterRecs(podcastRecs, seedByType.podcast) },
    { seed: seedByType.listen, entries: filterRecs(listenRecs, seedByType.listen) },
  ].filter(({ seed, entries }) => seed && entries.length > 0);

  // Merge "Because you..." seeded recs into the Top Picks pool at a base score
  // of 55 — real personalization signal, but below friend-backed picks.
  const becauseRecs = [...watchRecs, ...playRecs, ...readRecs, ...listenRecs, ...podcastRecs]
    .map((e) => ({ ...e, score: Math.max(e.score ?? 55, 55) }));

  const allForYou = [...forYouTrending, ...becauseRecs]
    .filter((e, i, arr) => arr.findIndex((x) => x.type === e.type && x.title.toLowerCase() === e.title.toLowerCase()) === i)
    .filter((e) => !loggedTitles.has(`${e.type}:${e.title.toLowerCase()}`))
    .sort((a, b) => {
      const aFriend = a.loggers.length > 0 ? 1 : 0;
      const bFriend = b.loggers.length > 0 ? 1 : 0;
      if (bFriend !== aFriend) return bFriend - aFriend;
      return (b.score ?? 55) - (a.score ?? 55);
    });

  // Diversity cap: at most 3 picks per content type so one type doesn't dominate
  const typeCount = new Map<string, number>();
  const topPicks: TrendingEntry[] = [];
  for (const e of allForYou) {
    const n = typeCount.get(e.type) ?? 0;
    if (n >= 3) continue;
    typeCount.set(e.type, n + 1);
    topPicks.push(e);
    if (topPicks.length === 10) break;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {feedView === 'foryou' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          {topPicks.length > 0 && (
            <View style={styles.forYouSection}>
              <SectionHeader title="Top picks for you" />
              <TopPicksRow entries={topPicks} />
            </View>
          )}
          {becauseRows.map(({ seed, entries }) => (
            <View key={`${seed!.type}:${seed!.title}`} style={styles.forYouSection}>
              <BecauseYouRow
                seedTitle={seed!.title}
                verb={PAST_VERBS[seed!.type]}
                entries={entries}
              />
            </View>
          ))}
        </ScrollView>
      ) : feedView !== 'feed' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <TrendingList entries={entries} showTop10Banner bannerTitle="Top 10 right now" />
          <MostReviewedSection />
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
                onEdit={item.user_id === user?.id ? () => router.push({
                  pathname: '/edit-post-modal',
                  params: {
                    postId: item.id,
                    postTitle: item.title,
                    currentNote: item.note ?? '',
                    currentRating: String(item.rating ?? 0),
                    currentVisibility: item.visibility ?? 'everyone',
                  },
                }) : undefined}
              />
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage) fetchNextPage(); }}
          ListFooterComponent={
            isFetchingNextPage
              ? <ActivityIndicator size="small" color={Brand.trust} style={{ paddingVertical: 20 }} />
              : null
          }
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🏐</Text>
                <Text style={styles.emptyTitle}>I'm sorry, Wilson.</Text>
                <Text style={styles.emptyBody}>
                  Follow some friends to see what they're watching, reading, and playing.
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
              <SymbolView name="person.fill" size={16} tintColor={Brand.trust} type="monochrome" style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Profile</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={openWatchParty}>
              <SymbolView name="tv.fill" size={16} tintColor={Brand.trust} type="monochrome" style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Host a Watch Party</Text>
            </Pressable>
            <View style={styles.menuDivider} />
            <Pressable style={styles.menuItem} onPress={openSettings}>
              <SymbolView name="gearshape.fill" size={16} tintColor={Brand.trust} type="monochrome" style={styles.menuIcon} />
              <Text style={styles.menuItemText}>Settings</Text>
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
    cfBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#E6F9EA',
      borderRadius: 12,
      marginHorizontal: Spacing.three,
      marginBottom: 6,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    cfBannerText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: '#248A3D',
      flex: 1,
    },
    cfBannerChevron: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 18,
      color: '#248A3D',
    },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    forYouSection: { marginBottom: Spacing.five },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.four,
    },
    logoWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, position: 'absolute', left: 0, right: 0, justifyContent: 'center' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12, zIndex: 1 },
    bellWrap: { position: 'relative' },
    bellBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    bellBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: '#fff' },
    logoIcon: { width: 34, height: 30 },
    logoWordRow: { flexDirection: 'row', alignItems: 'flex-end' },
    logoClique: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 26,
      color: Brand.ink,
      letterSpacing: -0.5,
      lineHeight: 32,
    },
    logoIWrap: { position: 'relative', alignItems: 'center' },
    logoIDot: {
      position: 'absolute',
      top: 3,
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: Brand.trust,
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
      top: 52,
      right: Spacing.three,
      borderRadius: 16,
      overflow: 'hidden',
      minWidth: 200,
      backgroundColor: 'rgba(255,255,255,0.96)',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(0,0,0,0.08)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.18,
      shadowRadius: 24,
      elevation: 10,
      zIndex: 100,
    },
    menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 18, gap: 12 },
    menuIcon: { width: 18, height: 18 },
    menuItemText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: Brand.border, marginHorizontal: 14 },
  });
}
