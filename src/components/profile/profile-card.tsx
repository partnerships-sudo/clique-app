import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import { useMyTasteTop4 } from '@/features/follows/api';
import type { LibraryItem } from '@/features/library/api';
import { useUploadBanner, type Profile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export type ProfileCardBadge = Pick<BadgeDef, 'key' | 'name' | 'icon' | 'tier'>;

const ONLINE_COLOR = '#3DDC84';

type ProfileTab = 'feed' | 'watchlist' | 'collection' | 'stats';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'collection', label: 'Collection' },
  { key: 'stats', label: 'Stats' },
];

const CAT_FILTERS: { type: EntryType | 'all'; label: string; color: string }[] = [
  { type: 'all', label: 'All', color: '#5B4FE8' },
  { type: 'watch', label: 'TV & Film', color: '#FF6B6B' },
  { type: 'read', label: 'Books', color: '#5FA8FF' },
  { type: 'play', label: 'Games', color: '#5FD9FF' },
  { type: 'podcast', label: 'Podcasts', color: '#C084FC' },
  { type: 'listen', label: 'Music', color: '#9B95AC' },
];

const STAT_CATEGORIES = [
  { type: 'watch' as EntryType, label: 'TV', icon: '📺', color: '#FF6B6B' },
  { type: 'play' as EntryType, label: 'Games', icon: '🎮', color: '#5FD9FF' },
  { type: 'podcast' as EntryType, label: 'Podcasts', icon: '🎙️', color: '#C084FC' },
  { type: 'listen' as EntryType, label: 'Music', icon: '🎵', color: '#9B95AC' },
  { type: 'read' as EntryType, label: 'Books', icon: '📚', color: '#5FA8FF' },
];

export interface ProfileCardFriendAction {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'muted';
}

