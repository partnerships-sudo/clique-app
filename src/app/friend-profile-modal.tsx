import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileCard, type ProfileCardFriendAction } from '@/components/profile/profile-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBadgesForUser } from '@/features/badges/api';
import { useFollow, useFollowStatus, useFollowersCount, useFollowingCount, useUnfollow } from '@/features/follows/api';
import { useLibraryItemsByUser } from '@/features/library/api';
import { useProfileById } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function FriendProfileModal() {
  const params = useLocalSearchParams<{ userId: string }>();
  const { user } = useSession();

  // A shared profile link points here with the owner's own id — if they (or
  // a device already signed in as them) opens it, send them to their own
  // profile screen instead of a friend-request UI pointed at themselves.
  useEffect(() => {
    if (user && params.userId && user.id === params.userId) {
      router.replace('/profile');
    }
  }, [user, params.userId]);

  const { data: profile, isLoading, refetch: refetchProfile } = useProfileById(params.userId);
  const { logged, isLoading: libraryLoading, refetch: refetchLibrary } = useLibraryItemsByUser(params.userId);
  const { data: followersCount, refetch: refetchFollowersCount } = useFollowersCount(params.userId);
  const { data: followingCount, refetch: refetchFollowingCount } = useFollowingCount(params.userId);
  const { badges } = useBadgesForUser(params.userId);
  const { data: followStatus, refetch: refetchFollowStatus } = useFollowStatus(params.userId);
  const follow = useFollow();
  const unfollow = useUnfollow();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const hasSharedCollection = !!(
    profile?.collection_share_books ||
    profile?.collection_share_movies ||
    profile?.collection_share_music ||
    profile?.collection_share_games ||
    profile?.collection_share_podcasts
  );
  const featuredBadges = (profile?.featured_badges ?? [])
    .map((key) => badges.find((b) => b.key === key))
    .filter((b): b is (typeof badges)[number] => !!b);

  let friendAction: ProfileCardFriendAction | undefined;
  if (followStatus?.kind === 'none') {
    friendAction = {
      label: profile?.is_private ? 'Request to Follow' : '+ Follow',
      onPress: () =>
        follow.mutate({ targetUserId: params.userId, isTargetPrivate: profile?.is_private ?? false }),
    };
  } else if (followStatus?.kind === 'pending') {
    friendAction = { label: 'Requested ✓', variant: 'muted' };
  } else if (followStatus?.kind === 'accepted') {
    friendAction = {
      label: 'Following ✓',
      variant: 'muted',
      onPress: () => unfollow.mutate(params.userId),
    };
  }

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      refetchLibrary();
      refetchFollowersCount();
      refetchFollowingCount();
      refetchFollowStatus();
    }, [refetchProfile, refetchLibrary, refetchFollowersCount, refetchFollowingCount, refetchFollowStatus])
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>

        {isLoading || libraryLoading ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
        ) : (
          <ProfileCard
            profile={profile}
            library={logged}
            followersCount={followersCount ?? 0}
            followingCount={followingCount ?? 0}
            onLoggedPress={() =>
              router.push({ pathname: '/profile-stats-modal', params: { userId: params.userId, tab: 'logged', name: profile?.full_name ?? profile?.username ?? 'Friend' } })
            }
            onFollowersPress={() =>
              router.push({ pathname: '/profile-stats-modal', params: { userId: params.userId, tab: 'followers', name: profile?.full_name ?? profile?.username ?? 'Friend' } })
            }
            onFollowingPress={() =>
              router.push({ pathname: '/profile-stats-modal', params: { userId: params.userId, tab: 'following', name: profile?.full_name ?? profile?.username ?? 'Friend' } })
            }
            collectionLabel="📦 View Collection"
            onCollectionPress={
              hasSharedCollection
                ? () =>
                    router.push({
                      pathname: '/friend-collection-modal',
                      params: { userId: params.userId, name: profile?.full_name ?? profile?.username ?? 'Friend' },
                    })
                : undefined
            }
            featuredBadges={featuredBadges}
            earnedBadgeCount={badges.filter((b) => b.earned).length}
            onOpenAchievements={() =>
              router.push({
                pathname: '/achievements-modal',
                params: { userId: params.userId, name: profile?.full_name ?? profile?.username ?? 'Friend' },
              })
            }
            friendAction={friendAction}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  scroll: { flex: 1 },
  content: { padding: Spacing.three, paddingBottom: Spacing.six },
  backRow: { marginBottom: Spacing.three },
  backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
  });
}
