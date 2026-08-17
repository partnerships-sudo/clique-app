import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Dimensions, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';

import { BrandFonts, Spacing } from '@/constants/theme';
import { usePostsByUser, type Post } from '@/features/feed/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TYPE_META: Record<string, { label: string; emoji: string; colors: readonly [string, string] }> = {
  watch:   { label: 'Films',    emoji: '🎬', colors: ['#7c2d12', '#dc2626'] },
  tv:      { label: 'TV Shows', emoji: '📺', colors: ['#713f12', '#d97706'] },
  read:    { label: 'Books',    emoji: '📚', colors: ['#1e1b4b', '#5b4fe8'] },
  play:    { label: 'Games',    emoji: '🎮', colors: ['#064e3b', '#10b981'] },
  listen:  { label: 'Music',    emoji: '🎵', colors: ['#4a044e', '#c084fc'] },
  podcast: { label: 'Podcasts', emoji: '🎙️', colors: ['#0c1445', '#3b82f6'] },
};

const GENRE_ALLOWLIST = new Set([
  'Action','Adventure','Animation','Comedy','Crime','Documentary','Drama',
  'Family','Fantasy','History','Horror','Music','Mystery','Romance',
  'Sci-Fi','Thriller','War','Western','Action & Adventure','Kids','Reality',
  'Sci-Fi & Fantasy','Talk','Fiction','Non-Fiction','Nonfiction','Science Fiction',
  'Literary Fiction','Historical Fiction','Young Adult',"Children's",'Biography',
  'Memoir','Self-Help','Business','Psychology','Philosophy','Poetry','True Crime',
  'Humor','Classics','Short Stories','Graphic Novel','Manga',
  'Role-playing (RPG)','Shooter','Platform','Puzzle','Racing','Sport',
  'Strategy','Fighting','Simulation','Indie','Arcade',
]);

interface WrappedStats {
  total: number;
  topType: { type: string; label: string; emoji: string; colors: readonly [string, string]; count: number } | null;
  topGenre: string | null;
  bestMonth: number;
  bestMonthCount: number;
  longestStreak: number;
  fiveStars: Post[];
  avgRating: string | null;
  byMonth: number[];
}

function computeStats(posts: Post[], year: number): WrappedStats | null {
  if (!posts.length) return null;

  const byType = new Map<string, number>();
  for (const p of posts) byType.set(p.type, (byType.get(p.type) ?? 0) + 1);
  const topTypeEntry = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  const topType = topTypeEntry
    ? { type: topTypeEntry[0], count: topTypeEntry[1], ...TYPE_META[topTypeEntry[0]] ?? { label: topTypeEntry[0], emoji: '📌', colors: ['#111', '#333'] as const } }
    : null;

  const byMonth = Array.from({ length: 12 }, (_, i) =>
    posts.filter((p) => new Date(p.created_at).getMonth() === i).length
  );
  const bestMonth = byMonth.indexOf(Math.max(...byMonth));

  const genreCounts = new Map<string, number>();
  for (const p of posts) {
    if (!p.sub) continue;
    for (const part of p.sub.split('·').map((s) => s.trim())) {
      if (GENRE_ALLOWLIST.has(part)) genreCounts.set(part, (genreCounts.get(part) ?? 0) + 1);
    }
  }
  const topGenre = genreCounts.size
    ? [...genreCounts.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  const loggedDays = new Set(posts.map((p) => {
    const d = new Date(p.created_at);
    return `${d.getMonth()}-${d.getDate()}`;
  }));
  let longestStreak = 0, run = 0;
  for (let m = 0; m < 12; m++) {
    const days = new Date(year, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      if (loggedDays.has(`${m}-${d}`)) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 0;
    }
  }

  const rated = posts.filter((p) => p.rating != null && p.rating > 0);
  const avgRating = rated.length
    ? (rated.reduce((s, p) => s + (p.rating ?? 0), 0) / rated.length).toFixed(1)
    : null;

  const fiveStars = posts
    .filter((p) => (p.rating ?? 0) >= 5)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6);

  return { total: posts.length, topType, topGenre, bestMonth, bestMonthCount: byMonth[bestMonth], longestStreak, fiveStars, avgRating, byMonth };
}

// ── Individual cards ──────────────────────────────────────────────────────────

