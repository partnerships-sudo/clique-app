import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, Text, TextInput, View } from 'react-native';

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
  { key: 'watchlist', label: 'Watchlist' },
  { key: 'collection', label: 'Collection' },
  { key: 'stats', label: 'Stats' },
];

export function ProfileCard({
  profile,
  library,
  followersCount,
  followingCount,
  onLoggedPress,
  onFollowersPress,
  onFollowingPress,
  onEditPress,
  onCollectionPress: _onCollectionPress,
  collectionLabel: _collectionLabel = '📦 My Collection',
  featuredBadges = [],
  earnedBadgeCount: _earnedBadgeCount,
  onOpenAchievements,
  onShare,
  friendAction,
  closeFriendAction,
  mutualFollowers,
}: {
  profile: Profile | null | undefined;
  library: LibraryItem[];
  followersCount: number;
  followingCount: number;
  onLoggedPress?: () => void;
  onFollowersPress?: () => void;
  onFollowingPress?: () => void;
  onEditPress?: () => void;
  onCollectionPress?: () => void;
  collectionLabel?: string;
  featuredBadges?: ProfileCardBadge[];
  earnedBadgeCount?: number;
  onOpenAchievements?: () => void;
  onShare?: () => void;
  friendAction?: ProfileCardFriendAction;
  closeFriendAction?: { isCloseFriend: boolean; onPress: () => void };
  mutualFollowers?: Array<{ id: string; full_name: string | null; username: string | null; avatar_url: string | null }>;
}) {
  const isOwnProfile = !!onEditPress;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile?.full_name || profile?.username || 'Someone';
  const rateItem = useRateLibraryItem();

  const [profileTab, setProfileTab] = useState<ProfileTab>('feed');
  const [ratingItem, setRatingItem] = useState<LibraryItem | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState('');

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
              {profile?.verified_tier ? <VerifiedBadge tier={profile.verified_tier} size={16} /> : null}
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
                <Pressable
                  onPress={closeFriendAction.onPress}
                  hitSlop={8}
                  style={[styles.friendActionBtn, closeFriendAction.isCloseFriend ? styles.closeFriendBtnActive : styles.friendActionBtnMuted]}>
                  <Text style={[styles.friendActionBtnText, closeFriendAction.isCloseFriend ? styles.closeFriendBtnTextActive : styles.friendActionBtnTextMuted]}>
                    {closeFriendAction.isCloseFriend ? '💚 Close Friend' : '+ Close Friend'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            {profile?.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
            {mutualFollowers && mutualFollowers.length > 0 ? (
              <Text style={styles.mutualFollowers} numberOfLines={2}>
                {(() => {
                  const first = mutualFollowers[0].full_name || mutualFollowers[0].username || 'someone';
                  if (mutualFollowers.length === 1) return `Followed by ${first}`;
                  if (mutualFollowers.length === 2) {
                    const second = mutualFollowers[1].full_name || mutualFollowers[1].username || 'someone';
                    return `Followed by ${first} and ${second}`;
                  }
                  return `Followed by ${first} and ${mutualFollowers.length - 1} others you follow`;
                })()}
              </Text>
            ) : null}
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

        {/* Tab bar */}
        <View style={styles.tabRow}>
          {PROFILE_TABS.map((tab) => (
            <Pressable key={tab.key} style={[styles.tab, profileTab === tab.key && styles.tabActive]} onPress={() => setProfileTab(tab.key)}>
              <Text style={[styles.tabLabel, profileTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Tab content — only the active tab is mounted, so its hooks only fire on demand */}
        {profileTab === 'feed' ? (
          <ProfileFeedTab logged={logged} />
        ) : profileTab === 'watchlist' ? (
          <ProfileWatchlistTab
            watchlist={watchlist}
            unratedLogged={unratedLogged}
            isOwnProfile={isOwnProfile}
            onOpenRating={openRating}
          />
        ) : profileTab === 'collection' ? (
          <ProfileCollectionTab isOwnProfile={isOwnProfile} profileId={profile?.id} />
        ) : (
          <ProfileStatsTab
            logged={logged}
            followersCount={followersCount}
            followingCount={followingCount}
            onLoggedPress={onLoggedPress}
            onFollowersPress={onFollowersPress}
            onFollowingPress={onFollowingPress}
          />
        )}
      </View>

      {/* Rate-and-log sheet */}
      <Modal visible={!!ratingItem} transparent animationType="slide" onRequestClose={() => setRatingItem(null)}>
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
