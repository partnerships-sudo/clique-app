import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Chip } from '@/components/profile/chip-row';
import { DEFAULT_INTERESTS, EditProfile } from '@/components/profile/edit-profile';
import { ProfileCard } from '@/components/profile/profile-card';
import { ShareProfileModal } from '@/components/profile/share-profile-modal';
import { Spacing, type BrandPalette } from '@/constants/theme';
import { useBadges, useFeaturedBadges } from '@/features/badges/api';
import { useFollowersCount, useFollowingCount } from '@/features/follows/api';
import { useLibraryItems } from '@/features/library/api';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

type ProfileView = 'card' | 'edit';

export default function ProfileTab() {
  const [view, setView] = useState<ProfileView>('card');
  const [shareVisible, setShareVisible] = useState(false);
  const [interests, setInterests] = useState<Chip[]>(DEFAULT_INTERESTS);
  const { data: profile } = useProfile();
  const { logged } = useLibraryItems();
  const { data: followersCount } = useFollowersCount(profile?.id);
  const { data: followingCount } = useFollowingCount(profile?.id);
  const updateProfile = useUpdateProfile();
  const { badges } = useBadges();
  const featuredBadgeKeys = useFeaturedBadges();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const featuredBadges = featuredBadgeKeys
    .map((key) => badges.find((b) => b.key === key))
    .filter((b): b is (typeof badges)[number] => !!b);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <ProfileCard
          profile={profile}
          library={logged}
          followersCount={followersCount ?? 0}
          followingCount={followingCount ?? 0}
          onLoggedPress={() =>
            router.push({ pathname: '/profile-stats-modal', params: { userId: profile?.id, tab: 'logged', name: profile?.full_name ?? profile?.username ?? 'You' } })
          }
          onFollowersPress={() =>
            router.push({ pathname: '/profile-stats-modal', params: { userId: profile?.id, tab: 'followers', name: profile?.full_name ?? profile?.username ?? 'You' } })
          }
          onFollowingPress={() =>
            router.push({ pathname: '/profile-stats-modal', params: { userId: profile?.id, tab: 'following', name: profile?.full_name ?? profile?.username ?? 'You' } })
          }
          onEditPress={() => setView('edit')}
          onCollectionPress={() =>
            router.push({ pathname: '/(tabs)/library', params: { tab: 'collection' } })
          }
          featuredBadges={featuredBadges}
          earnedBadgeCount={badges.filter((b) => b.earned).length}
          onOpenAchievements={() => router.push('/achievements-modal')}
          onShare={() => setShareVisible(true)}
        />
        {view === 'edit' ? (
          <EditProfile
            profile={profile}
            interests={interests}
            onInterestsChange={setInterests}
            onSaved={async (input) => {
              await updateProfile.mutateAsync(input);
              setView('card');
            }}
          />
        ) : null}
      </ScrollView>
      <ShareProfileModal visible={shareVisible} onClose={() => setShareVisible(false)} profile={profile} />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    scroll: { flex: 1 },
    content: { padding: Spacing.three, paddingBottom: Spacing.six },
  });
}
