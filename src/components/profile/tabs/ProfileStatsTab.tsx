import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, View } from 'react-native';

import { type EntryType } from '@/constants/theme';
import { useMyTasteTop4 } from '@/features/follows/api';
import { type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { STAT_CATEGORIES, createStyles } from '../profile-styles';

const GOAL_OPTIONS = [3, 5, 7, 10, 14, 20];
const DEFAULT_WEEKLY_TARGET = 10;
const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface Props {
  logged: LibraryItem[];
  followersCount: number;
  followingCount: number;
  onLoggedPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
}

export function ProfileStatsTab({ logged, followersCount, followingCount, onLoggedPress, onFollowersPress, onFollowingPress }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [recentCatFilter, setRecentCatFilter] = useState<EntryType | 'all'>('all');
  const { data: top4 = [] } = useMyTasteTop4();
  const { user } = useSession();
  const [weeklyTarget, setWeeklyTarget] = useState(DEFAULT_WEEKLY_TARGET);

  useEffect(() => {
    if (!user?.id) return;
    AsyncStorage.getItem(`clique:weekly_goal:${user.id}`).then((val) => {
      const n = val ? parseInt(val, 10) : NaN;
      if (!isNaN(n)) setWeeklyTarget(n);
    });
  }, [user?.id]);

  function editWeeklyGoal() {
    Alert.alert(
      'Weekly Goal',
      'How many items do you want to log per week?',
      [
        ...GOAL_OPTIONS.map((n) => ({
          text: `${n}${n === weeklyTarget ? ' ✓' : ''}`,
          onPress: () => {
            setWeeklyTarget(n);
            if (user?.id) AsyncStorage.setItem(`clique:weekly_goal:${user.id}`, String(n));
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  }

  const counts: Record<EntryType, number> = { watch: 0, read: 0, play: 0, listen: 0, podcast: 0 };
  logged.forEach((item) => { counts[item.type] += 1; });
  const maxCount = Math.max(1, ...Object.values(counts));

  const loggedDates = new Set(logged.map((i) => {
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
  if (logged.length > 0) {
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

  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weeklyCount = logged.filter((i) => new Date(i.created_at) >= monday).length;
  const daysLeftInWeek = 7 - ((today.getDay() + 6) % 7) - 1;

  const active = logged.filter((i) => i.status !== 'finished');
  const activeCategories = [
    active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length
      ? { label: 'TV', sub: `${active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length} show${active.filter((i) => i.type === 'watch' && i.media_type !== 'movie').length !== 1 ? 's' : ''}`, sf: 'tv.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length
      ? { label: 'TV', sub: `${active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length} movie${active.filter((i) => i.type === 'watch' && i.media_type === 'movie').length !== 1 ? 's' : ''}`, sf: 'film.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    active.filter((i) => i.type === 'read').length ? { label: 'Books', sub: `${active.filter((i) => i.type === 'read').length} book${active.filter((i) => i.type === 'read').length !== 1 ? 's' : ''}`, sf: 'book.fill', color: '#5FA8FF', bg: '#5FA8FF18' } : null,
    active.filter((i) => i.type === 'play').length ? { label: 'Games', sub: `${active.filter((i) => i.type === 'play').length} game${active.filter((i) => i.type === 'play').length !== 1 ? 's' : ''}`, sf: 'gamecontroller.fill', color: '#5FD9FF', bg: '#5FD9FF18' } : null,
    active.filter((i) => i.type === 'podcast').length ? { label: 'Podcasts', sub: `${active.filter((i) => i.type === 'podcast').length} podcast${active.filter((i) => i.type === 'podcast').length !== 1 ? 's' : ''}`, sf: 'mic.fill', color: '#C084FC', bg: '#C084FC18' } : null,
    active.filter((i) => i.type === 'listen').length ? { label: 'Music', sub: `${active.filter((i) => i.type === 'listen').length} track${active.filter((i) => i.type === 'listen').length !== 1 ? 's' : ''}`, sf: 'headphones', color: '#9B95AC', bg: '#9B95AC18' } : null,
  ].filter(Boolean) as { label: string; sub: string; sf: string; color: string; bg: string }[];

  const genreCounts = new Map<string, number>();
  for (const item of logged) {
    if (!item.sub) continue;
    const parts = item.sub.split('·').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    let genre: string | null = null;
    if (item.type === 'play') {
      const first = parts[0];
      if (first && first !== 'Game' && !first.match(/^\d{4}$/)) genre = first;
    } else if (item.type === 'watch') {
      const last = parts[parts.length - 1];
      if (last && !last.match(/^\d{4}$/) && last !== 'Film' && last !== 'TV Series') genre = last;
    }
    if (!genre) continue;
    for (const g of genre.split(',').map((s) => s.trim()).filter(Boolean)) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count], i) => ({ name, count, rank: i + 1, color: (['#FF6B6B', '#5B4FE8', '#F59E0B'] as const)[i] }));

  const recentItems = useMemo(() => {
    const base = recentCatFilter === 'all' ? logged : logged.filter((i) => i.type === recentCatFilter);
    return base.slice(0, 8);
  }, [logged, recentCatFilter]);

  return (
    <View style={styles.tabContent}>
      {/* Logged / Followers / Following */}
      <View style={styles.statsBox}>
        <Pressable style={styles.stat} onPress={onLoggedPress} disabled={!onLoggedPress} hitSlop={4}>
          <View style={styles.statNumRow}>
            <SymbolView name="archivebox.fill" size={18} tintColor={Brand.trust} type="monochrome" style={styles.statSfIcon} />
            <Text style={[styles.statNum, styles.statNumAccent]}>{logged.length}</Text>
          </View>
          <Text style={styles.statLbl}>LOGGED</Text>
          <Text style={styles.statSubLbl}>items logged</Text>
        </Pressable>
        <View style={styles.statDiv} />
        <Pressable style={styles.stat} onPress={onFollowersPress} disabled={!onFollowersPress} hitSlop={4}>
          <View style={styles.statNumRow}>
            <SymbolView name="person.2.fill" size={18} tintColor={Brand.trust} type="monochrome" style={styles.statSfIcon} />
            <Text style={[styles.statNum, styles.statNumAccent]}>{followersCount}</Text>
          </View>
          <Text style={styles.statLbl}>FOLLOWERS</Text>
          <Text style={styles.statSubLbl}>people follow you</Text>
        </Pressable>
        <View style={styles.statDiv} />
        <Pressable style={styles.stat} onPress={onFollowingPress} disabled={!onFollowingPress} hitSlop={4}>
          <View style={styles.statNumRow}>
            <SymbolView name="person.fill" size={18} tintColor={Brand.trust} type="monochrome" style={styles.statSfIcon} />
            <Text style={[styles.statNum, styles.statNumAccent]}>{followingCount}</Text>
          </View>
          <Text style={styles.statLbl}>FOLLOWING</Text>
          <Text style={styles.statSubLbl}>people you follow</Text>
        </Pressable>
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

      {/* Weekly Goal + Currently Active */}
      <View style={styles.goalRow}>
        <View style={[styles.goalCard, styles.statsCard]}>
          <Pressable onPress={editWeeklyGoal} hitSlop={8}>
            <Text style={styles.statsCardTitle}>WEEKLY GOAL ✎</Text>
          </Pressable>
          <Text style={styles.goalNum}>{weeklyCount}<Text style={styles.goalTarget}> / {weeklyTarget}</Text></Text>
          <Text style={styles.goalSub}>logs this week</Text>
          <View style={styles.goalBarRow}>
            {Array.from({ length: weeklyTarget }, (_, i) => (
              <View key={i} style={[styles.goalBlock, i < weeklyCount && styles.goalBlockFilled]} />
            ))}
          </View>
          <Text style={styles.goalFooter}>
            {weeklyCount >= weeklyTarget ? '🎉 Goal reached!' : `${daysLeftInWeek} day${daysLeftInWeek !== 1 ? 's' : ''} left to go!`}
          </Text>
        </View>
        <View style={[styles.goalCard, styles.statsCard]}>
          <Text style={styles.statsCardTitle}>CURRENTLY ACTIVE</Text>
          {activeCategories.length === 0 ? (
            <Text style={styles.goalSub}>Nothing active yet.</Text>
          ) : (
            activeCategories.slice(0, 4).map((cat, i) => (
              <View key={i} style={[styles.activeRow, i > 0 && styles.activeRowBorder]}>
                <View style={[styles.activeIcon, { backgroundColor: cat.bg }]}>
                  <SymbolView name={cat.sf as any} size={13} tintColor={cat.color} type="monochrome" />
                </View>
                <View style={styles.activeInfo}>
                  <Text style={styles.activeLabel}>{cat.label}</Text>
                  <Text style={[styles.activeSub, { color: cat.color }]}>{cat.sub}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </View>

      {/* MyTaste Top 4 */}
      {top4.length > 0 ? (
        <View style={styles.statsCard}>
          <View style={styles.myTasteHeader}>
            <Text style={styles.myTasteTitle}>MyTaste Top 4</Text>
            <Text style={styles.myTasteSub}>your most compatible friends</Text>
            <Pressable style={styles.myTasteViewAll} hitSlop={8} onPress={() => router.push('/discover-people-modal')}>
              <Text style={styles.myTasteViewAllText}>View all</Text>
            </Pressable>
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

      {/* Recently Logged */}
      <View style={styles.statsCard}>
        <Text style={styles.statsCardTitle}>RECENTLY LOGGED</Text>
        <View style={[styles.chipRow, styles.recentChipRow]}>
          {[{ type: 'all' as const, label: 'All' }, ...STAT_CATEGORIES.map((c) => ({ type: c.type, label: c.label }))].map((f) => {
            const active = recentCatFilter === f.type;
            return (
              <Pressable key={f.type} style={[styles.recentChip, active && styles.recentChipActive]} onPress={() => setRecentCatFilter(f.type)}>
                <Text style={[styles.recentChipText, active && styles.recentChipTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {recentItems.map((item) => (
          <View key={item.id} style={styles.recentRow}>
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.recentThumb} resizeMode="cover" />
            ) : (
              <View style={[styles.recentThumb, styles.recentThumbFallback]} />
            )}
            <Text style={styles.recentTitle} numberOfLines={1}>{item.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
