import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Vibration } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import { useCollectionItems, useCollectionItemsByUser, useRemoveFromCollection, type CollectionItem } from '@/features/collection/api';
import { useMyTasteTop4 } from '@/features/follows/api';
import { useMoveToLibrary, useRateLibraryItem, useRemoveLibraryItem, type LibraryItem } from '@/features/library/api';
import { isOnline } from '@/features/presence/api';
import { useUploadBanner, type Profile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { LibCard } from '@/components/library/lib-card';

export type ProfileCardBadge = Pick<BadgeDef, 'key' | 'name' | 'icon' | 'tier'>;

const ONLINE_COLOR = '#3DDC84';

type ProfileTab = 'feed' | 'watchlist' | 'collection' | 'stats';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'collection', label: 'Collection' },
  { key: 'stats', label: 'Stats' },
];

const CAT_FILTERS: { type: EntryType | 'all'; label: string; color: string; sf: string }[] = [
  { type: 'all',     label: 'All',      color: '#5B4FE8', sf: 'square.grid.2x2.fill' },
  { type: 'watch',  label: 'TV & Film', color: '#FF6B6B', sf: 'film.stack' },
  { type: 'read',   label: 'Books',     color: '#5FA8FF', sf: 'book.closed.fill' },
  { type: 'play',   label: 'Games',     color: '#5FD9FF', sf: 'gamecontroller.fill' },
  { type: 'podcast',label: 'Podcasts',  color: '#C084FC', sf: 'mic.fill' },
  { type: 'listen', label: 'Music',     color: '#9B95AC', sf: 'headphones' },
];