function CardHero({ stats, year, name, width, height }: { stats: WrappedStats; year: number; name: string; width: number; height: number }) {
  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOUR {year} WRAPPED</Text>
        <Text style={[styles.cardHeroNum, { fontSize: stats.total >= 100 ? 100 : 120 }]}>{stats.total}</Text>
        <Text style={styles.cardHeroLabel}>titles logged</Text>
        {stats.avgRating ? (
          <View style={styles.cardPill}>
            <Text style={styles.cardPillText}>★ {stats.avgRating} average rating</Text>
          </View>
        ) : null}
        <Text style={styles.cardName}>{name}</Text>
      </View>
    </LinearGradient>
  );
}

function CardTopType({ stats, width, height }: { stats: WrappedStats; width: number; height: number }) {
  if (!stats.topType) return null;
  const { colors, emoji, label, count } = stats.topType;
  return (
    <LinearGradient colors={colors} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOU SPENT MOST TIME WITH</Text>
        <Text style={{ fontSize: 96, marginBottom: 8 }}>{emoji}</Text>
        <Text style={styles.cardBigWord}>{label}</Text>
        <Text style={styles.cardSubWord}>{count} logged this year</Text>
      </View>
    </LinearGradient>
  );
}

function CardTopGenre({ stats, width, height }: { stats: WrappedStats; width: number; height: number }) {
  if (!stats.topGenre) return null;
  return (
    <LinearGradient colors={['#1a1a2e', '#16213e', '#e94560']} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOUR TOP GENRE</Text>
        <Text style={[styles.cardBigWord, { fontSize: stats.topGenre.length > 10 ? 48 : 64 }]}>
          {stats.topGenre}
        </Text>
        <Text style={styles.cardSubWord}>You just love it.</Text>
      </View>
    </LinearGradient>
  );
}

function CardBestMonth({ stats, width, height }: { stats: WrappedStats; width: number; height: number }) {
  const max = Math.max(...stats.byMonth, 1);
  return (
    <LinearGradient colors={['#0d1b2a', '#1b4332', '#40916c']} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOUR BEST MONTH</Text>
        <Text style={styles.cardBigWord}>{MONTH_NAMES[stats.bestMonth]}</Text>
        <Text style={styles.cardSubWord}>{stats.bestMonthCount} titles logged</Text>
        {/* Mini bar chart */}
        <View style={styles.miniChart}>
          {stats.byMonth.map((count, i) => {
            const pct = count / max;
            const isBest = i === stats.bestMonth;
            return (
              <View key={i} style={styles.miniChartCol}>
                <View style={[styles.miniBar, {
                  height: Math.max(4, Math.round(pct * 80)),
                  backgroundColor: isBest ? '#fff' : 'rgba(255,255,255,0.25)',
                }]} />
              </View>
            );
          })}
        </View>
      </View>
    </LinearGradient>
  );
}

function CardStreak({ stats, width, height }: { stats: WrappedStats; width: number; height: number }) {
  return (
    <LinearGradient colors={['#7c2d12', '#991b1b', '#b45309']} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOUR BEST STREAK</Text>
        <Text style={{ fontSize: 80, marginBottom: 4 }}>🔥</Text>
        <Text style={styles.cardHeroNum}>{stats.longestStreak}</Text>
        <Text style={styles.cardHeroLabel}>{stats.longestStreak === 1 ? 'day' : 'days'} in a row</Text>
      </View>
    </LinearGradient>
  );
}

