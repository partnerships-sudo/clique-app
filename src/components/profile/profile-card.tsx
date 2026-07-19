import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import { useCollectionItems, useRemoveFromCollection, type CollectionItem } from '@/features/collection/api';
import { useMyTasteTop4 } from '@/features/follows/api';
import { useMoveToLibrary, type LibraryItem } from '@/features/library/api';
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
  { type: 'read' as EntryType, label: 'Books', sf: 'book.open.fill', color: '#5FA8FF', bg: '#5FA8FF18' },
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

  // Collection tab state
  type CollectionView = 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
  type CollectionSort = 'recent' | 'rating' | 'alpha';
  const [collectionView, setCollectionView] = useState<CollectionView>('watch');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');
  const { items: collectionItems, isLoading: isCollectionLoading } = useCollectionItems();
  const removeFromCollection = useRemoveFromCollection();
  const hasAutoSelectedCollView = useRef(false);
  useEffect(() => {
    if (isCollectionLoading || hasAutoSelectedCollView.current) return;
    hasAutoSelectedCollView.current = true;
    const order: CollectionView[] = ['watch', 'read', 'tv', 'listen', 'play', 'podcast'];
    if (collectionItems.some((i) => i.type === collectionView)) return;
    const first = order.find((v) => collectionItems.some((i) => i.type === v));
    if (first) setCollectionView(first);
  }, [isCollectionLoading, collectionItems]);

  const collectionFiltered = useMemo(() => {
    const items = collectionItems.filter((i: CollectionItem) => i.type === collectionView);
    const sorted = [...items];
    if (collectionSort === 'recent') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (collectionSort === 'rating') sorted.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
    else if (collectionSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [collectionItems, collectionView, collectionSort]);

  const logged = library.filter((i) => i.status !== 'watchlist');
  const watchlist = library.filter((i) => i.status === 'watchlist');

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

  // Top genres: parse sub field using · separator (middle dot, not bullet)
  // Games: "Genre · Year" — genre is FIRST segment
  // Books: "Author · Year · Publisher" — publisher is LAST segment
  // TV/Movies: "TV Series · Network · Year" — last segment is year (skipped)
  const genreCounts = new Map<string, number>();
  for (const item of logged) {
    if (!item.sub) continue;
    const parts = item.sub.split('·').map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    let genre: string | null = null;
    if (item.type === 'play') {
      // Games store genre as first segment
      const first = parts[0];
      if (first && first !== 'Game' && !first.match(/^\d{4}$/)) genre = first;
    } else {
      // Books/others: publisher or genre is last segment
      const last = parts[parts.length - 1];
      if (last && !last.match(/^\d{4}$/) && last !== 'Podcast' && last !== 'Album') genre = last;
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
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll} contentContainerStyle={styles.chipRow}>
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
            </ScrollView>

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
                <LibCard key={item.id} item={item} />
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
                    <View key={item.id} style={styles.wlGridItem}>
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
                      <Pressable style={styles.wlLogBtn} onPress={() => moveToLibrary.mutate(item)}>
                        <SymbolView name="checkmark" size={10} tintColor="#fff" style={{ width: 11, height: 11 }} />
                        <Text style={styles.wlLogBtnText}>Log it</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        ) : null}

        {/* COLLECTION TAB */}
        {profileTab === 'collection' ? (
          <View style={styles.tabContent}>
            {/* Search bar */}
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

            {/* Category chips */}
            <View style={styles.collCatRow}>
              {([
                { view: 'read',    sf: 'books.vertical', label: 'Books'    },
                { view: 'watch',   sf: 'film',           label: 'Movies'   },
                { view: 'tv',      sf: 'tv',             label: 'TV'       },
                { view: 'listen',  sf: 'music.note',     label: 'Music'    },
                { view: 'play',    sf: 'gamecontroller', label: 'Games'    },
                { view: 'podcast', sf: 'mic',            label: 'Podcasts' },
              ] as const).map(({ view, sf, label }) => {
                const count = collectionItems.filter((i: CollectionItem) => i.type === view).length;
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
              })}
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
                      onPress={() => router.push({ pathname: '/collection-item-detail-modal', params: { id: item.id, title: item.title, sub: item.sub ?? undefined, poster: item.poster ?? undefined, type: item.type, format: item.format ?? undefined, userRating: item.user_rating?.toString() ?? undefined } })}>
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
                <SymbolView name="archivebox.fill" size={22} tintColor={Brand.muted} type="monochrome" style={styles.statSfIcon} />
                <Text style={[styles.statNum, styles.statNumAccent]}>{logged.length}</Text>
                <Text style={styles.statLbl}>LOGGED</Text>
                <Text style={styles.statSubLbl}>items logged</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowersPress} disabled={!onFollowersPress} hitSlop={4}>
                <SymbolView name="person.2.fill" size={22} tintColor={Brand.muted} type="monochrome" style={styles.statSfIcon} />
                <Text style={[styles.statNum, styles.statNumAccent]}>{followersCount}</Text>
                <Text style={styles.statLbl}>FOLLOWERS</Text>
                <Text style={styles.statSubLbl}>people follow you</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowingPress} disabled={!onFollowingPress} hitSlop={4}>
                <SymbolView name="person.fill" size={22} tintColor={Brand.muted} type="monochrome" style={styles.statSfIcon} />
                <Text style={[styles.statNum, styles.statNumAccent]}>{followingCount}</Text>
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
                        <SymbolView name={cat.sf as any} size={18} tintColor={cat.color} type="monochrome" />
                      </View>
                      <View style={styles.activeInfo}>
                        <Text style={styles.activeLabel}>{cat.label}</Text>
                        <Text style={[styles.activeSub, { color: cat.color }]}>{cat.sub}</Text>
                      </View>
                      <SymbolView name="chevron.right" size={12} tintColor={Brand.muted} type="monochrome" />
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
                      <SymbolView name={cat.sf as any} size={18} tintColor={cat.color} type="monochrome" />
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
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 },
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
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      paddingVertical: 14,
      marginBottom: 16,
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
    statSfIcon: { marginBottom: 4 },
    statSubLbl: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted, marginTop: 1, textAlign: 'center' },

    // Tab content
    tabContent: { width: '100%' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, textAlign: 'center', paddingVertical: 24 },

    // Feed tab
    chipScroll: { marginBottom: 12 },
    chipRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 0 },
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
    feedSortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
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
      marginBottom: 16,
    },
    streakLeft: { flex: 1, minWidth: 0 },
    streakFireCircle: {
      width: 44, height: 44, borderRadius: 22,
      backgroundColor: '#FFF0E8',
      alignItems: 'center', justifyContent: 'center',
      marginBottom: 10,
    },
    streakFireEmoji: { fontSize: 22 },
    streakDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, marginBottom: 3 },
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
    longestDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 36, color: Brand.ink, lineHeight: 40 },
    longestUnit: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    // Stats card (top categories)
    statsCard: {
      width: '100%',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      padding: 16,
      marginBottom: 16,
    },
    statsCardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 },
    catRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    catIconBox: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
    catLabel: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink, flex: 1 },
    catBarBg: { width: 52, height: 4, backgroundColor: Brand.border, borderRadius: 2, overflow: 'hidden' },
    catBarFill: { height: '100%', borderRadius: 2 },
    catCount: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, width: 20, textAlign: 'right' },

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
    activeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    activeInfo: { flex: 1, minWidth: 0 },
    activeLabel: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14, color: Brand.ink },
    activeSub: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
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
    genreRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 14 },
    genreRankWrap: { width: 26, paddingTop: 1 },
    genreRank: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14 },
    genreInfo: { flex: 1, minWidth: 0 },
    genreNameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 },
    genreName: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, flex: 1 },
    genreBarTrack: { height: 5, borderRadius: 3, backgroundColor: Brand.border, overflow: 'hidden' },
    genreBarFill: { height: '100%', borderRadius: 3 },
    genreCount: { fontFamily: BrandFonts.syneBold, fontSize: 13 },

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