const STAT_CATEGORIES = [
  { type: 'watch' as EntryType, label: 'TV', sf: 'tv', color: '#FF6B6B', bg: '#FF6B6B18' },
  { type: 'play' as EntryType, label: 'Games', sf: 'gamecontroller.fill', color: '#5BC8F5', bg: '#5BC8F518' },
  { type: 'podcast' as EntryType, label: 'Podcasts', sf: 'mic.fill', color: '#C084FC', bg: '#C084FC18' },
  { type: 'listen' as EntryType, label: 'Music', sf: 'music.note', color: '#9B95AC', bg: '#9B95AC18' },
  { type: 'read' as EntryType, label: 'Books', sf: 'book.fill', color: '#5FA8FF', bg: '#5FA8FF18' },
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
  closeFriendAction,
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
  /** Toggle close-friend status from the friend profile. */
  closeFriendAction?: { isCloseFriend: boolean; onPress: () => void };
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
  const [feedSort, setFeedSort] = useState<'recent' | 'alpha'>('recent');
  const [watchlistView, setWatchlistView] = useState<'mine' | 'friends'>('mine');
  const moveToLibrary = useMoveToLibrary();
  const rateItem = useRateLibraryItem();
  const removeLibraryItem = useRemoveLibraryItem();
  const [ratingItem, setRatingItem] = useState<LibraryItem | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState('');

  // Collection tab state
  type CollectionView = 'all' | 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
  type CollectionSort = 'recent' | 'rating' | 'alpha';
  const [collectionView, setCollectionView] = useState<CollectionView>('all');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');
  const ownCollectionData = useCollectionItems();
  const friendCollectionData = useCollectionItemsByUser(isOwnProfile ? undefined : profile?.id);
  const { items: collectionItems, isLoading: isCollectionLoading } = isOwnProfile ? ownCollectionData : friendCollectionData;
  const removeFromCollection = useRemoveFromCollection();
  const hasAutoSelectedCollView = useRef(false);
  useEffect(() => {
    if (isCollectionLoading || hasAutoSelectedCollView.current) return;
    hasAutoSelectedCollView.current = true;
    if (collectionItems.length > 0) setCollectionView('all');
  }, [isCollectionLoading, collectionItems]);

  const collectionFiltered = useMemo(() => {
    const items = collectionView === 'all' ? collectionItems : collectionItems.filter((i: CollectionItem) => i.type === collectionView);
    const sorted = [...items];
    if (collectionSort === 'recent') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (collectionSort === 'rating') sorted.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
    else if (collectionSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [collectionItems, collectionView, collectionSort]);

  const logged = library.filter((i) => i.status !== 'watchlist');
  const watchlist = library.filter((i) => i.status === 'watchlist');
  const unratedLogged = logged.filter((i) => !i.rating);

  const feedItems = useMemo(() => {
    const items = catFilter === 'all' ? logged : logged.filter((i) => i.type === catFilter);
    const sorted = [...items];
    if (feedSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [logged, catFilter, feedSort]);

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

  // Longest streak: scan all unique log dates in chronological order
  let longestStreak = streakDays;
  if (logged.length > 0) {
    const sortedDays = [...loggedDates]
      .map((key) => {
        const [y, m, day] = key.split('-').map(Number);
        const d = new Date(y, m, day);
        return d.getTime();
      })
      .sort((a, b) => a - b);
    let run = 1;
    const MS_PER_DAY = 86_400_000;
    for (let i = 1; i < sortedDays.length; i++) {
      if (sortedDays[i] - sortedDays[i - 1] === MS_PER_DAY) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 1;
      }
    }
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
    tvShows.length ? { label: 'TV', sub: `${tvShows.length} show${tvShows.length !== 1 ? 's' : ''}`, sf: 'tv.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    tvMovies.length ? { label: 'TV', sub: `${tvMovies.length} movie${tvMovies.length !== 1 ? 's' : ''}`, sf: 'film.fill', color: '#FF6B6B', bg: '#FF6B6B18' } : null,
    activeBooks.length ? { label: 'Books', sub: `${activeBooks.length} book${activeBooks.length !== 1 ? 's' : ''}`, sf: 'book.fill', color: '#5FA8FF', bg: '#5FA8FF18' } : null,
    activeGames.length ? { label: 'Games', sub: `${activeGames.length} game${activeGames.length !== 1 ? 's' : ''}`, sf: 'gamecontroller.fill', color: '#5FD9FF', bg: '#5FD9FF18' } : null,
    activePodcasts.length ? { label: 'Podcasts', sub: `${activePodcasts.length} podcast${activePodcasts.length !== 1 ? 's' : ''}`, sf: 'mic.fill', color: '#C084FC', bg: '#C084FC18' } : null,
    activeMusic.length ? { label: 'Music', sub: `${activeMusic.length} track${activeMusic.length !== 1 ? 's' : ''}`, sf: 'headphones', color: '#9B95AC', bg: '#9B95AC18' } : null,
  ].filter(Boolean) as { label: string; sub: string; sf: string; color: string; bg: string }[];

  // Top genres:
  // - Games ('play'): genre is first sub segment ("Genre · Year")
  // - Movies/TV ('watch'): genre is last sub segment ("Film · Year · Genre" or "TV Series · Year · Genre")
  //   New logs include genre; older entries without it are simply skipped.
  // - Books/listen/podcast: no genre stored in sub, skip.
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
      // Genre is appended as the last segment; skip years and format labels
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
            {isOnline(profile?.last_seen_at) && <View style={styles.onlineDot} />}
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
              {closeFriendAction ? (
                <Pressable onPress={closeFriendAction.onPress} hitSlop={8}
                  style={[styles.friendActionBtn, closeFriendAction.isCloseFriend ? styles.closeFriendBtnActive : styles.friendActionBtnMuted]}>
                  <Text style={[styles.friendActionBtnText, closeFriendAction.isCloseFriend ? styles.closeFriendBtnTextActive : styles.friendActionBtnTextMuted]}>
                    {closeFriendAction.isCloseFriend ? '💚 Close Friend' : '+ Close Friend'}
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
            {/* Category filter chips with SF Symbols */}
            <View style={[styles.chipScroll, styles.chipRow, styles.chipRowCentered]}>
              {CAT_FILTERS.map((f) => {
                const isActive = catFilter === f.type;
                return (
                  <Pressable
                    key={f.type}
                    style={[styles.chip, isActive && { backgroundColor: f.color }]}
                    onPress={() => setCatFilter(f.type)}>
                    <SymbolView
                      name={f.sf as any}
                      size={22}
                      tintColor={isActive ? '#fff' : Brand.muted}
                      style={styles.chipIcon}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{f.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Sort row */}
            <View style={styles.feedSortRow}>
              <Text style={styles.feedSortLabel}>Sort by</Text>
              {([{ value: 'recent', label: 'Recent' }, { value: 'alpha', label: 'A—Z' }] as const).map((opt) => {
                const isActive = feedSort === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.feedSortBtn, isActive && styles.feedSortBtnActive]}
                    onPress={() => setFeedSort(opt.value)}>
                    <Text style={[styles.feedSortBtnText, isActive && styles.feedSortBtnTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {feedItems.length === 0 ? (
              <Text style={styles.emptyText}>Nothing logged yet.</Text>
            ) : (
              feedItems.map((item) => (
                <Pressable
                  key={item.id}
                  style={{ marginBottom: 5 }}
                  onLongPress={() => {
                    Vibration.vibrate(40);
                    Alert.alert('Remove from feed?', item.title, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
                    ]);
                  }}
                  delayLongPress={500}>
                  <LibCard item={item} />
                </Pressable>
              ))
            )}
          </View>
        ) : null}

        {/* WATCHLIST TAB */}
        {profileTab === 'watchlist' ? (
          <View style={styles.tabContent}>
            {/* My Watchlist / From Friends toggle */}
            <View style={styles.wlToggleRow}>
              <Pressable
                style={[styles.wlToggleBtn, watchlistView === 'mine' && styles.wlToggleBtnActive]}
                onPress={() => setWatchlistView('mine')}>
                <Text style={[styles.wlToggleTxt, watchlistView === 'mine' && styles.wlToggleTxtActive]}>My Watchlist</Text>
              </Pressable>
              <Pressable
                style={[styles.wlToggleBtn, watchlistView === 'friends' && styles.wlToggleBtnActive]}
                onPress={() => setWatchlistView('friends')}>
                <Text style={[styles.wlToggleTxt, watchlistView === 'friends' && styles.wlToggleTxtActive]}>From Friends</Text>
              </Pressable>
            </View>

            {/* Add to watchlist button */}
            {watchlistView === 'mine' ? (
              <Pressable
                style={styles.wlAddBtn}
                onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}>
                <Text style={styles.wlAddBtnText}>+ Add to watchlist</Text>
              </Pressable>
            ) : null}

            {/* Unrated logged items — rate to move to Collection */}
            {isOwnProfile && watchlistView === 'mine' && unratedLogged.length > 0 ? (
              <View style={styles.unratedSection}>
                <View style={styles.unratedHeader}>
                  <Text style={styles.unratedHeaderTitle}>Rate to add to Collection</Text>
                  <Text style={styles.unratedHeaderSub}>You finished these but haven't rated them yet</Text>
                </View>
                <View style={styles.wlGrid}>
                  {unratedLogged.map((item) => (
                    <View key={item.id} style={styles.wlGridItem}>
                      <View style={[styles.wlPosterWrap, styles.unratedPosterWrap]}>
                        {item.poster ? (
                          <Image source={{ uri: item.poster }} style={[styles.wlPoster, styles.unratedPoster]} resizeMode="cover" />
                        ) : (
                          <View style={[styles.wlPoster, styles.wlPosterFallback, styles.unratedPoster]}>
                            <Text style={styles.wlPosterFallbackText} numberOfLines={2}>{item.title}</Text>
                          </View>
                        )}
                      </View>
                      <Pressable
                        style={styles.wlRateBtn}
                        onPress={() => { setRatingItem(item); setRatingValue(null); setRatingNote(''); }}>
                        <Text style={styles.wlRateBtnText}>★ Rate it</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Poster grid */}
            {(() => {
              const items = watchlistView === 'mine'
                ? watchlist
                : watchlist.filter((i) => !!i.rec_from_user_name);
              if (items.length === 0) {
                return <Text style={styles.emptyText}>{watchlistView === 'mine' ? 'Your watchlist is empty — add things you want to get to!' : 'No recs yet — when a friend sends you a rec it shows up here automatically.'}</Text>;
              }
              return (
                <View style={styles.wlGrid}>
                  {items.map((item) => (
                    <Pressable
                      key={item.id}
                      style={styles.wlGridItem}
                      onLongPress={() => {
                        Vibration.vibrate(40);
                        Alert.alert('Remove from watchlist?', item.title, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Remove', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
                        ]);
                      }}
                      delayLongPress={500}>
                      <View style={styles.wlPosterWrap}>
                        {item.poster ? (
                          <Image source={{ uri: item.poster }} style={styles.wlPoster} resizeMode="cover" />
                        ) : (
                          <View style={[styles.wlPoster, styles.wlPosterFallback]}>
                            <Text style={styles.wlPosterFallbackText} numberOfLines={2}>{item.title}</Text>
                          </View>
                        )}
                        {item.rec_from_user_name ? (
                          <View style={styles.wlAvatar}>
                            <Text style={styles.wlAvatarText}>{item.rec_from_user_name.slice(0, 1).toUpperCase()}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Pressable style={styles.wlLogBtn} onPress={() => { setRatingItem(item); setRatingValue(null); setRatingNote(''); }}>
                        <SymbolView name="checkmark" size={10} tintColor="#fff" style={{ width: 11, height: 11 }} />
                        <Text style={styles.wlLogBtnText}>Log it</Text>
                      </Pressable>
                    </Pressable>
                  ))}
                </View>
              );
            })()}
          </View>
        ) : null}

        {/* COLLECTION TAB */}
        {profileTab === 'collection' ? (
          <View style={styles.tabContent}>
            {/* Search bar — own profile only */}
            {isOwnProfile ? (
              <Pressable style={styles.collSearchRow} onPress={() => router.push('/collection-add-modal')}>
                <SymbolView name="magnifyingglass" size={14} tintColor={Brand.muted} style={{ width: 16, height: 16, marginRight: 7 }} />
                <Text style={styles.collSearchPlaceholder}>Search & add to your collection…</Text>
                <Pressable
                  style={styles.collScanBtn}
                  hitSlop={8}
                  onPress={() => router.push('/collection-scan-modal')}>
                  <SymbolView name="barcode.viewfinder" size={16} tintColor="#fff" style={{ width: 18, height: 18 }} />
                </Pressable>
              </Pressable>
            ) : null}

            {/* Category chips — All first, then sorted by count */}
            <View style={styles.collCatRow}>
              {(() => {
                const cats = ([
                  { view: 'read',    sf: 'books.vertical', label: 'Books'    },
                  { view: 'watch',   sf: 'film',           label: 'Movies'   },
                  { view: 'tv',      sf: 'tv',             label: 'TV'       },
                  { view: 'listen',  sf: 'music.note',     label: 'Music'    },
                  { view: 'play',    sf: 'gamecontroller', label: 'Games'    },
                  { view: 'podcast', sf: 'mic',            label: 'Podcasts' },
                ] as const).map((c) => ({
                  ...c,
                  count: collectionItems.filter((i: CollectionItem) => i.type === c.view).length,
                })).sort((a, b) => b.count - a.count);

                return [
                  // "All" chip always first
                  <Pressable
                    key="all"
                    style={[styles.collCatBtn, collectionView === 'all' && styles.collCatBtnActive]}
                    onPress={() => setCollectionView('all')}>
                    <SymbolView name="square.grid.2x2.fill" size={15} tintColor={collectionView === 'all' ? '#fff' : Brand.muted} style={{ width: 18, height: 18 }} />
                    <Text style={[styles.collCatLabel, collectionView === 'all' && styles.collCatLabelActive]}>All</Text>
                    <Text style={[styles.collCatCount, collectionView === 'all' && styles.collCatCountActive]}>{collectionItems.length}</Text>
                  </Pressable>,
                  ...cats.map(({ view, sf, label, count }) => {
                    const active = collectionView === view;
                    return (
                      <Pressable
                        key={view}
                        style={[styles.collCatBtn, active && styles.collCatBtnActive]}
                        onPress={() => setCollectionView(view)}>
                        <SymbolView name={sf as any} size={15} tintColor={active ? '#fff' : Brand.muted} style={{ width: 18, height: 18 }} />
                        <Text style={[styles.collCatLabel, active && styles.collCatLabelActive]}>{label}</Text>
                        <Text style={[styles.collCatCount, active && styles.collCatCountActive]}>{count}</Text>
                      </Pressable>
                    );
                  }),
                ];
              })()}
            </View>

            {/* Sort row */}
            <View style={styles.collSortRow}>
              <Text style={styles.collSortLabel}>Organize</Text>
              {([{ value: 'recent', label: 'Recent' }, { value: 'rating', label: 'Rating' }, { value: 'alpha', label: 'A–Z' }] as const).map((opt) => {
                const active = collectionSort === opt.value;
                return (
                  <Pressable key={opt.value} style={[styles.collSortBtn, active && styles.collSortBtnActive]} onPress={() => setCollectionSort(opt.value)}>
                    <Text style={[styles.collSortBtnText, active && styles.collSortBtnTextActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* 3-column grid */}
            {collectionFiltered.length === 0 && !isCollectionLoading ? (
              <Text style={styles.emptyText}>Nothing here yet.</Text>
            ) : (
              <View style={styles.collGrid}>
                {collectionFiltered.map((item: CollectionItem) => {
                  const stars = item.user_rating ? Math.round(item.user_rating) : 0;
                  return (
                    <Pressable
                      key={item.id}
                      style={styles.collGridItem}
                      onPress={() => router.push({ pathname: '/collection-item-detail-modal', params: { id: item.id, title: item.title, sub: item.sub ?? undefined, poster: item.poster ?? undefined, type: item.type, format: item.format ?? undefined, userRating: item.user_rating?.toString() ?? undefined, externalId: item.external_id ?? undefined, isOwner: isOwnProfile ? '1' : '0' } })}>
                      {item.poster ? (
                        <Image source={{ uri: item.poster }} style={styles.collGridImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.collGridImg, styles.collGridImgPlaceholder]}>
                          <Text style={styles.collGridImgPlaceholderText} numberOfLines={2}>{item.title}</Text>
                        </View>
                      )}
                      {stars > 0 ? (
                        <View style={styles.collGridStars}>
                          <Text style={styles.collGridStarText}>{'★'.repeat(stars)}</Text>
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>
        ) : null}

        {/* STATS TAB */}
        {profileTab === 'stats' ? (
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
                <Text style={styles.streakMsg}>
                  {streakDays >= 3 ? "Keep it alive. You're on fire." : 'Start your streak today!'}
                </Text>
                <View style={styles.weekRow}>
                  {weekDays.map((d, i) => {
                    const isToday = i === weekDays.length - 1;
                    return (
                      <View key={i} style={styles.weekDay}>
                        <View style={[
                          styles.weekDot,
                          d.done && !isToday && styles.weekDotDone,
                          isToday && styles.weekDotToday,
                        ]} />
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

            {/* Top Genres + Top Categories side by side */}
            <View style={styles.goalRow}>
              {/* TOP GENRES */}
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

              {/* TOP CATEGORIES */}
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
                {[{ type: 'all' as EntryType | 'all', label: 'All' }, ...STAT_CATEGORIES.map((c) => ({ type: c.type as EntryType | 'all', label: c.label }))].map((f) => {
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
        ) : null}

      </View>

      {/* Rate-and-log sheet */}
      <Modal
        visible={!!ratingItem}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingItem(null)}>
        <Pressable style={styles.rateOverlay} onPress={() => setRatingItem(null)} />
        <View style={styles.rateSheet}>
          {ratingItem ? (
            <>
              <View style={styles.rateItemRow}>
                {ratingItem.poster ? (
                  <Image source={{ uri: ratingItem.poster }} style={styles.ratePoster} resizeMode="cover" />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rateTitle} numberOfLines={2}>{ratingItem.title}</Text>
                  {ratingItem.sub ? <Text style={styles.rateSub} numberOfLines={1}>{ratingItem.sub}</Text> : null}
                </View>
              </View>
              <Text style={styles.rateLabel}>Your rating</Text>
              <RatingPicker
                value={ratingValue ?? 0}
                iconStyle={(profile?.rating_icon as RatingIconStyle) ?? 'stars'}
                onChange={(v) => setRatingValue(v === 0 ? null : v)}
                size={36}
              />
              <TextInput
                style={styles.rateNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={Brand.muted}
                value={ratingNote}
                onChangeText={setRatingNote}
                multiline
              />
              <Pressable
                style={[styles.rateLogBtn, (ratingValue === null || rateItem.isPending) && styles.rateLogBtnDisabled]}
                disabled={ratingValue === null || rateItem.isPending}
                onPress={async () => {
                  if (ratingValue === null || !ratingItem) return;
                  await rateItem.mutateAsync({
                    id: ratingItem.id,
                    rating: ratingValue,
                    title: ratingItem.title,
                    type: ratingItem.type,
                    sub: ratingItem.sub ?? null,
                    poster: ratingItem.poster ?? null,
                    externalId: ratingItem.external_id ?? null,
                    mediaType: ratingItem.media_type ?? null,
                    extRating: ratingItem.ext_rating ?? null,
                  });
                  setRatingItem(null);
                }}>
                {rateItem.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.rateLogBtnText}>{unratedLogged.some(i => i.id === ratingItem?.id) ? 'Add to Collection →' : 'Log it →'}</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.paper,
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
      paddingTop: 4,
      paddingBottom: 32,
      paddingHorizontal: 20,
    },
    // New header: avatar left, name+info right
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
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
    headerInfo: { flex: 1, minWidth: 0 },
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
    closeFriendBtnActive: { backgroundColor: '#E6F9EA', borderWidth: 1, borderColor: '#248A3D' },
    closeFriendBtnTextActive: { color: '#248A3D' },
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
      marginBottom: 7,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    tab: { flex: 1, alignItems: 'center', paddingBottom: 8 },
    tabActive: { borderBottomWidth: 2.5, borderBottomColor: Brand.trust },
    tabLabel: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted },
    tabLabelActive: { color: Brand.ink, fontFamily: BrandFonts.syneBold },

    statsBox: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      paddingVertical: 16,
      marginBottom: 8,
    },
    stat: { flex: 1, alignItems: 'flex-start', paddingHorizontal: 14 },
    statNumRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 2 },
    statNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink },
    statNumAccent: { color: Brand.trust },
    statLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginLeft: 20,
    },
    statDiv: { width: 1, height: 36, backgroundColor: Brand.border },

    badgesSection: {
      width: '100%',
      alignItems: 'center',
      marginBottom: 28,
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
    statSfIcon: { marginBottom: 4 },
    statSubLbl: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted, marginTop: 1, marginLeft: 20 },

    // Tab content
    tabContent: { width: '100%' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, textAlign: 'center', paddingVertical: 24 },

    // Feed tab
    chipScroll: {},
    chipRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 0 },
    chipRowCentered: { justifyContent: 'center' },
    chip: {
      width: 54,
      paddingVertical: 7,
      borderRadius: 12,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      alignItems: 'center',
      gap: 3,
    },
    chipIcon: { width: 17, height: 17 },
    chipText: { fontFamily: BrandFonts.syneBold, fontSize: 8.5, color: Brand.muted, textAlign: 'center' },
    chipTextActive: { color: '#fff' },
    feedSortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, marginBottom: 14 },
    feedSortLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginRight: 2 },
    feedSortBtn: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 14 },
    feedSortBtnActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    feedSortBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    feedSortBtnTextActive: { color: '#fff' },
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

    // Watchlist tab
    wlToggleRow: { flexDirection: 'row', backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 50, padding: 4, marginBottom: 14, gap: 4 },
    wlToggleBtn: { flex: 1, paddingVertical: 9, borderRadius: 50, alignItems: 'center' },
    wlToggleBtnActive: { backgroundColor: Brand.trust },
    wlToggleTxt: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    wlToggleTxtActive: { color: '#fff' },
    wlAddBtn: { backgroundColor: Brand.trust, borderRadius: 50, paddingVertical: 11, alignItems: 'center', marginBottom: 16 },
    wlAddBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#fff' },
    wlGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    wlGridItem: { width: '30.5%', alignItems: 'center' },
    wlPosterWrap: { width: '100%', position: 'relative', marginBottom: 7 },
    wlPoster: { width: '100%', aspectRatio: 2 / 3, borderRadius: 10, backgroundColor: Brand.border },
    wlPosterFallback: { alignItems: 'center', justifyContent: 'center', padding: 6 },
    wlPosterFallbackText: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: Brand.muted, textAlign: 'center' },
    wlAvatar: { position: 'absolute', bottom: -6, left: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: Brand.trust, borderWidth: 2, borderColor: Brand.card, alignItems: 'center', justifyContent: 'center' },
    wlAvatarText: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: '#fff' },
    wlLogBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.trust, borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12 },
    wlLogBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },
    unratedSection: { marginBottom: 20 },
    unratedHeader: { marginBottom: 12 },
    unratedHeaderTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, marginBottom: 2 },
    unratedHeaderSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted },
    unratedPosterWrap: { borderRadius: 12, borderWidth: 2, borderColor: Brand.trust },
    unratedPoster: { borderRadius: 10 },
    wlRateBtn: { backgroundColor: Brand.trust, borderRadius: 50, paddingVertical: 6, paddingHorizontal: 12, alignItems: 'center' },
    wlRateBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },

    // Collection tab
    collSearchRow: {
      flexDirection: 'row', alignItems: 'center',
      backgroundColor: Brand.card, borderRadius: 26,
      paddingLeft: 14, paddingRight: 6, marginBottom: 12,
      borderWidth: 1, borderColor: Brand.border,
    },
    collSearchPlaceholder: { flex: 1, paddingVertical: 12, fontSize: 13.5, fontFamily: BrandFonts.interRegular, color: Brand.muted },
    collScanBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.trust, alignItems: 'center', justifyContent: 'center' },
    collCatRow: { flexDirection: 'row', backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 14, padding: 4, marginBottom: 12, gap: 3 },
    collCatBtn: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
    collCatBtnActive: { backgroundColor: Brand.ink },
    collCatLabel: { fontFamily: BrandFonts.syneBold, fontSize: 8, color: Brand.muted, marginTop: 2 },
    collCatLabelActive: { color: '#fff' },
    collCatCount: { fontFamily: BrandFonts.interRegular, fontSize: 8, color: Brand.muted, marginTop: 1 },
    collCatCountActive: { color: 'rgba(255,255,255,0.75)' },
    collSortRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
    collSortLabel: { fontSize: 12, color: Brand.muted, fontFamily: BrandFonts.interRegular },
    collSortBtn: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 11 },
    collSortBtnActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    collSortBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted },
    collSortBtnTextActive: { color: '#fff' },
    collGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    collGridItem: { width: '31%' },
    collGridImg: { width: '100%', aspectRatio: 2 / 3, borderRadius: 8, backgroundColor: Brand.border },
    collGridImgPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: 6 },
    collGridImgPlaceholderText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textAlign: 'center' },
    collGridStars: { paddingTop: 4, paddingHorizontal: 2 },
    collGridStarText: { fontSize: 10, color: '#F59E0B', letterSpacing: 0.5 },

    // Streak card
    streakCard: {
      width: '100%',
      backgroundColor: Brand.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: 18,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
      marginBottom: 8,
    },
    streakLeft: { flex: 1, minWidth: 0 },
    streakFireCircle: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: '#FFF0E8',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 8,
    },
    streakFireEmoji: { fontSize: 15 },
    streakDays: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 3 },
    streakMsg: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginBottom: 14 },
    weekRow: { flexDirection: 'row', gap: 5 },
    weekDay: { alignItems: 'center', gap: 4 },
    weekDot: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: 'transparent',
    },
    weekDotDone: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    weekDotToday: { borderColor: Brand.trust, borderWidth: 2, backgroundColor: 'transparent' },
    weekLabel: { fontFamily: BrandFonts.interMedium, fontSize: 9, color: Brand.muted },
    streakDivider: { width: 1, height: '80%', backgroundColor: Brand.border, marginHorizontal: 16 },
    streakRight: { alignItems: 'center', justifyContent: 'center', minWidth: 70 },
    longestLabel: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, textAlign: 'center', marginBottom: 2 },
    longestDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, lineHeight: 26 },
    longestUnit: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    // Stats card (top categories)
    statsCard: {
      width: '100%',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      padding: 12,
      marginBottom: 8,
    },
    statsCardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, flex: 1 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7 },
    catIconBox: { width: 26, height: 26, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
    catLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.ink, flex: 1 },
    catBarBg: { width: 40, height: 4, backgroundColor: Brand.border, borderRadius: 2, overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 2 },
    catCount: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, width: 20, textAlign: 'right' },

    // Goal row (side-by-side cards)
    goalRow: { flexDirection: 'row', gap: 8, marginBottom: 0 },
    goalCard: { flex: 1, marginBottom: 0 },
    goalNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.trust, lineHeight: 20, marginTop: 4 },
    goalTarget: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    goalSub: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted, marginTop: 2, marginBottom: 6 },
    goalBarRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 2, marginBottom: 4 },
    goalBlock: { flex: 1, height: 6, borderRadius: 2, backgroundColor: Brand.border },
    goalBlockFilled: { backgroundColor: Brand.trust },
    goalFooter: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted },

    // Currently active
    activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
    activeRowBorder: { borderTopWidth: 1, borderTopColor: Brand.border },
    activeIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    activeInfo: { flex: 1, minWidth: 0 },
    activeLabel: { fontFamily: BrandFonts.syneExtraBold, fontSize: 11, color: Brand.ink },
    activeSub: { fontFamily: BrandFonts.interRegular, fontSize: 10 },
    activeChevron: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.muted },

    // Card header
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
    cardHeaderTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14, color: Brand.ink },
    cardHeaderSub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 1 },

    // MyTaste Top 4 header
    myTasteHeader: { alignItems: 'center', marginBottom: 14 },
    myTasteTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    myTasteSub: { fontFamily: BrandFonts.interRegular, fontStyle: 'italic', fontSize: 12, color: Brand.muted, marginTop: 2 },
    myTasteViewAll: { position: 'absolute', right: 0, top: 4 },
    myTasteViewAllText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.trust },

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
    genreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 10 },
    genreRankWrap: { width: 26, paddingTop: 1 },
    genreRank: { fontFamily: BrandFonts.syneExtraBold, fontSize: 11 },
    genreInfo: { flex: 1, minWidth: 0 },
    genreNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 },
    genreName: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.ink, flex: 1 },
    genreBarTrack: { height: 4, borderRadius: 2, backgroundColor: Brand.border, overflow: 'hidden' },
    genreBarFill: { height: '100%', borderRadius: 2 },
    genreCount: { fontFamily: BrandFonts.syneBold, fontSize: 11 },

    // Recently logged (stats tab)
    recentChipRow: { flexWrap: 'wrap', marginBottom: 12 },
    recentChip: {
      paddingVertical: 4, paddingHorizontal: 9, borderRadius: 20,
      backgroundColor: Brand.paper, borderWidth: 1, borderColor: Brand.border,
    },
    recentChipActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    recentChipText: { fontFamily: BrandFonts.interMedium, fontSize: 11.5, color: Brand.muted },
    recentChipTextActive: { color: Brand.paper },
    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
    recentThumb: { width: 44, height: 44, borderRadius: 7 },
    recentThumbFallback: { backgroundColor: Brand.tlight },
    recentTitle: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },

    // Inline rate-and-log modal
    rateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
    rateSheet: {
      backgroundColor: Brand.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      gap: 16,
      paddingBottom: 40,
    },
    rateItemRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
    ratePoster: { width: 52, height: 72, borderRadius: 10, backgroundColor: Brand.border },
    rateTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink, lineHeight: 21 },
    rateSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    rateLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    rateNote: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.card,
      minHeight: 52,
      textAlignVertical: 'top',
    },
    rateLogBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    rateLogBtnDisabled: { opacity: 0.45 },
    rateLogBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