export function ProfileCard({
  profile,
  library,
  followersCount,
  followingCount,
  onLoggedPress,
  onFollowersPress,
  onFollowingPress,
  onEditPress,
  onCollectionPress,
  collectionLabel = '📦 My Collection',
  featuredBadges = [],
  earnedBadgeCount,
  onOpenAchievements,
  onShare,
  friendAction,
}: {
  profile: Profile | null | undefined;
  library: LibraryItem[];
  followersCount: number;
  followingCount: number;
  onLoggedPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  /** Omit for a read-only (friend's) profile — hides the edit link and disables banner editing. */
  onEditPress?: () => void;
  onCollectionPress?: () => void;
  collectionLabel?: string;
  featuredBadges?: ProfileCardBadge[];
  earnedBadgeCount?: number;
  onOpenAchievements?: () => void;
  /** Own profile only — shows a share icon next to the name. */
  onShare?: () => void;
  /** Friend's profile only — "+ Follow" / "Request to Follow" / "Following". */
  friendAction?: ProfileCardFriendAction;
}) {
  const isOwnProfile = !!onEditPress;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile?.full_name || profile?.username || 'Someone';
  const uploadBanner = useUploadBanner();

  async function handleChangeBanner() {
    if (!isOwnProfile) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a banner image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 5],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      await uploadBanner.mutateAsync(result.assets[0].uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload your banner. Please try again.');
    }
  }

  const [profileTab, setProfileTab] = useState<ProfileTab>('feed');
  const [catFilter, setCatFilter] = useState<EntryType | 'all'>('all');

  const logged = library.filter((i) => i.status !== 'watchlist');
  const watchlist = library.filter((i) => i.status === 'watchlist');

  const feedItems = useMemo(() => {
    const items = catFilter === 'all' ? logged : logged.filter((i) => i.type === catFilter);
    return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [logged, catFilter]);

  const counts: Record<EntryType, number> = { watch: 0, read: 0, play: 0, listen: 0, podcast: 0 };
  logged.forEach((item) => { counts[item.type] += 1; });
  const maxCount = Math.max(1, ...Object.values(counts));

  // Streak
  const loggedDates = new Set(logged.map((i) => {
    const d = new Date(i.created_at);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  }));
  let streakDays = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (loggedDates.has(key)) streakDays++;
    else if (offset > 0) break;
  }
  const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { label: DAY_LABELS[d.getDay()], done: loggedDates.has(key) };
  });

  // Weekly goal: logs since last Monday
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const weeklyCount = logged.filter((i) => new Date(i.created_at) >= monday).length;
  const WEEKLY_TARGET = 10;
  const daysLeftInWeek = 7 - ((today.getDay() + 6) % 7) - 1;

  // Currently active (non-finished, non-watchlist)
  const active = logged.filter((i) => i.status !== 'finished');
  const tvShows = active.filter((i) => i.type === 'watch' && i.media_type !== 'movie');
  const tvMovies = active.filter((i) => i.type === 'watch' && i.media_type === 'movie');
  const activeBooks = active.filter((i) => i.type === 'read');
  const activeGames = active.filter((i) => i.type === 'play');
  const activePodcasts = active.filter((i) => i.type === 'podcast');
  const activeMusic = active.filter((i) => i.type === 'listen');
  const activeCategories = [
    tvShows.length ? { label: 'TV', sub: `${tvShows.length} show${tvShows.length !== 1 ? 's' : ''}`, icon: '📺', color: '#FF6B6B', bg: '#FF6B6B22' } : null,
    tvMovies.length ? { label: 'TV', sub: `${tvMovies.length} movie${tvMovies.length !== 1 ? 's' : ''}`, icon: '🎬', color: '#FF6B6B', bg: '#FF6B6B22' } : null,
    activeBooks.length ? { label: 'Books', sub: `${activeBooks.length} book${activeBooks.length !== 1 ? 's' : ''}`, icon: '📚', color: '#5FA8FF', bg: '#5FA8FF22' } : null,
    activeGames.length ? { label: 'Games', sub: `${activeGames.length} game${activeGames.length !== 1 ? 's' : ''}`, icon: '🎮', color: '#5FD9FF', bg: '#5FD9FF22' } : null,
    activePodcasts.length ? { label: 'Podcasts', sub: `${activePodcasts.length} podcast${activePodcasts.length !== 1 ? 's' : ''}`, icon: '🎙️', color: '#C084FC', bg: '#C084FC22' } : null,
    activeMusic.length ? { label: 'Music', sub: `${activeMusic.length} track${activeMusic.length !== 1 ? 's' : ''}`, icon: '🎵', color: '#9B95AC', bg: '#9B95AC22' } : null,
  ].filter(Boolean) as { label: string; sub: string; icon: string; color: string; bg: string }[];

  // Top genres: extract last segment of sub field
  const genreCounts = new Map<string, number>();
  for (const item of logged) {
    if (!item.sub) continue;
    const parts = item.sub.split('•').map((s) => s.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (!last || last.match(/^\d{4}$/)) continue;
    for (const g of last.split(',').map((s) => s.trim()).filter(Boolean)) {
      genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
    }
  }
  const topGenres = [...genreCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count], i) => ({ name, count, rank: i + 1, color: ['#FF6B6B', '#5B4FE8', '#F59E0B'][i] }));

  // Recently logged (for stats tab bottom)
  const [recentCatFilter, setRecentCatFilter] = useState<EntryType | 'all'>('all');
  const recentItems = useMemo(() => {
    const base = recentCatFilter === 'all' ? logged : logged.filter((i) => i.type === recentCatFilter);
    return base.slice(0, 8);
  }, [logged, recentCatFilter]);

  // MyTaste Top 4
  const { data: top4 = [] } = useMyTasteTop4();

  return (
    <View style={styles.card}>
      <Pressable
        onPress={handleChangeBanner}
        style={styles.bannerWrap}
        disabled={uploadBanner.isPending || !isOwnProfile}>
        {profile?.banner_url ? (
          <Image source={{ uri: profile.banner_url }} style={styles.bannerImg} />
        ) : (
          <View style={styles.bannerPlaceholder} />
        )}
        <LinearGradient colors={['transparent', Brand.card]} style={styles.bannerFade} />
        {uploadBanner.isPending ? (
          <View style={styles.bannerLoading}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : isOwnProfile ? (
          <View style={styles.bannerEditBadge}>
            <SymbolView name="camera.fill" size={13} tintColor="#fff" type="monochrome" />
          </View>
        ) : null}
      </Pressable>

      <View style={styles.contentPad}>
        {/* Avatar left + name/buttons right */}
        <View style={styles.headerRow}>
          <View style={styles.avWrap}>
            <View style={styles.avRing}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avImg} />
              ) : (
                <View style={styles.avFallback}>
                  <Text style={styles.avFallbackText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
            </View>
            <View style={styles.onlineDot} />
          </View>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>{name}</Text>
              {onEditPress ? (
                <Pressable onPress={onEditPress} hitSlop={10} style={styles.iconBtn}>
                  <SymbolView name="pencil" size={14} tintColor={Brand.trust} type="monochrome" />
                </Pressable>
              ) : null}
              {onShare ? (
                <Pressable onPress={onShare} hitSlop={10} style={styles.iconBtn}>
                  <SymbolView name="square.and.arrow.up" size={14} tintColor={Brand.trust} type="monochrome" />
                </Pressable>
              ) : null}
              {friendAction ? (
                <Pressable
                  onPress={friendAction.onPress}
                  disabled={!friendAction.onPress}
                  hitSlop={8}
                  style={[styles.friendActionBtn, friendAction.variant === 'muted' && styles.friendActionBtnMuted]}>
                  <Text style={[styles.friendActionBtnText, friendAction.variant === 'muted' && styles.friendActionBtnTextMuted]}>
                    {friendAction.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {profile?.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}

            {/* Currently active status pill */}
            {active[0] ? (
              <View style={styles.activityPill}>
                <View style={styles.activityDot} />
                <Text style={styles.activityText} numberOfLines={1}>
                  {active[0].status.charAt(0).toUpperCase() + active[0].status.slice(1)}: {active[0].title}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

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

        {/* Profile tab bar */}
        <View style={styles.tabRow}>
          {PROFILE_TABS.map((tab) => {
            const isActive = tab.key === profileTab;
            return (
              <Pressable key={tab.key} style={[styles.tab, isActive && styles.tabActive]} onPress={() => setProfileTab(tab.key)}>
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* FEED TAB */}
        {profileTab === 'feed' ? (
          <View style={styles.tabContent}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
              {CAT_FILTERS.map((f) => {
                const active = catFilter === f.type;
                return (
                  <Pressable key={f.type} style={[styles.chip, active && { backgroundColor: f.color }]} onPress={() => setCatFilter(f.type)}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {feedItems.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged yet.</Text>
            ) : (
              feedItems.map((item) => (
                <View key={item.id} style={styles.feedRow}>
                  {item.poster ? (
                    <Image source={{ uri: item.poster }} style={styles.feedThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.feedThumb, styles.feedThumbFallback]} />
                  )}
                  <View style={styles.feedInfo}>
                    <Text style={styles.feedTitle} numberOfLines={1}>{item.title}</Text>
                    {item.sub ? <Text style={styles.feedSub} numberOfLines={1}>{item.sub}</Text> : null}
                    <View style={styles.feedMeta}>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{item.status.toUpperCase()}</Text>
                      </View>
                      {item.date ? <Text style={styles.feedDate}>{item.date}</Text> : null}
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* WATCHLIST TAB */}
        {profileTab === 'watchlist' ? (
          <View style={styles.tabContent}>
            {watchlist.length === 0 ? (
              <Text style={styles.emptyText}>Your watchlist is empty.</Text>
            ) : (
              watchlist.map((item) => (
                <View key={item.id} style={styles.feedRow}>
                  {item.poster ? (
                    <Image source={{ uri: item.poster }} style={styles.feedThumb} resizeMode="cover" />
                  ) : (
                    <View style={[styles.feedThumb, styles.feedThumbFallback]} />
                  )}
                  <View style={styles.feedInfo}>
                    <Text style={styles.feedTitle} numberOfLines={1}>{item.title}</Text>
                    {item.sub ? <Text style={styles.feedSub} numberOfLines={1}>{item.sub}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* COLLECTION TAB */}
        {profileTab === 'collection' ? (
          <View style={styles.tabContent}>
            {onCollectionPress ? (
              <Pressable style={styles.collectionBtn} onPress={onCollectionPress}>
                <Text style={styles.collectionBtnText}>📦 View My Collection</Text>
              </Pressable>
            ) : (
              <Text style={styles.emptyText}>No collection yet.</Text>
            )}
          </View>
        ) : null}

        {/* STATS TAB */}
        {profileTab === 'stats' ? (
          <View style={styles.tabContent}>
            {/* Logged / Followers / Following */}
            <View style={styles.statsBox}>
              <Pressable style={styles.stat} onPress={onLoggedPress} disabled={!onLoggedPress} hitSlop={4}>
                <Text style={styles.statIcon}>🗂️</Text>
                <Text style={[styles.statNum, onLoggedPress && styles.statNumAccent]}>{logged.length}</Text>
                <Text style={styles.statLbl}>LOGGED</Text>
                <Text style={styles.statSubLbl}>items logged</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowersPress} disabled={!onFollowersPress} hitSlop={4}>
                <Text style={styles.statIcon}>👥</Text>
                <Text style={[styles.statNum, styles.statNumAccent]}>{followersCount}</Text>
                <Text style={styles.statLbl}>FOLLOWERS</Text>
                <Text style={styles.statSubLbl}>people follow you</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowingPress} disabled={!onFollowingPress} hitSlop={4}>
                <Text style={styles.statIcon}>👤</Text>
                <Text style={[styles.statNum, styles.statNumAccent]}>{followingCount}</Text>
                <Text style={styles.statLbl}>FOLLOWING</Text>
                <Text style={styles.statSubLbl}>people you follow</Text>
              </Pressable>
            </View>

            {/* Streak */}
            <View style={styles.streakCard}>
              <View style={styles.streakLeft}>
                <Text style={styles.streakFire}>🔥</Text>
                <Text style={styles.streakDays}>{streakDays} {streakDays === 1 ? 'DAY' : 'DAYS'} STREAK</Text>
                <Text style={styles.streakMsg}>
                  {streakDays >= 3 ? "Keep it alive. You're on fire." : 'Start your streak today!'}
                </Text>
                <View style={styles.weekRow}>
                  {weekDays.map((d, i) => (
                    <View key={i} style={styles.weekDay}>
                      <View style={[styles.weekDot, d.done && styles.weekDotDone]} />
                      <Text style={styles.weekLabel}>{d.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.streakRight}>
                <Text style={styles.longestLabel}>Longest Streak</Text>
                <Text style={styles.longestDays}>{streakDays}</Text>
                <Text style={styles.longestUnit}>days</Text>
              </View>
            </View>

            {/* Weekly Goal + Currently Active */}
            <View style={styles.goalRow}>
              <View style={[styles.goalCard, styles.statsCard]}>
                <Text style={styles.statsCardTitle}>WEEKLY GOAL</Text>
                <Text style={styles.goalNum}>{weeklyCount}<Text style={styles.goalTarget}> / {WEEKLY_TARGET}</Text></Text>
                <Text style={styles.goalSub}>logs this week</Text>
                <View style={styles.goalBarRow}>
                  {Array.from({ length: WEEKLY_TARGET }, (_, i) => (
                    <View key={i} style={[styles.goalBlock, i < weeklyCount && styles.goalBlockFilled]} />
                  ))}
                </View>
                <Text style={styles.goalFooter}>
                  {weeklyCount >= WEEKLY_TARGET ? '🎉 Goal reached!' : `${daysLeftInWeek} day${daysLeftInWeek !== 1 ? 's' : ''} left to go!`}
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
                        <Text style={styles.activeIconEmoji}>{cat.icon}</Text>
                      </View>
                      <View style={styles.activeInfo}>
                        <Text style={styles.activeLabel}>{cat.label}</Text>
                        <Text style={[styles.activeSub, { color: cat.color }]}>{cat.sub}</Text>
                      </View>
                      <Text style={styles.activeChevron}>›</Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* MyTaste Top 4 */}
            {top4.length > 0 ? (
              <View style={styles.statsCard}>
                <View style={styles.cardHeaderRow}>
                  <View>
                    <Text style={styles.cardHeaderTitle}>MyTaste Top 4</Text>
                    <Text style={styles.cardHeaderSub}>your most compatible friends</Text>
                  </View>
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

            {/* Top Genres + Top Categories side by side */}
            <View style={styles.goalRow}>
              <View style={[styles.goalCard, styles.statsCard]}>
                <Text style={styles.statsCardTitle}>TOP GENRES</Text>
                {topGenres.length === 0 ? (
                  <Text style={styles.goalSub}>No data yet.</Text>
                ) : topGenres.map((g) => (
                  <View key={g.name} style={styles.genreRow}>
                    <Text style={[styles.genreRank, { color: g.color }]}>#{g.rank}</Text>
                    <View style={styles.genreInfo}>
                      <Text style={styles.genreName} numberOfLines={1}>{g.name}</Text>
                      <View style={[styles.genreBar, { backgroundColor: g.color + '33' }]}>
                        <View style={[styles.genreBarFill, { backgroundColor: g.color, width: `${Math.round((g.count / (topGenres[0]?.count || 1)) * 100)}%` }]} />
                      </View>
                    </View>
                    <Text style={styles.genreCount}>{g.count}</Text>
                  </View>
                ))}
              </View>
              <View style={[styles.goalCard, styles.statsCard]}>
                <Text style={styles.statsCardTitle}>TOP CATEGORIES</Text>
                {STAT_CATEGORIES.map((cat) => (
                  <View key={cat.label} style={styles.catRow}>
                    <Text style={styles.catIcon}>{cat.icon}</Text>
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
                {[{ type: 'all' as EntryType | 'all', label: 'All' }, ...STAT_CATEGORIES.map((c) => ({ type: c.type as EntryType | 'all', label: c.label }))].map((f) => {
                  const active = recentCatFilter === f.type;
                  return (
                    <Pressable key={f.type} style={[styles.recentChip, active && styles.recentChipActive]} onPress={() => setRecentCatFilter(f.type)}>
                      <Text style={[styles.recentChipText, active && styles.recentChipTextActive]}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
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
        ) : null}

      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderRadius: 24,
      overflow: 'hidden',
    },
    bannerWrap: {
      width: '100%',
      aspectRatio: 16 / 5,
      backgroundColor: Brand.tlight,
    },
    bannerImg: { width: '100%', height: '100%' },
    bannerPlaceholder: { width: '100%', height: '100%' },
    bannerFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
    bannerEditBadge: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    bannerLoading: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    contentPad: {
      paddingTop: 0,
      paddingBottom: 22,
      paddingHorizontal: 18,
    },
    // New header: avatar left, name+info right
    headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginTop: -42, marginBottom: 16 },
    avWrap: { position: 'relative' },
    avRing: {
      width: 90,
      height: 90,
      borderRadius: 45,
      borderWidth: 2.5,
      borderColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Brand.trust,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 10,
      elevation: 10,
      backgroundColor: Brand.card,
    },
    avImg: { width: 82, height: 82, borderRadius: 41 },
    avFallback: {
      width: 82,
      height: 82,
      borderRadius: 41,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avFallbackText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 29, color: Brand.ink },
    onlineDot: {
      position: 'absolute',
      bottom: 3,
      right: 3,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: ONLINE_COLOR,
      borderWidth: 2,
      borderColor: Brand.card,
    },
    headerInfo: { flex: 1, minWidth: 0, paddingTop: 46 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, flexShrink: 1 },
    iconBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handle: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted, marginBottom: 8 },
    activityPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 12,
      alignSelf: 'flex-start',
    },
    activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ONLINE_COLOR },
    activityText: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.trust },
    friendActionBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    friendActionBtnMuted: { backgroundColor: Brand.tlight, borderWidth: 1, borderColor: Brand.border },
    friendActionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: '#fff' },
    friendActionBtnTextMuted: { color: Brand.muted },

    tabRow: {
      flexDirection: 'row',
      width: '100%',
      marginBottom: 22,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    tab: { flex: 1, alignItems: 'center', paddingBottom: 10 },
    tabActive: { borderBottomWidth: 2.5, borderBottomColor: Brand.trust },
    tabLabel: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted },
    tabLabelActive: { color: Brand.ink, fontFamily: BrandFonts.syneBold },

    statsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 16,
      paddingVertical: 10,
      marginBottom: 24,
    },
    stat: { flex: 1, alignItems: 'center' },
    statNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 21, color: Brand.ink },
    statNumAccent: { color: Brand.trust },
    statLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 2,
    },
    statDiv: { width: 1, height: 22, backgroundColor: Brand.border },

    badgesSection: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 20,
    },
    badgesTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.ink,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      textAlign: 'center',
      marginBottom: 12,
    },
    badgesRow: { flexDirection: 'row', gap: 18, justifyContent: 'center' },
    badgeItem: { alignItems: 'center', width: 66 },
    badgeCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeIcon: { fontSize: 22 },
    badgeName: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 10,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 5,
    },
    badgesEmpty: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      textAlign: 'center',
    },

    // Stats box
    statIcon: { fontSize: 18, marginBottom: 2 },
    statSubLbl: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted, marginTop: 1, textAlign: 'center' },

    // Tab content
    tabContent: { width: '100%' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, textAlign: 'center', paddingVertical: 24 },

    // Feed tab
    chipScroll: { marginBottom: 14 },
    chipRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 0 },
    chip: {
      paddingVertical: 5,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: Brand.tlight,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    chipText: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.muted },
    chipTextActive: { color: '#fff' },
    feedRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', marginBottom: 14 },
    feedThumb: { width: 44, height: 62, borderRadius: 8 },
    feedThumbFallback: { backgroundColor: Brand.tlight },
    feedInfo: { flex: 1, minWidth: 0, paddingTop: 2 },
    feedTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
    feedSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
    feedMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    statusPill: { backgroundColor: Brand.tlight, borderRadius: 10, paddingVertical: 2, paddingHorizontal: 7 },
    statusPillText: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: Brand.muted, letterSpacing: 0.5 },
    feedDate: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted },

    // Collection tab
    collectionBtn: {
      width: '100%',
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: Brand.tlight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: Brand.border,
      marginTop: 8,
    },
    collectionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },

    // Streak card
    streakCard: {
      width: '100%',
      backgroundColor: Brand.tlight,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    streakLeft: { flex: 1 },
    streakFire: { fontSize: 24, marginBottom: 4 },
    streakDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.trust },
    streakMsg: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2, marginBottom: 10 },
    weekRow: { flexDirection: 'row', gap: 6 },
    weekDay: { alignItems: 'center', gap: 4 },
    weekDot: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: Brand.border,
      alignItems: 'center', justifyContent: 'center',
    },
    weekDotDone: { backgroundColor: Brand.trust },
    weekCheck: { fontSize: 10, color: '#fff' },
    weekLabel: { fontFamily: BrandFonts.interMedium, fontSize: 8.5, color: Brand.muted },
    streakRight: { alignItems: 'center', justifyContent: 'center', minWidth: 60 },
    longestLabel: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
    longestDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink, lineHeight: 32 },
    longestUnit: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },

    // Stats card (top categories)
    statsCard: {
      width: '100%',
      backgroundColor: Brand.tlight,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    statsCardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    catIcon: { fontSize: 16, width: 22, textAlign: 'center' },
    catLabel: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.ink, width: 58 },
    catBarBg: { flex: 1, height: 6, backgroundColor: Brand.border, borderRadius: 3, overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 3 },
    catCount: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, width: 24, textAlign: 'right' },

    // Goal row (side-by-side cards)
    goalRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    goalCard: { flex: 1, marginBottom: 0 },
    goalNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.trust, lineHeight: 32, marginTop: 4 },
    goalTarget: { fontFamily: BrandFonts.interRegular, fontSize: 16, color: Brand.muted },
    goalSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 2, marginBottom: 8 },
    goalBarRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, marginBottom: 6 },
    goalBlock: { width: 14, height: 10, borderRadius: 3, backgroundColor: Brand.border },
    goalBlockFilled: { backgroundColor: Brand.trust },
    goalFooter: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted },

    // Currently active
    activeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
    activeRowBorder: { borderTopWidth: 1, borderTopColor: Brand.border },
    activeIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    activeIconEmoji: { fontSize: 14 },
    activeInfo: { flex: 1, minWidth: 0 },
    activeLabel: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink },
    activeSub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5 },
    activeChevron: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.muted },

    // Card header
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
    cardHeaderTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    cardHeaderSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },

    // MyTaste Top 4
    top4Row: { flexDirection: 'row', justifyContent: 'space-between' },
    top4Item: { alignItems: 'center', flex: 1 },
    top4ImgWrap: { position: 'relative', marginBottom: 6 },
    top4Img: { width: 64, height: 64, borderRadius: 10 },
    top4ImgFallback: { backgroundColor: Brand.tlight, alignItems: 'center', justifyContent: 'center' },
    top4ImgFallbackText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink },
    top4Badge: {
      position: 'absolute', bottom: -6, right: -6,
      backgroundColor: Brand.trust, borderRadius: 10,
      paddingVertical: 2, paddingHorizontal: 5,
    },
    top4BadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 9.5, color: '#fff' },
    top4Name: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.ink, textAlign: 'center', marginTop: 8 },
    top4Handle: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted, textAlign: 'center' },

    // Top genres
    genreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    genreRank: { fontFamily: BrandFonts.syneExtraBold, fontSize: 11, width: 18 },
    genreInfo: { flex: 1, minWidth: 0 },
    genreName: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.ink, marginBottom: 3 },
    genreBar: { height: 5, borderRadius: 3, overflow: 'hidden' },
    genreBarFill: { height: '100%', borderRadius: 3 },
    genreCount: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, width: 18, textAlign: 'right' },

    // Recently logged (stats tab)
    recentChip: {
      paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20,
      backgroundColor: Brand.tlight, borderWidth: 1, borderColor: Brand.border,
    },
    recentChipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    recentChipText: { fontFamily: BrandFonts.interMedium, fontSize: 11.5, color: Brand.muted },
    recentChipTextActive: { color: Brand.paper },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    recentThumb: { width: 44, height: 62, borderRadius: 8 },
    recentThumbFallback: { backgroundColor: Brand.tlight },
    recentTitle: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  });
}
