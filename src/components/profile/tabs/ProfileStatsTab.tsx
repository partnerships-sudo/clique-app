import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TIER_COLORS } from '@/features/badges/catalog';
import { useMyPostCounts, usePostsByUser } from '@/features/feed/api';
import { useMyTasteTop4 } from '@/features/follows/api';
import { type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { type ProfileCardBadge } from '../profile-card';
import { BrandFonts } from '@/constants/theme';
import { STAT_CATEGORIES, createStyles } from '../profile-styles';

const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const RATING_BUCKETS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];
const RATING_LABELS = ['½★', '1★', '1.5', '2★', '2.5', '3★', '3.5', '4★', '4.5', '5★'];
const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface Props {
  logged: LibraryItem[];
  followersCount: number;
  followingCount: number;
  onLoggedPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  featuredBadges?: ProfileCardBadge[];
  onOpenAchievements?: () => void;
  isOwnProfile?: boolean;
}

export function ProfileStatsTab({ logged, followersCount, followingCount, onLoggedPress, onFollowersPress, onFollowingPress, featuredBadges = [], onOpenAchievements, isOwnProfile }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [ratingSheet, setRatingSheet] = useState<{ rating: number; label: string } | null>(null);
  const [monthSheet, setMonthSheet] = useState<{ month: number; label: string } | null>(null);
  const { data: top4 = [] } = useMyTasteTop4();
  const { user } = useSession();
  const { data: postCounts } = useMyPostCounts(user?.id);
  const { data: allPosts = [] } = usePostsByUser(user?.id);

  // Always use posts as the source of truth for counts (library has RLS gaps)
  const counts: Record<string, number> = postCounts
    ? { watch: postCounts.watch, tv: postCounts.tv, read: postCounts.read, play: postCounts.play, listen: postCounts.listen, podcast: postCounts.podcast }
    : { watch: 0, tv: 0, read: 0, play: 0, listen: 0, podcast: 0 };
  const maxCount = Math.max(1, ...Object.values(counts));
  const totalLogged = allPosts.length;

  const thisYear = new Date().getFullYear();
  const thisYearCount = allPosts.filter((p) => new Date(p.created_at).getFullYear() === thisYear).length;

  const ratedPosts = allPosts.filter((p) => p.rating != null && p.rating > 0);
  const avgRating = ratedPosts.length > 0
    ? (ratedPosts.reduce((sum, p) => sum + (p.rating ?? 0), 0) / ratedPosts.length).toFixed(1)
    : null;

  const loggedDates = new Set(allPosts.map((i) => {
    const d = new Date(i.created_at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));

  const today = new Date();
  let streakDays = 0;
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (loggedDates.has(key)) streakDays++;
    else if (offset > 0) break;
  }

  let longestStreak = streakDays;
  if (allPosts.length > 0) {
    const sortedDays = [...loggedDates].map((key) => {
      const [y, m, day] = key.split('-').map(Number);
      return new Date(y, m, day).getTime();
    }).sort((a, b) => a - b);
    let run = 1;
    const MS_PER_DAY = 86_400_000;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] - sortedDays[i - 1] === MS_PER_DAY) { run++; if (run > longestStreak) longestStreak = run; }
      else run = 1;
    }
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { label: DAY_LABELS[d.getDay()], done: loggedDates.has(key) };
  });

  // Ratings breakdown
  const ratingCounts = RATING_BUCKETS.map((r) => allPosts.filter((p) => p.rating === r).length);
  const maxRatingCount = Math.max(1, ...ratingCounts);

  // Monthly activity for current year
  const monthlyCounts = MONTH_LABELS.map((_, i) =>
    allPosts.filter((p) => {
      const d = new Date(p.created_at);
      return d.getFullYear() === thisYear && d.getMonth() === i;
    }).length
  );
  const maxMonthlyCount = Math.max(1, ...monthlyCounts);
  const currentMonth = today.getMonth();

  const active = logged.filter((i) => i.status !== 'finished');
  const activeCategories = [
    active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length
      ? { label: 'TV', sub: `${active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length} show${active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length !== 1 ? 's' : ''}`, sf: 'tv.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length
      ? { label: 'Movies', sub: `${active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length} movie${active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length !== 1 ? 's' : ''}`, sf: 'film.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    active.filter((i) => i.type === 'read').length ? { label: 'Books', sub: `${active.filter((i) => i.type === 'read').length} book${active.filter((i) => i.type === 'read').length !== 1 ? 's' : ''}`, sf: 'book.fill', color: '#5FA8FF', bg: '#5FA8FF18' } : null,
    active.filter((i) => i.type === 'play').length ? { label: 'Games', sub: `${active.filter((i) => i.type === 'play').length} game${active.filter((i) => i.type === 'play').length !== 1 ? 's' : ''}`, sf: 'gamecontroller.fill', color: '#5FD9FF', bg: '#5FD9FF18' } : null,
    active.filter((i) => i.type === 'podcast').length ? { label: 'Podcasts', sub: `${active.filter((i) => i.type === 'podcast').length} podcast${active.filter((i) => i.type === 'podcast').length !== 1 ? 's' : ''}`, sf: 'mic.fill', color: '#C084FC', bg: '#C084FC18' } : null,
    active.filter((i) => i.type === 'listen').length ? { label: 'Music', sub: `${active.filter((i) => i.type === 'listen').length} track${active.filter((i) => i.type === 'listen').length !== 1 ? 's' : ''}`, sf: 'headphones', color: '#9B95AC', bg: '#9B95AC18' } : null,
  ].filter(Boolean) as { label: string; sub: string; sf: string; color: string; bg: string }[];

  // Allowlist derived from TMDB movie/TV genre maps + common book/game genres.
  // Only strings in this set are accepted — prevents publishers, networks, episode
  // markers, and other sub-field noise from appearing as genres.
  const GENRE_ALLOWLIST = new Set([
    // TMDB movie genres
    'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama',
    'Family', 'Fantasy', 'History', 'Horror', 'Music', 'Mystery', 'Romance',
    'Sci-Fi', 'Thriller', 'War', 'Western',
    // TMDB TV genres
    'Action & Adventure', 'Kids', 'Reality', 'Reality TV', 'Sci-Fi & Fantasy',
    'Soap', 'Talk', 'War & Politics',
    // Common book genres (Hardcover / Goodreads)
    'Fiction', 'Non-Fiction', 'Nonfiction', 'Science Fiction', 'Literary Fiction',
    'Historical Fiction', 'Young Adult', "Children's", 'Biography', 'Memoir',
    'Self-Help', 'Business', 'Psychology', 'Philosophy', 'Poetry', 'True Crime',
    'Humor', 'Classics', 'Short Stories', 'Graphic Novel', 'Manga', 'Anime',
    // Game genres (IGDB)
    'Role-playing (RPG)', 'Shooter', 'Platform', 'Puzzle', 'Racing', 'Sport',
    'Strategy', 'Fighting', 'Simulation', 'Indie', 'Arcade',
  ]);

  const genreCounts = new Map<string, number>();
  // Always use posts for genre data
  const genreSource: { type: string; media_type?: string | null; sub: string | null }[] = postCounts?.subs ?? [];
  for (const item of genreSource) {
    if (!item.sub) continue;
    const parts = item.sub.split('·').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    if (item.type === 'play') {
      const first = parts[0];
      if (GENRE_ALLOWLIST.has(first)) genreCounts.set(first, (genreCounts.get(first) ?? 0) + 1);
    } else if (item.type === 'watch' || item.type === 'read') {
      for (const part of parts) {
        if (GENRE_ALLOWLIST.has(part)) genreCounts.set(part, (genreCounts.get(part) ?? 0) + 1);
      }
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count], i) => ({ name, count, rank: i + 1, color: (['#FF6B6B', '#5B4FE8', '#F59E0B', '#10B981', '#9B95AC'] as const)[i] }));


  return (
    <View style={styles.tabContent}>
      {/* Achievements */}
      {onOpenAchievements ? (
        <Pressable style={styles.badgesSection} onPress={onOpenAchievements}>
          <Text style={styles.badgesTitle}>Achievements</Text>
          {featuredBadges.length ? (
            <View style={styles.badgesRow}>
              {featuredBadges.map((badge) => (
                <View key={badge.key} style={styles.badgeItem}>
                  <View style={[styles.badgeCircle, { backgroundColor: TIER_COLORS[badge.tier] + '33', borderColor: TIER_COLORS[badge.tier] }]}>
                    <Text style={styles.badgeIcon}>{badge.icon}</Text>
                  </View>
                  <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.badgesEmpty}>
              {isOwnProfile ? 'Pick up to 3 badges to show off here.' : "Hasn't featured any badges yet."}
            </Text>
          )}
        </Pressable>
      ) : null}

      {/* Logged / Followers / Following */}
      <View style={styles.statsBox}>
        <Pressable style={styles.stat} onPress={onLoggedPress} disabled={!onLoggedPress} hitSlop={4}>
          <View style={styles.statNumRow}>
            <SymbolView name="archivebox.fill" size={18} tintColor={Brand.trust} type="monochrome" style={styles.statSfIcon} />
            <Text style={[styles.statNum, styles.statNumAccent]}>{totalLogged}</Text>
          </View>
          <Text style={styles.statLbl}>LOGGED</Text>
          <Text style={styles.statSubLbl}>items logged</Text>
        </Pressable>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <View style={styles.statNumRow}>
            <Text style={[styles.statNum, styles.statNumAccent]}>
              {avgRating != null ? `★${avgRating}` : '—'}
            </Text>
          </View>
          <Text style={styles.statLbl}>AVG RATING</Text>
          <Text style={styles.statSubLbl}>your taste</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <View style={styles.statNumRow}>
            <Text style={[styles.statNum, styles.statNumAccent]}>{thisYearCount}</Text>
          </View>
          <Text style={styles.statLbl}>THIS YEAR</Text>
          <Text style={styles.statSubLbl}>in {thisYear}</Text>
        </View>
      </View>

      {/* Streak */}
      <View style={styles.streakCard}>
        <View style={styles.streakLeft}>
          <View style={styles.streakFireCircle}>
            <Text style={styles.streakFireEmoji}>🔥</Text>
          </View>
          <Text style={styles.streakDays}>{streakDays} {streakDays === 1 ? 'DAY' : 'DAYS'} STREAK</Text>
          <Text style={styles.streakMsg}>{streakDays >= 3 ? "Keep it alive. You're on fire." : 'Start your streak today!'}</Text>
          <View style={styles.weekRow}>
            {weekDays.map((d, i) => {
              const isToday = i === weekDays.length - 1;
              return (
                <View key={i} style={styles.weekDay}>
                  <View style={[styles.weekDot, d.done && !isToday && styles.weekDotDone, isToday && styles.weekDotToday]} />
                  <Text style={styles.weekLabel}>{d.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.streakDivider} />
        <View style={styles.streakRight}>
          <Text style={styles.longestLabel}>Longest Streak</Text>
          <Text style={styles.longestDays}>{longestStreak}</Text>
          <Text style={styles.longestUnit}>days</Text>
        </View>
      </View>

      {/* Ratings Breakdown */}
      <View style={[styles.statsCard, { marginHorizontal: 0 }]}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.statsCardTitle}>RATINGS BREAKDOWN</Text>
          {avgRating != null && <Text style={styles.chartAvg}>{avgRating} avg</Text>}
        </View>
        <View style={styles.ratingBarsRow}>
          {RATING_BUCKETS.map((bucket, i) => (
            <Pressable
              key={i}
              style={styles.ratingBarCol}
              onPress={() => ratingCounts[i] > 0 && setRatingSheet({ rating: bucket, label: RATING_LABELS[i] })}
              hitSlop={4}>
              <View style={styles.ratingBarTrack}>
                <View style={[styles.ratingBarFill, { height: `${Math.round((ratingCounts[i] / maxRatingCount) * 100)}%` }]} />
              </View>
              <Text style={styles.ratingBarLabel}>{RATING_LABELS[i]}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Activity */}
      <View style={[styles.statsCard, { marginHorizontal: 0 }]}>
        <View style={styles.chartHeaderRow}>
          <Text style={styles.statsCardTitle}>ACTIVITY</Text>
          <Text style={styles.chartAvg}>{thisYear}</Text>
        </View>
        <View style={styles.ratingBarsRow}>
          {MONTH_LABELS.map((label, i) => (
            <Pressable
              key={i}
              style={styles.ratingBarCol}
              onPress={() => monthlyCounts[i] > 0 && setMonthSheet({ month: i, label: `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i]} ${thisYear}` })}
              hitSlop={4}>
              <Text style={styles.ratingBarCount}>{monthlyCounts[i] > 0 ? monthlyCounts[i] : ''}</Text>
              <View style={styles.ratingBarTrack}>
                <View style={[
                  styles.ratingBarFill,
                  { height: `${Math.round((monthlyCounts[i] / maxMonthlyCount) * 100)}%` },
                  i === currentMonth && styles.ratingBarFillCurrent,
                ]} />
              </View>
              <Text style={styles.ratingBarLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* MyTaste Top 4 */}
      {top4.length > 0 ? (
        <View style={styles.statsCard}>
          <View style={styles.myTasteHeader}>
            <Text style={styles.myTasteTitle}>MyTaste Top 4</Text>
            <Text style={styles.myTasteSub}>your most compatible friends</Text>
          </View>
          <View style={styles.top4Row}>
            {top4.map((friend) => (
              <View key={friend.id} style={styles.top4Item}>
                <View style={styles.top4ImgWrap}>
                  {friend.avatar_url ? (
                    <Image source={{ uri: friend.avatar_url }} style={styles.top4Img} />
                  ) : (
                    <View style={[styles.top4Img, styles.top4ImgFallback]}>
                      <Text style={styles.top4ImgFallbackText}>{(friend.full_name || friend.username || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.top4Badge}>
                    <Text style={styles.top4BadgeText}>{friend.compatibility}%</Text>
                  </View>
                </View>
                <Text style={styles.top4Name} numberOfLines={1}>{friend.full_name || friend.username}</Text>
                <Text style={styles.top4Handle} numberOfLines={1}>@{friend.username}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Top Genres + Top Categories */}
      <View style={styles.goalRow}>
        <View style={[styles.goalCard, styles.statsCard]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.statsCardTitle}>TOP GENRES</Text>
          </View>
          {topGenres.length === 0 ? (
            <Text style={styles.goalSub}>No data yet.</Text>
          ) : topGenres.map((g) => (
            <View key={g.name} style={styles.genreRow}>
              <View style={styles.genreRankWrap}>
                <Text style={[styles.genreRank, { color: g.color }]}>#{g.rank}</Text>
              </View>
              <View style={styles.genreInfo}>
                <View style={styles.genreNameRow}>
                  <Text style={styles.genreName} numberOfLines={1}>{g.name}</Text>
                  <Text style={[styles.genreCount, { color: g.color }]}>{g.count}</Text>
                </View>
                <View style={styles.genreBarTrack}>
                  <View style={[styles.genreBarFill, { backgroundColor: g.color, width: `${Math.round((g.count / (topGenres[0]?.count || 1)) * 100)}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
        <View style={[styles.goalCard, styles.statsCard]}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.statsCardTitle}>TOP CATEGORIES</Text>
          </View>
          {STAT_CATEGORIES.map((cat) => (
            <View key={cat.label} style={styles.catRow}>
              <View style={[styles.catIconBox, { backgroundColor: cat.bg }]}>
                <SymbolView name={cat.sf as any} size={13} tintColor={cat.color} type="monochrome" />
              </View>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <View style={styles.catBarBg}>
                <View style={[styles.catBarFill, { backgroundColor: cat.color, width: `${Math.round((counts[cat.type] / maxCount) * 100)}%` }]} />
              </View>
              <Text style={styles.catCount}>{counts[cat.type]}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Month drill-down sheet */}
      <Modal
        visible={!!monthSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setMonthSheet(null)}>
        <Pressable style={ratingSheetStyles.backdrop} onPress={() => setMonthSheet(null)} />
        <View style={[ratingSheetStyles.sheet, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
          <View style={[ratingSheetStyles.handle, { backgroundColor: Brand.border }]} />
          <View style={ratingSheetStyles.headerRow}>
            <Text style={[ratingSheetStyles.title, { color: Brand.ink }]}>{monthSheet?.label}</Text>
            <Text style={[ratingSheetStyles.count, { color: Brand.muted }]}>
              {allPosts.filter((p) => {
                const d = new Date(p.created_at);
                return d.getFullYear() === thisYear && d.getMonth() === monthSheet?.month;
              }).length} items
            </Text>
          </View>
          <ScrollView style={ratingSheetStyles.list} showsVerticalScrollIndicator={false}>
            {allPosts
              .filter((p) => {
                const d = new Date(p.created_at);
                return d.getFullYear() === thisYear && d.getMonth() === monthSheet?.month;
              })
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={[ratingSheetStyles.row, { borderBottomColor: Brand.border }]}
                  onPress={() => {
                    setMonthSheet(null);
                    router.push({
                      pathname: '/content-detail-modal',
                      params: {
                        title: p.title,
                        type: p.type,
                        poster: p.poster ?? undefined,
                        sub: p.sub ?? undefined,
                        externalId: p.external_id ?? undefined,
                        mediaType: p.media_type ?? undefined,
                      },
                    });
                  }}>
                  {p.poster ? (
                    <Image source={{ uri: p.poster }} style={ratingSheetStyles.poster} resizeMode="cover" />
                  ) : (
                    <View style={[ratingSheetStyles.poster, ratingSheetStyles.posterFallback, { backgroundColor: Brand.border }]}>
                      <Text style={[ratingSheetStyles.posterFallbackText, { color: Brand.muted }]} numberOfLines={2}>{p.title}</Text>
                    </View>
                  )}
                  <View style={ratingSheetStyles.meta}>
                    <Text style={[ratingSheetStyles.itemTitle, { color: Brand.ink }]} numberOfLines={2}>{p.title}</Text>
                    {p.sub ? <Text style={[ratingSheetStyles.itemSub, { color: Brand.muted }]} numberOfLines={1}>{p.sub}</Text> : null}
                    {p.rating ? <Text style={[ratingSheetStyles.itemSub, { color: Brand.trust }]}>{'★'.repeat(Math.floor(p.rating))}{p.rating % 1 ? '½' : ''}</Text> : null}
                    {p.note ? <Text style={[ratingSheetStyles.itemNote, { color: Brand.trust }]} numberOfLines={2}>&ldquo;{p.note}&rdquo;</Text> : null}
                  </View>
                </Pressable>
              ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Rating drill-down sheet */}
      <Modal
        visible={!!ratingSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingSheet(null)}>
        <Pressable style={ratingSheetStyles.backdrop} onPress={() => setRatingSheet(null)} />
        <View style={[ratingSheetStyles.sheet, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
          <View style={[ratingSheetStyles.handle, { backgroundColor: Brand.border }]} />
          <View style={ratingSheetStyles.headerRow}>
            <Text style={[ratingSheetStyles.title, { color: Brand.ink }]}>
              Rated {ratingSheet?.label}
            </Text>
            <Text style={[ratingSheetStyles.count, { color: Brand.muted }]}>
              {allPosts.filter((p) => p.rating === ratingSheet?.rating).length} items
            </Text>
          </View>
          <ScrollView style={ratingSheetStyles.list} showsVerticalScrollIndicator={false}>
            {allPosts
              .filter((p) => p.rating === ratingSheet?.rating)
              .map((p) => (
                <Pressable
                  key={p.id}
                  style={[ratingSheetStyles.row, { borderBottomColor: Brand.border }]}
                  onPress={() => {
                    setRatingSheet(null);
                    router.push({
                      pathname: '/content-detail-modal',
                      params: {
                        title: p.title,
                        type: p.type,
                        poster: p.poster ?? undefined,
                        sub: p.sub ?? undefined,
                        externalId: p.external_id ?? undefined,
                        mediaType: p.media_type ?? undefined,
                      },
                    });
                  }}>
                  {p.poster ? (
                    <Image source={{ uri: p.poster }} style={ratingSheetStyles.poster} resizeMode="cover" />
                  ) : (
                    <View style={[ratingSheetStyles.poster, ratingSheetStyles.posterFallback, { backgroundColor: Brand.border }]}>
                      <Text style={[ratingSheetStyles.posterFallbackText, { color: Brand.muted }]} numberOfLines={2}>{p.title}</Text>
                    </View>
                  )}
                  <View style={ratingSheetStyles.meta}>
                    <Text style={[ratingSheetStyles.itemTitle, { color: Brand.ink }]} numberOfLines={2}>{p.title}</Text>
                    {p.sub ? <Text style={[ratingSheetStyles.itemSub, { color: Brand.muted }]} numberOfLines={1}>{p.sub}</Text> : null}
                    {p.note ? <Text style={[ratingSheetStyles.itemNote, { color: Brand.trust }]} numberOfLines={2}>&ldquo;{p.note}&rdquo;</Text> : null}
                  </View>
                </Pressable>
              ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>

    </View>
  );
}

const ratingSheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    maxHeight: '75%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
  },
  count: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
  },
  list: {
    paddingHorizontal: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  poster: {
    width: 44,
    height: 66,
    borderRadius: 6,
  },
  posterFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  posterFallbackText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 9,
    textAlign: 'center',
  },
  meta: {
    flex: 1,
    justifyContent: 'center',
    gap: 3,
  },
  itemTitle: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14.5,
  },
  itemSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
  },
  itemNote: {
    fontFamily: BrandFonts.interRegular,
    fontStyle: 'italic',
    fontSize: 12.5,
    lineHeight: 18,
  },
});
