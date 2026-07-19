import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import type { LibraryItem } from '@/features/library/api';
import { computeProfileStats } from '@/features/library/stats';
import { useUploadBanner, type Profile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export type ProfileCardBadge = Pick<BadgeDef, 'key' | 'name' | 'icon' | 'tier'>;

// Online-status green stays fixed regardless of theme, same as the app's
// other status colors (e.g. rating stars) — it signals state, not brand.
const ONLINE_COLOR = '#3DDC84';

const CATEGORY_TABS: { type: EntryType; icon: string; label: string; barColor: string }[] = [
  { type: 'watch', icon: 'movieclapper', label: 'TV & Film', barColor: '#FF6B6B' },
  { type: 'read', icon: 'book.closed', label: 'Books', barColor: '#5FA8FF' },
  { type: 'play', icon: 'gamecontroller', label: 'Games', barColor: '#5FD9FF' },
  { type: 'listen', icon: 'headphones', label: 'Music', barColor: '#9B95AC' },
  { type: 'podcast', icon: 'mic', label: 'Podcasts', barColor: '#C084FC' },
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
  onStatsPress,
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
  onStatsPress?: () => void;
  /** Friend's profile only — "+ Follow" / "Request to Follow" / "Following". */
  friendAction?: ProfileCardFriendAction;
}) {
  const isOwnProfile = !!onEditPress;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const stats = useMemo(() => computeProfileStats(library), [library]);
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

  const counts: Record<EntryType, number> = { watch: 0, read: 0, play: 0, listen: 0, podcast: 0 };
  library.forEach((item) => {
    counts[item.type] += 1;
  });
  const max = Math.max(1, ...Object.values(counts));

  const defaultTab = CATEGORY_TABS.reduce((best, tab) => (counts[tab.type] > counts[best.type] ? tab : best))
    .type;
  const [activeTab, setActiveTab] = useState<EntryType>(defaultTab);

  const recentForTab = library
    .filter((item) => item.type === activeTab)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 4);

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

        <View style={styles.tabRow}>
        {CATEGORY_TABS.map((tab) => {
          const active = tab.type === activeTab;
          return (
            <Pressable key={tab.type} style={styles.tab} onPress={() => setActiveTab(tab.type)}>
              <SymbolView
                name={tab.icon as any}
                size={24}
                tintColor={active ? Brand.trust : Brand.muted}
                type="monochrome"
                style={active ? styles.tabIconGlow : undefined}
              />
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab.label}</Text>
              {active ? <View style={styles.tabUnderline} /> : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.statsBox}>
        <Pressable style={styles.stat} onPress={onLoggedPress} disabled={!onLoggedPress} hitSlop={4}>
          <Text style={[styles.statNum, onLoggedPress && styles.statNumAccent]}>{library.length}</Text>
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

      {isOwnProfile ? (
        <Pressable style={styles.streakCard} onPress={onStatsPress}>
          <Text style={styles.streakIcon}>🔥</Text>
          <View style={styles.streakInfo}>
            <Text style={styles.streakDays}>{stats.streakDays} {stats.streakDays === 1 ? 'day' : 'days'}</Text>
            <Text style={styles.streakLbl}>LOGGING STREAK</Text>
          </View>
          <Text style={styles.streakChevron}>›</Text>
        </Pressable>
      ) : null}

      <View style={styles.splitRow}>
        <View style={styles.splitCol}>
          <Text style={styles.secLbl}>Recently Logged</Text>
          {recentForTab.length ? (
            recentForTab.map((item) => (
              <View key={item.id} style={styles.recentRow}>
                {item.poster ? (
                  <Image source={{ uri: item.poster }} style={styles.recentThumb} />
                ) : (
                  <View style={[styles.recentThumb, styles.recentThumbFallback]} />
                )}
                <View style={styles.recentInfo}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {item.title}
                  </Text>
                  {item.date ? <Text style={styles.recentDate}>{item.date}</Text> : null}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.recentEmpty}>Nothing logged here yet.</Text>
          )}
        </View>

        <View style={styles.splitDiv} />

        <View style={[styles.splitCol, styles.splitColRight]}>
          <Text style={styles.secLbl}>Top Categories</Text>
          <View style={styles.bars}>
            {CATEGORY_TABS.map((tab) => {
              const pct = Math.round((counts[tab.type] / max) * 100);
              return (
                <View key={tab.type} style={styles.barRow}>
                  <Text style={styles.barLbl} numberOfLines={1}>
                    {tab.label === 'TV & Film' ? 'TV' : tab.label}
                  </Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: tab.barColor }]} />
                  </View>
                  <Text style={styles.barCount}>{counts[tab.type]}</Text>
                </View>
              );
            })}
          </View>
        </View>
        </View>
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

    streakCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#FFF8EE',
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginTop: 10,
      gap: 10,
      borderWidth: 1,
      borderColor: '#F4D08A',
    },
    streakIcon: { fontSize: 24 },
    streakInfo: { flex: 1 },
    streakDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: '#F4A340' },
    streakLbl: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: '#C87941', letterSpacing: 0.8, marginTop: 1 },
    streakChevron: { fontFamily: BrandFonts.syneBold, fontSize: 20, color: '#F4A340' },

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

    splitRow: { flexDirection: 'row', width: '100%', gap: 16 },
    splitCol: { flex: 1, minWidth: 0 },
    splitColRight: { flex: 1, minWidth: 0 },
    splitDiv: { width: 1, backgroundColor: Brand.border, alignSelf: 'stretch' },
    secLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12.5,
      color: Brand.ink,
      marginBottom: 12,
    },

    recentRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 12 },
    recentThumb: { width: 40, height: 40, borderRadius: 8 },
    recentThumbFallback: { backgroundColor: Brand.tlight },
    recentInfo: { flex: 1, minWidth: 0 },
    recentTitle: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.ink },
    recentDate: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 1 },
    recentEmpty: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    bars: { gap: 12 },
    barRow: { gap: 4 },
    barLbl: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.muted },
    barTrack: { height: 6, backgroundColor: Brand.tlight, borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    barCount: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, alignSelf: 'flex-end' },
  });
}
