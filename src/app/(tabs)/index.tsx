import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useFocusEffect } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BecauseYouRow } from '@/components/feed/because-you-row';
import { FeedViewSwitcher, type FeedView } from '@/components/feed/feed-view-switcher';
import { FilterChips } from '@/components/feed/filter-chips';
import { GlobalView } from '@/components/feed/global-view';
import { CircleRankedSection, MostReviewedSection } from '@/components/feed/most-reviewed-section';
import { NowBanner } from '@/components/feed/now-banner';
import { PostCard } from '@/components/feed/post-card';
import { SponsoredCard } from '@/components/feed/sponsored-card';
import { useActiveAd } from '@/features/ads/api';
import { CloseFriendsButton } from '@/components/feed/stories-strip';
import { ForYouView } from '@/components/feed/for-you-view';
import { SectionHeader } from '@/components/feed/section-header';
import { SectionLabel } from '@/components/feed/section-label';
import { TopPicksRow } from '@/components/feed/top-picks-row';
import { TrendingList } from '@/components/feed/trending-list';
import { BrandFonts, CloseFriendsColors, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
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
import { useEmojiReactions } from '@/features/feed/emoji-reactions';
import { useLibraryItems } from '@/features/library/api';
import { useCollectionItems, useFollowingCollections } from '@/features/collection/api';
import { useCompatItems, useFollowing } from '@/features/follows/api';
import { useProfile } from '@/features/profile/api';
import { useCloseFriendsPosts } from '@/features/close-friends/posts';
import { usePostCommentCounts } from '@/features/comments/api';
import { useUnreadCount } from '@/features/notifications/inbox';
import { supabase } from '@/lib/supabase';
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

// Defined outside the component so the reference is stable across renders —
// an inline () => <View /> creates a new function on every render.
const FeedItemSeparator = () => <View style={{ height: 6 }} />;

export default function FeedScreen() {
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const { data: storyPosts = [] } = useCloseFriendsPosts();
  const unreadCount = useUnreadCount();

  const [feedView, setFeedView] = useState<FeedView>('feed');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [adDismissed, setAdDismissed] = useState(false);
  const { hidden: hiddenCategories, hideCategory, showCategory } = useHiddenCategories(profile?.content_types);
  const { posts: rawPosts, allPosts, isLoading, isFetching, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeedPosts(filter);
  const { data: circleActivity = [] } = useCircleLogActivity();
  // Long-press-removed categories (see filter-chips.tsx) drop out of the feed
  // entirely, not just the chip row — same treatment as the active filter.
  const posts = rawPosts.filter((p) => !hiddenCategories.has(p.type));
  const { data: commentCounts } = usePostCommentCounts(posts.map((p) => p.id));
  const { data: globalPosts } = useGlobalPosts();
  const deletePost = useDeletePost();
  const { logged, refetch: refetchLibrary } = useLibraryItems();

  // Re-fetch library whenever the feed tab comes into focus so the banner
  // reflects the most recently logged item after returning from log-modal
  useFocusEffect(useCallback(() => { refetchLibrary(); }, [refetchLibrary]));
  const { items: collectionItems } = useCollectionItems();
  // Build a map of external_id → collection item for page tracking
  const collectionByExternalId = useMemo(() => {
    const map = new Map<string, typeof collectionItems[number]>();
    for (const item of collectionItems) if (item.external_id) map.set(item.external_id, item);
    return map;
  }, [collectionItems]);
  const { data: followingCollections = [] } = useFollowingCollections();
  const { data: followingProfiles = [] } = useFollowing();
  const { data: compatItemsMap } = useCompatItems();
  const followingProfileMap = useMemo(
    () => Object.fromEntries(followingProfiles.map((p) => [p.id, p])),
    [followingProfiles],
  );
  const { byPost: reactionsByPost } = useReactions(posts.map((p) => p.id));
  const { byPost: emojiByPost } = useEmojiReactions(posts.map((p) => p.id));
  const { data: activeAd } = useActiveAd();
  const toggleReaction = useToggleReaction();

  // Batch-fetch all watched_with profiles for the current page of posts in a
  // single query rather than firing one query per PostCard.
  const allWatchedWithIds = useMemo(
    () => [...new Set(posts.flatMap((p) => p.watched_with ?? []))],
    [posts],
  );
  const { data: watchedWithProfilesList = [] } = useQuery({
    queryKey: ['profiles-mini-batch', allWatchedWithIds.slice().sort().join(',')],
    queryFn: async () => {
      if (allWatchedWithIds.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', allWatchedWithIds);
      return (data ?? []) as { id: string; username: string; avatar_url: string | null }[];
    },
    enabled: allWatchedWithIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  const watchedWithProfilesMap = useMemo(
    () => new Map(watchedWithProfilesList.map((p) => [p.id, p])),
    [watchedWithProfilesList],
  );

  // Keyed by type + title, not title alone — a logged book and a recommended
  // game can share an exact title (e.g. "Dune"), and a title-only check would
  // wrongly treat the game as "already logged" and filter it out.
  // Normalize 'tv' → 'watch' so TV shows logged under either type are caught.
  const normType = useCallback((t: string) => (t === 'tv' ? 'watch' : t), []);
  const loggedTitles = useMemo(() => new Set([
    ...logged.map((item) => `${normType(item.type)}:${item.title.toLowerCase()}`),
    ...collectionItems.map((item) => `${normType(item.type)}:${item.title.toLowerCase()}`),
  ]), [logged, collectionItems, normType]);
  const matchesFilter = useCallback(
    (type: Post['type']) => (filter === 'all' || type === filter) && !hiddenCategories.has(type),
    [filter, hiddenCategories],
  );

  const circleTrendingRaw = useMemo(
    () => computeTrendingInCircle(circleActivity, 20).filter((e) => matchesFilter(e.type)),
    [circleActivity, matchesFilter],
  );
  const globalTrendingRaw = useMemo(
    () => computeTrendingInCircle(globalPosts ?? [], 20).filter((e) => matchesFilter(e.type)),
    [globalPosts, matchesFilter],
  );

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
  const forYouSeeds = useMemo<ForYouSeed[]>(() => {
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
      const rating = (item.user_rating ?? 0) * 20;
      bucket.push({ title: item.title, type, external_id: item.external_id, media_type: item.media_type, seedScore: rating + recencyBonus(item.created_at) });
      candidatesByType.set(type, bucket);
    }
    for (const item of logged) {
      const bucket = candidatesByType.get(item.type) ?? [];
      const rating = (item.rating ?? 0) * 10;
      bucket.push({ title: item.title, type: item.type, external_id: item.external_id, media_type: item.media_type, seedScore: rating + recencyBonus(item.created_at) });
      candidatesByType.set(item.type, bucket);
    }

    return [...candidatesByType.values()].flatMap((items) =>
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
  }, [collectionItems, logged]);

  const { data: rawApiRecs = [], isFetching: forYouLoading } = useForYouRecs(forYouSeeds);

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

  const { friendCollectionPicks, apiEntries, circleFallbackEntriesRaw } = useMemo(() => {
    const friendPickMap = new Map<string, TrendingEntry>();

    // Source 1: following collections (explicit ratings)
    for (const item of followingCollections) {
      const key = `${normType(item.type)}:${item.title.toLowerCase()}`;
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
    const circleTitles = new Set(circleTrendingRaw.map((e) => `${normType(e.type)}:${e.title.toLowerCase()}`));
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
          !loggedTitles.has(`${normType(e.type)}:${e.title.toLowerCase()}`) &&
          !circleTitles.has(`${normType(e.type)}:${e.title.toLowerCase()}`),
      )
      .map((e) => {
        const friendPosts = friendPostsByKey.get(`${normType(e.type)}:${e.title.toLowerCase()}`) ?? [];
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
        !loggedTitles.has(`${normType(e.type)}:${e.title.toLowerCase()}`),
    );

    return { friendCollectionPicks, apiEntries, circleFallbackEntriesRaw };
  }, [followingCollections, allPosts, loggedTitles, compatScores, matchesFilter, normType,
      followingProfileMap, circleTrendingRaw, rawApiRecs, circleActivity, user?.id]);

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

  // Use the user's own most-recent post as the banner source — library items get
  // moved to collection after logging so they don't reliably appear in `logged`.
  const myLatestPost = useMemo(
    () => rawPosts.find((p) => p.user_id === user?.id) ?? null,
    [rawPosts, user?.id],
  );
  const latest = myLatestPost ?? logged[0] ?? null;
  const nowLabel = latest ? `You're ${(VERBS[latest.type as Post['type']] ?? 'into').toLowerCase()}` : 'Get started';
  const nowTitle = latest ? latest.title : 'Log your first watch, read, or play';
  const nowPoster = latest?.poster ?? null;


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
          <Pressable
            hitSlop={16}
            onPress={() => router.push('/notifications-modal')}
            style={styles.bellWrap}
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            accessibilityRole="button">
            <SymbolView name="bell" size={22} tintColor={Brand.ink} style={{ width: 24, height: 24 }} />
            {unreadCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} hitSlop={16} accessibilityLabel="Your profile" accessibilityRole="button">
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
      <FilterChips
        value={filter}
        onChange={setFilter}
        hiddenTypes={feedView === 'global' ? undefined : hiddenCategories}
        onHide={feedView === 'global' ? undefined : hideCategory}
        onShow={feedView === 'global' ? undefined : showCategory}
      />
      {feedView === 'feed' && (
        <NowBanner
          label={nowLabel}
          title={nowTitle}
          poster={nowPoster}
          onPressLog={() => router.push('/log-modal')}
        />
      )}
      {feedView !== 'foryou' && feedView !== 'feed' && feedView !== 'circle' && <SectionLabel>{SECTION_TITLES[feedView]}</SectionLabel>}
      {feedView === 'feed' && activeAd && !adDismissed ? (
        <View style={{ marginBottom: 6 }}>
          <SponsoredCard ad={activeAd} onDismiss={() => setAdDismissed(true)} />
        </View>
      ) : null}
    </View>
  );

  const entries = feedView === 'circle' ? circleTrending : globalTrending;

  // One seed per content type — prefer highest-rated logged item, fall back to
  // collection items so all 5 category rows can appear even if the user hasn't
  // posted to the feed for that type yet.
  const SEED_TYPES = ['watch', 'play', 'read', 'listen', 'podcast'] as const;

  function bestSeedForType(t: typeof SEED_TYPES[number]) {
    // Library items ordered newest-first — use the most recently logged item with
    // an external ID (richer recs), falling back to any recent item, then collection.
    const libraryForType = logged
      .filter((item) => item.type === t)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const best = libraryForType.find((i) => i.external_id) ?? libraryForType[0];
    if (best) return { title: best.title, type: best.type, external_id: best.external_id, media_type: best.media_type };
    // Nothing in library — try collection items (same recency-first logic)
    const collForType = collectionItems
      .filter((item) => item.type === t)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const collBest = collForType.find((i) => i.external_id) ?? collForType[0];
    if (!collBest) return null;
    return { title: collBest.title, type: collBest.type as typeof t, external_id: collBest.external_id, media_type: collBest.media_type };
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

  const filterRecs = (recs: typeof watchRecs, seed: { title: string } | null) =>
    recs
      .filter(
        (e) =>
          e.title.toLowerCase() !== seed?.title.toLowerCase() &&
          !loggedTitles.has(`${normType(e.type)}:${e.title.toLowerCase()}`),
      )
      .slice(0, 10);

  const allBecauseRows = [
    { seed: seedByType.watch, entries: filterRecs(watchRecs, seedByType.watch) },
    { seed: seedByType.read, entries: filterRecs(readRecs, seedByType.read) },
    { seed: seedByType.play, entries: filterRecs(playRecs, seedByType.play) },
    { seed: seedByType.podcast, entries: filterRecs(podcastRecs, seedByType.podcast) },
    { seed: seedByType.listen, entries: filterRecs(listenRecs, seedByType.listen) },
  ].filter(({ seed, entries }) => seed && entries.length > 0);

  // Only show one row — whichever seed matches the most recently logged item
  const mostRecentLogged = logged.find((i) => i.external_id);
  const becauseRows = (() => {
    if (!mostRecentLogged) return allBecauseRows.slice(0, 1);
    const match = allBecauseRows.find(({ seed }) => seed?.title.toLowerCase() === mostRecentLogged.title.toLowerCase());
    return match ? [match] : allBecauseRows.slice(0, 1);
  })();

  // Merge "Because you..." seeded recs into the Top Picks pool at a base score
  // of 55 — real personalization signal, but below friend-backed picks.
  const becauseRecs = [...watchRecs, ...playRecs, ...readRecs, ...listenRecs, ...podcastRecs]
    .map((e) => ({ ...e, score: Math.max(e.score ?? 55, 55) }));

  const deduped = [...forYouTrending, ...becauseRecs]
    .filter((e, i, arr) => arr.findIndex((x) => x.type === e.type && x.title.toLowerCase() === e.title.toLowerCase()) === i)
    .filter((e) => !loggedTitles.has(`${normType(e.type)}:${e.title.toLowerCase()}`))
    .sort((a, b) => (b.score ?? 55) - (a.score ?? 55));

  const friendPool = deduped.filter((e) => e.loggers.length > 0);
  const algoPool = deduped.filter((e) => e.loggers.length === 0);

  // Interleave friend-backed and algorithmic picks 1:1, diversity cap 3 per type
  const typeCount = new Map<string, number>();
  const topPicks: TrendingEntry[] = [];
  let fi = 0; let ai = 0;
  while (topPicks.length < 10 && (fi < friendPool.length || ai < algoPool.length)) {
    const wantFriend = topPicks.length % 2 === 0;
    const candidates = wantFriend
      ? (fi < friendPool.length ? [friendPool[fi++]] : [algoPool[ai++]])
      : (ai < algoPool.length ? [algoPool[ai++]] : [friendPool[fi++]]);
    const e = candidates[0];
    if (!e) break;
    const n = typeCount.get(e.type) ?? 0;
    if (n >= 3) continue;
    typeCount.set(e.type, n + 1);
    topPicks.push(e);
  }

  const renderFeedItem = useCallback(({ item }: { item: Post }) => {
    const reactions = reactionsByPost.get(item.id) ?? [];
    const meReacted = reactions.some((r) => r.user_id === user?.id);
    const ci = item.user_id === user?.id && item.type === 'read' && item.external_id
      ? collectionByExternalId.get(item.external_id!)
      : undefined;
    return (
      <PostCard
        post={item}
        isMine={item.user_id === user?.id}
        currentUserId={user?.id}
        reactions={reactions}
        emojiReactions={emojiByPost.get(item.id)}
        compatScore={item.user_id === user?.id ? undefined : compatScores.get(item.user_id)}
        commentCount={commentCounts?.get(item.id) ?? 0}
        onToggleReaction={() => toggleReaction.mutate({ postId: item.id, reacted: meReacted })}
        onDelete={() => deletePost.mutate(item.id)}
        pageProgress={ci ? { libraryItemId: ci.id, currentPage: ci.current_page, totalPages: ci.total_pages, externalId: item.external_id! } : undefined}
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
        watchedWithProfilesMap={watchedWithProfilesMap}
      />
    );
  }, [reactionsByPost, emojiByPost, commentCounts, user?.id, compatScores,
      collectionByExternalId, toggleReaction, deletePost, watchedWithProfilesMap]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {feedView === 'foryou' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <ForYouView
            friends={followingProfiles}
            compatScores={compatScores}
            loggedTitles={loggedTitles}
            becauseRows={becauseRows}
            forYouLoading={forYouLoading}
          />
        </ScrollView>
      ) : feedView === 'global' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <GlobalView filter={filter} />
        </ScrollView>
      ) : feedView !== 'feed' ? (
        <ScrollView contentContainerStyle={styles.content}>
          {header}
          <CircleRankedSection followingIds={[...(user?.id ? [user.id] : []), ...followingProfiles.map((p) => p.id)]} title="Inner Circle" />
          <MostReviewedSection title="Outer Circle" />
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
          renderItem={renderFeedItem}
          ItemSeparatorComponent={FeedItemSeparator}
          removeClippedSubviews
          maxToRenderPerBatch={5}
          windowSize={7}
          initialNumToRender={5}
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
                <Pressable
                  style={styles.emptyDiscoverBtn}
                  onPress={() => router.push('/discover-people-modal')}>
                  <Text style={styles.emptyDiscoverBtnText}>Find people to follow →</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
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
      backgroundColor: CloseFriendsColors.bg,
      borderRadius: 14,
      marginHorizontal: Spacing.three,
      marginBottom: 6,
      paddingVertical: 9,
      paddingHorizontal: 14,
    },
    cfBannerText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: CloseFriendsColors.text,
      flex: 1,
    },
    cfBannerChevron: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 18,
      color: CloseFriendsColors.text,
    },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    forYouSection: { marginBottom: Spacing.five },
    forYouLoader: { alignItems: 'center', paddingTop: 60 },
    forYouEmpty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.four },
    forYouEmptyTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 18,
      color: Brand.ink,
      marginBottom: 10,
      textAlign: 'center',
    },
    forYouEmptyBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 24,
    },
    forYouEmptyBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    forYouEmptyBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#fff',
    },
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
    emptyDiscoverBtn: {
      marginTop: 18,
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 22,
    },
    emptyDiscoverBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#fff',
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
      backgroundColor: Brand.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Brand.border,
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
