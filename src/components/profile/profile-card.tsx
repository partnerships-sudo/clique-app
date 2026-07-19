import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
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

        <View style={styles.nameRow}>
          <Text style={styles.name}>{name}</Text>
          {onShare ? (
            <Pressable onPress={onShare} hitSlop={10} style={styles.shareIconBtn}>
              <SymbolView name="square.and.arrow.up" size={15} tintColor={Brand.trust} type="monochrome" />
            </Pressable>
          ) : null}
        </View>
        {profile?.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
        <View style={styles.linkRow}>
          {onEditPress ? (
            <Pressable onPress={onEditPress} hitSlop={8}>
              <Text style={styles.editLinkText}>✏️ Edit Profile</Text>
            </Pressable>
          ) : null}
          {onCollectionPress ? (
            <Pressable onPress={onCollectionPress} hitSlop={8}>
              <Text style={styles.editLinkText}>{collectionLabel}</Text>
            </Pressable>
          ) : null}
          {friendAction ? (
            <Pressable
              onPress={friendAction.onPress}
              disabled={!friendAction.onPress}
              hitSlop={8}
              style={[styles.friendActionBtn, friendAction.variant === 'muted' && styles.friendActionBtnMuted]}>
              <Text
                style={[
                  styles.friendActionBtnText,
                  friendAction.variant === 'muted' && styles.friendActionBtnTextMuted,
                ]}>
                {friendAction.label}
              </Text>
            </Pressable>
          ) : null}
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
            const active = tab.key === profileTab;
            return (
              <Pressable key={tab.key} style={styles.tab} onPress={() => setProfileTab(tab.key)}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
                {active ? <View style={styles.tabUnderline} /> : null}
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
                <Text style={[styles.statNum, onLoggedPress && styles.statNumAccent]}>{logged.length}</Text>
                <Text style={styles.statLbl}>Logged</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowersPress} disabled={!onFollowersPress} hitSlop={4}>
                <Text style={[styles.statNum, styles.statNumAccent]}>{followersCount}</Text>
                <Text style={styles.statLbl}>Followers</Text>
              </Pressable>
              <View style={styles.statDiv} />
              <Pressable style={styles.stat} onPress={onFollowingPress} disabled={!onFollowingPress} hitSlop={4}>
                <Text style={[styles.statNum, styles.statNumAccent]}>{followingCount}</Text>
                <Text style={styles.statLbl}>Following</Text>
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
                      <View style={[styles.weekDot, d.done && styles.weekDotDone]}>
                        {d.done ? <Text style={styles.weekCheck}>✓</Text> : null}
                      </View>
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

            {/* Top Categories */}
            <View style={styles.statsCard}>
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
      alignItems: 'center',
    },
    avWrap: { marginTop: -78, marginBottom: 6 },
    avRing: {
      width: 86,
      height: 86,
      borderRadius: 43,
      borderWidth: 2,
      borderColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: Brand.trust,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.7,
      shadowRadius: 11,
      elevation: 10,
    },
    avImg: { width: 79, height: 79, borderRadius: 40 },
    avFallback: {
      width: 79,
      height: 79,
      borderRadius: 40,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avFallbackText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 29, color: Brand.ink },
    onlineDot: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: ONLINE_COLOR,
      borderWidth: 2,
      borderColor: Brand.card,
    },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 26, color: Brand.ink },
    shareIconBtn: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    handle: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: Brand.muted, marginTop: 2 },
    linkRow: { flexDirection: 'row', gap: 16, marginTop: 6, marginBottom: 16, alignItems: 'center' },
    friendActionBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 14,
    },
    friendActionBtnMuted: { backgroundColor: Brand.tlight, borderWidth: 1, borderColor: Brand.border },
    friendActionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: '#fff' },
    friendActionBtnTextMuted: { color: Brand.muted },
    editLinkText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },

    tabRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginBottom: 22 },
    tab: { alignItems: 'center', gap: 6, flex: 1 },
    tabIconGlow: {
      shadowColor: Brand.trust,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 10,
    },
    tabLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.muted },
    tabLabelActive: { color: Brand.ink, fontFamily: BrandFonts.syneBold },
    tabUnderline: { width: 24, height: 2.5, borderRadius: 2, backgroundColor: Brand.trust, marginTop: 2 },

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
  });
}
