import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActionSheetIOS, ActivityIndicator, Alert, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { VerifiedBadge } from '@/components/verified-badge';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import { useRateLibraryItem, type LibraryItem } from '@/features/library/api';
import { isOnline } from '@/features/presence/api';
import { type Profile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { ProfileCollectionTab } from './tabs/ProfileCollectionTab';
import { ProfileFeedTab } from './tabs/ProfileFeedTab';
import { ProfileStatsTab } from './tabs/ProfileStatsTab';
import { ProfileWatchlistTab } from './tabs/ProfileWatchlistTab';
import { createStyles } from './profile-styles';

export type ProfileCardBadge = Pick<BadgeDef, 'key' | 'name' | 'icon' | 'tier'>;

export interface ProfileCardFriendAction {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'muted';
}

type ProfileTab = 'feed' | 'watchlist' | 'collection' | 'stats';

const PROFILE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'feed', label: 'Feed' },
  { key: 'watchlist', label: 'Lists' },
  { key: 'collection', label: 'Collection' },
  { key: 'stats', label: 'Stats' },
];

export function ProfileCard({
  profile,
  library,
  initialTab,
  onTabChange,
  followersCount,
  followingCount,
  onLoggedPress,
  onThisYearPress,
  onFollowersPress,
  onFollowingPress,
  onEditPress,
  onCollectionPress: _onCollectionPress,
  collectionLabel: _collectionLabel = '📦 My Collection',
  featuredBadges = [],
  earnedBadgeCount: _earnedBadgeCount,
  onOpenAchievements,
  onShare,
  onMessage,
  friendAction,
  closeFriendAction,
  mutualFollowers,
}: {
  profile: Profile | null | undefined;
  library: LibraryItem[];
  initialTab?: string;
  followersCount: number;
  followingCount: number;
  onLoggedPress?: () => void;
  onThisYearPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onEditPress?: () => void;
  onTabChange?: (tab: string) => void;
  onCollectionPress?: () => void;
  collectionLabel?: string;
  featuredBadges?: ProfileCardBadge[];
  earnedBadgeCount?: number;
  onOpenAchievements?: () => void;
  onShare?: () => void;
  onMessage?: () => void;
  friendAction?: ProfileCardFriendAction;
  closeFriendAction?: { isCloseFriend: boolean; onPress: () => void };
  mutualFollowers?: Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }>;
}) {
  const isOwnProfile = !!onEditPress;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile?.full_name || profile?.username || 'Someone';
  const rateItem = useRateLibraryItem();

  const validInitial = initialTab && PROFILE_TABS.some((t) => t.key === initialTab) ? (initialTab as ProfileTab) : 'feed';
  const [profileTab, setProfileTab] = useState<ProfileTab>(validInitial);

  // Sync when parent updates initialTab (e.g. navigating back from a list)
  const prevInitialTab = useRef(validInitial);
  if (initialTab && initialTab !== prevInitialTab.current && PROFILE_TABS.some((t) => t.key === initialTab)) {
    prevInitialTab.current = initialTab as ProfileTab;
    setProfileTab(initialTab as ProfileTab);
  }
  const [ratingItem, setRatingItem] = useState<LibraryItem | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState('');
  const [avatarZoom, setAvatarZoom] = useState(false);

  const logged = library.filter((i) => i.status !== 'watchlist');
  const watchlist = library.filter((i) => i.status === 'watchlist');
  const unratedLogged = logged.filter((i) => !i.rating);
  const active = logged.filter((i) => i.status !== 'finished');

  function openRating(item: LibraryItem) {
    setRatingItem(item);
    setRatingValue(null);
    setRatingNote('');
  }

  return (
    <View style={styles.card}>
      <View style={styles.contentPad}>
        {/* Header: avatar left, name/actions right */}
        <View style={styles.headerRow}>
          <Pressable style={styles.avWrap} onPress={() => profile?.avatar_url && setAvatarZoom(true)} hitSlop={4} accessibilityRole="button" accessibilityLabel="View profile photo">
            <View style={styles.avRing}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avImg} cachePolicy="memory-disk" recyclingKey={profile.avatar_url} />
              ) : (
                <View style={styles.avFallback}>
                  <Text style={styles.avFallbackText}>{name[0]?.toUpperCase() ?? '?'}</Text>
                </View>
              )}
            </View>
            {isOnline(profile?.last_seen_at) && <View style={styles.onlineDot} />}
          </Pressable>

          <View style={styles.headerInfo}>
            <View style={styles.nameRow}>
              <Text style={styles.handle} numberOfLines={1}>@{profile?.username ?? name}</Text>
              {profile?.verified_tier ? <View style={{ marginTop: 2 }}><VerifiedBadge tier={profile.verified_tier} size={20} /></View> : null}
              {friendAction ? (
                <Pressable
                  onPress={friendAction.onPress}
                  disabled={!friendAction.onPress}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={friendAction.label}
                  style={[styles.friendActionBtn, styles.friendActionBtnInline, friendAction.variant === 'muted' && styles.friendActionBtnMuted]}>
                  <Text style={[styles.friendActionBtnText, styles.friendActionBtnTextInline, friendAction.variant === 'muted' && styles.friendActionBtnTextMuted]}>
                    {friendAction.label}
                  </Text>
                </Pressable>
              ) : null}
              {onEditPress ? (
                <Pressable
                  hitSlop={12}
                  style={{ marginLeft: 'auto' }}
                  accessibilityRole="button"
                  accessibilityLabel="Profile options"
                  onPress={() => {
                    if (Platform.OS === 'ios') {
                      ActionSheetIOS.showActionSheetWithOptions(
                        { options: ['Cancel', 'Edit Profile', 'Settings'], cancelButtonIndex: 0 },
                        (i) => { if (i === 1) onEditPress(); else if (i === 2) router.push('/settings'); },
                      );
                    } else {
                      Alert.alert('Profile', undefined, [
                        { text: 'Edit Profile', onPress: onEditPress },
                        { text: 'Settings', onPress: () => router.push('/settings') },
                        { text: 'Cancel', style: 'cancel' },
                      ]);
                    }
                  }}>
                  <SymbolView name="gearshape" size={22} tintColor={Brand.muted} type="monochrome" />
                </Pressable>
              ) : null}
            </View>
            {profile?.full_name ? (
              <View style={styles.handleRow}>
                <Text style={styles.name} numberOfLines={1}>{profile.full_name}</Text>
                {onShare ? (
                  <Pressable onPress={onShare} hitSlop={10} style={styles.iconBtnSmall} accessibilityRole="button" accessibilityLabel="Share profile">
                    <SymbolView name="square.and.arrow.up" size={11} tintColor={Brand.muted} type="monochrome" />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {(closeFriendAction || onMessage) ? (
              <View style={styles.actionRow}>
                {closeFriendAction ? (
                  <Pressable
                    onPress={closeFriendAction.onPress}
                    hitSlop={16}
                    accessibilityRole="button"
                    accessibilityLabel={closeFriendAction.isCloseFriend ? 'Remove from close friends' : 'Add as close friend'}
                    style={[styles.friendActionBtn, closeFriendAction.isCloseFriend ? styles.closeFriendBtnActive : styles.friendActionBtnMuted]}>
                    <Text style={[styles.friendActionBtnText, closeFriendAction.isCloseFriend ? styles.closeFriendBtnTextActive : styles.friendActionBtnTextMuted]}>
                      {closeFriendAction.isCloseFriend ? '💚 Close Friend' : '+ Close Friend'}
                    </Text>
                  </Pressable>
                ) : null}
                {onMessage ? (
                  <Pressable onPress={onMessage} hitSlop={16} style={styles.msgBtn} accessibilityRole="button" accessibilityLabel="Send message">
                    <Text style={styles.msgBtnText}>Message</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.followCountRow}>
          <Pressable onPress={onFollowingPress} hitSlop={8} style={styles.followCountBtn} accessibilityRole="button" accessibilityLabel={`${followingCount} following`}>
            <Text style={styles.followCountNum}>{followingCount}</Text>
            <Text style={styles.followCountLabel}>Following</Text>
          </Pressable>
          <Pressable onPress={onFollowersPress} hitSlop={8} style={styles.followCountBtn} accessibilityRole="button" accessibilityLabel={`${followersCount} followers`}>
            <Text style={styles.followCountNum}>{followersCount}</Text>
            <Text style={styles.followCountLabel}>Followers</Text>
          </Pressable>
        </View>

      </View>

      {/* Tab bar — outside contentPad so it spans full width */}
      <View style={styles.tabRow}>
        {PROFILE_TABS.map((tab) => (
          <Pressable key={tab.key} style={[styles.tab, profileTab === tab.key && styles.tabActive]} accessibilityRole="button" accessibilityLabel={tab.label} onPress={() => { setProfileTab(tab.key); onTabChange?.(tab.key); }}>
            <Text style={[styles.tabLabel, profileTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Tab content — full width, each tab handles its own internal padding */}
      <View style={styles.tabContentOuter}>
        {profileTab === 'feed' ? (
          <ProfileFeedTab userId={profile?.id} />
        ) : profileTab === 'watchlist' ? (
          <ProfileWatchlistTab
            watchlist={watchlist}
            isOwnProfile={isOwnProfile}
            profileUserId={profile?.id}
            onOpenRating={openRating}
          />
        ) : profileTab === 'collection' ? (
          <ProfileCollectionTab
            isOwnProfile={isOwnProfile}
            profileId={profile?.id}
          />
        ) : (
          <ProfileStatsTab
            logged={logged}
            followersCount={followersCount}
            followingCount={followingCount}
            userId={profile?.id}
            onLoggedPress={onLoggedPress}
            onThisYearPress={onThisYearPress}
            onFollowersPress={onFollowersPress}
            onFollowingPress={onFollowingPress}
            featuredBadges={featuredBadges}
            onOpenAchievements={onOpenAchievements}
            isOwnProfile={isOwnProfile}
          />
        )}
      </View>

      {/* Rate-and-log sheet */}
      {/* Avatar zoom */}
      <Modal visible={avatarZoom} transparent animationType="fade" onRequestClose={() => setAvatarZoom(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setAvatarZoom(false)}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url }} style={{ width: 280, height: 280, borderRadius: 140 }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={profile.avatar_url} />
          ) : null}
        </Pressable>
      </Modal>

      <Modal visible={!!ratingItem} transparent animationType="slide" onRequestClose={() => setRatingItem(null)}>
        <Pressable style={styles.rateOverlay} onPress={() => setRatingItem(null)} />
        <View style={styles.rateSheet}>
          {ratingItem ? (
            <>
              <View style={styles.rateItemRow}>
                {ratingItem.poster ? (
                  <Image source={{ uri: ratingItem.poster }} style={styles.ratePoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={ratingItem.poster} />
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
                  try {
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
                  } catch {
                    Alert.alert('Could not save rating', 'Please check your connection and try again.');
                  }
                }}>
                {rateItem.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.rateLogBtnText}>
                    {unratedLogged.some((i) => i.id === ratingItem?.id) ? 'Add to Collection →' : 'Log it →'}
                  </Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}