function CardFiveStars({ stats, year, width, height }: { stats: WrappedStats; year: number; width: number; height: number }) {
  const picks = stats.fiveStars;
  if (!picks.length) return null;
  return (
    <LinearGradient colors={['#0f0f0f', '#1a1a1a', '#0f0f0f']} style={[styles.card, { width, height }]}>
      <View style={styles.cardInner}>
        <Text style={styles.cardEyebrow}>YOU GAVE 5 STARS TO</Text>
        <View style={styles.posterGrid}>
          {picks.slice(0, 6).map((p) =>
            p.poster ? (
              <Image key={p.id} source={{ uri: p.poster }} style={styles.gridPoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p.poster} />
            ) : (
              <View key={p.id} style={[styles.gridPoster, { backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 28 }}>{TYPE_META[p.type]?.emoji ?? '📌'}</Text>
              </View>
            )
          )}
        </View>
        <Text style={styles.cardSubWord}>{picks.length} perfect picks in {year}</Text>
      </View>
    </LinearGradient>
  );
}

// ── Share card (captured for Instagram) ──────────────────────────────────────

function ShareCard({ stats, year, name }: { stats: WrappedStats; year: number; name: string }) {
  return (
    <LinearGradient colors={['#0f0c29', '#302b63', '#24243e']} style={styles.shareCard}>
      <Text style={styles.shareEyebrow}>CLIQUE {year} WRAPPED</Text>
      <Text style={styles.shareName}>{name}</Text>

      <View style={styles.shareGrid}>
        <View style={styles.shareGridItem}>
          <Text style={styles.shareGridNum}>{stats.total}</Text>
          <Text style={styles.shareGridLabel}>logged</Text>
        </View>
        {stats.avgRating ? (
          <View style={styles.shareGridItem}>
            <Text style={styles.shareGridNum}>★{stats.avgRating}</Text>
            <Text style={styles.shareGridLabel}>avg rating</Text>
          </View>
        ) : null}
        {stats.topType ? (
          <View style={styles.shareGridItem}>
            <Text style={{ fontSize: 32 }}>{stats.topType.emoji}</Text>
            <Text style={styles.shareGridLabel}>{stats.topType.label}</Text>
          </View>
        ) : null}
        {stats.longestStreak > 0 ? (
          <View style={styles.shareGridItem}>
            <Text style={styles.shareGridNum}>{stats.longestStreak}🔥</Text>
            <Text style={styles.shareGridLabel}>day streak</Text>
          </View>
        ) : null}
      </View>

      {stats.topGenre ? (
        <View style={styles.shareGenre}>
          <Text style={styles.shareGenreLabel}>TOP GENRE</Text>
          <Text style={styles.shareGenreValue}>{stats.topGenre}</Text>
        </View>
      ) : null}

      {stats.fiveStars.length > 0 ? (
        <View style={styles.sharePosterRow}>
          {stats.fiveStars.slice(0, 4).map((p) =>
            p.poster ? (
              <Image key={p.id} source={{ uri: p.poster }} style={styles.sharePoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p.poster} />
            ) : null
          )}
        </View>
      ) : null}

      <Text style={styles.shareFooter}>clique.app</Text>
    </LinearGradient>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function YearlyWrappedModal() {
  const { userId, year: yearParam, name } = useLocalSearchParams<{ userId: string; year: string; name?: string }>();
  const { user } = useSession();
  const Brand = useBrand();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const year = yearParam ? Number(yearParam) : new Date().getFullYear();
  const displayName = name ?? 'You';

  const { data: allPosts = [], isLoading } = usePostsByUser(userId);
  const posts = useMemo(() => allPosts.filter((p) => new Date(p.created_at).getFullYear() === year), [allPosts, year]);
  const stats = useMemo(() => computeStats(posts, year), [posts, year]);

  const [activeIdx, setActiveIdx] = useState(0);
  const shareRef = useRef<ViewShot>(null);
  const flatListRef = useRef<FlatList>(null);

  const cards = useMemo(() => {
    if (!stats) return [];
    const all = [
      { key: 'hero' },
      stats.topType ? { key: 'type' } : null,
      stats.topGenre ? { key: 'genre' } : null,
      { key: 'month' },
      stats.longestStreak > 1 ? { key: 'streak' } : null,
      stats.fiveStars.length > 0 ? { key: 'stars' } : null,
      { key: 'share' },
    ].filter(Boolean) as { key: string }[];
    return all;
  }, [stats]);

  async function handleShare() {
    try {
      const uri = await (shareRef.current as any)?.capture?.();
      if (uri && await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: `My ${year} Wrapped` });
      }
    } catch (e) {
      console.warn('Share failed', e);
    }
  }

  const cardSize = { width: screenWidth, height: screenHeight };

  function renderCard({ item }: { item: { key: string } }) {
    if (!stats) return null;
    switch (item.key) {
      case 'hero':   return <CardHero stats={stats} year={year} name={displayName} width={screenWidth} height={screenHeight} />;
      case 'type':   return <CardTopType stats={stats} width={screenWidth} height={screenHeight} />;
      case 'genre':  return <CardTopGenre stats={stats} width={screenWidth} height={screenHeight} />;
      case 'month':  return <CardBestMonth stats={stats} width={screenWidth} height={screenHeight} />;
      case 'streak': return <CardStreak stats={stats} width={screenWidth} height={screenHeight} />;
      case 'stars':  return <CardFiveStars stats={stats} year={year} width={screenWidth} height={screenHeight} />;
      case 'share':
        return (
          <View style={[styles.card, cardSize, { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.ink }]}>
            <Text style={[styles.cardEyebrow, { marginBottom: 20 }]}>SHARE YOUR WRAPPED</Text>
            <ViewShot ref={shareRef} options={{ format: 'png', quality: 1.0 }} style={styles.shareCardWrap}>
              <ShareCard stats={stats} year={year} name={displayName} />
            </ViewShot>
            <Pressable style={styles.shareBtn} onPress={handleShare} accessibilityRole="button" accessibilityLabel="Share to Instagram">
              <SymbolView name="square.and.arrow.up" size={18} tintColor="#fff" type="monochrome" />
              <Text style={styles.shareBtnText}>Share to Instagram</Text>
            </Pressable>
          </View>
        );
      default: return null;
    }
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <SymbolView name="xmark" size={18} tintColor="#fff" type="monochrome" />
        </Pressable>
        {/* Progress dots */}
        <View style={styles.dots}>
          {cards.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />
          ))}
        </View>
        <View style={{ width: 28 }} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : !stats ? (
        <View style={styles.centered}>
          <Text style={{ fontSize: 48, marginBottom: 16 }}>📭</Text>
          <Text style={styles.emptyTitle}>Nothing logged in {year}</Text>
          <Text style={styles.emptySub}>Start logging to see your Wrapped.</Text>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <Text style={styles.backBtnText}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={cards}
          keyExtractor={(item) => item.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          bounces={false}
          renderItem={renderCard}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
            setActiveIdx(idx);
          }}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          style={{ flex: 1 }}
        />
      )}

      {/* Swipe hint on first card */}
      {stats && activeIdx === 0 && (
        <View style={styles.swipeHint} pointerEvents="none">
          <Text style={styles.swipeHintText}>Swipe to explore →</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.three, paddingBottom: 12,
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
  },
  dots: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { width: 18, backgroundColor: '#fff' },

  // Cards
  card: { flex: 1, justifyContent: 'center' },
  cardInner: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  cardEyebrow: {
    fontFamily: BrandFonts.syneBold, fontSize: 11, color: 'rgba(255,255,255,0.6)',
    letterSpacing: 2.5, textTransform: 'uppercase', marginBottom: 12,
  },
  cardHeroNum: {
    fontFamily: BrandFonts.syneExtraBold, fontSize: 120, color: '#fff', lineHeight: 130,
  },
  cardHeroLabel: { fontFamily: BrandFonts.syneBold, fontSize: 20, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  cardBigWord: { fontFamily: BrandFonts.syneExtraBold, fontSize: 60, color: '#fff', textAlign: 'center', lineHeight: 68 },
  cardSubWord: { fontFamily: BrandFonts.interMedium, fontSize: 17, color: 'rgba(255,255,255,0.7)', marginTop: 10, textAlign: 'center' },
  cardName: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 24 },
  cardPill: {
    marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20,
  },
  cardPillText: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: '#fff' },

  // Mini chart
  miniChart: { flexDirection: 'row', gap: 4, height: 90, alignItems: 'flex-end', marginTop: 28, width: '100%' },
  miniChartCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  miniBar: { width: '80%', borderRadius: 3 },

  // Poster grid (5-stars card)
  posterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 12, marginBottom: 16 },
  gridPoster: { width: 100, height: 140, borderRadius: 10 },

  // Share card
  shareCardWrap: { borderRadius: 20, overflow: 'hidden', width: 300 },
  shareCard: { width: 300, padding: 28, alignItems: 'center', gap: 16 },
  shareEyebrow: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 2.5, textTransform: 'uppercase' },
  shareName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: '#fff' },
  shareGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', width: '100%' },
  shareGridItem: { alignItems: 'center', minWidth: 72 },
  shareGridNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: '#fff' },
  shareGridLabel: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  shareGenre: { alignItems: 'center', gap: 2 },
  shareGenreLabel: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' },
  shareGenreValue: { fontFamily: BrandFonts.syneExtraBold, fontSize: 26, color: '#fff' },
  sharePosterRow: { flexDirection: 'row', gap: 6 },
  sharePoster: { width: 58, height: 82, borderRadius: 8 },
  shareFooter: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 1.5, marginTop: 4 },

  // Share button
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginTop: 24, backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 28, paddingVertical: 14, borderRadius: 30,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  shareBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },

  // Swipe hint
  swipeHint: { position: 'absolute', bottom: 32, left: 0, right: 0, alignItems: 'center' },
  swipeHintText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  // Empty / loading
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: '#fff', marginBottom: 8 },
  emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center' },
  backBtn: { marginTop: 28, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  backBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
});
