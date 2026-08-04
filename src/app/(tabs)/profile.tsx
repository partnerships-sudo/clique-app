import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Chip } from '@/components/profile/chip-row';
import { DEFAULT_INTERESTS, EditProfile, type EditProfileHandle } from '@/components/profile/edit-profile';
import { ProfileCard } from '@/components/profile/profile-card';
import { ShareProfileModal } from '@/components/profile/share-profile-modal';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBadges, useFeaturedBadges } from '@/features/badges/api';
import { useFollowersCount, useFollowingCount } from '@/features/follows/api';
import { useLibraryItems } from '@/features/library/api';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

type ProfileView = 'card' | 'edit';

export default function ProfileTab() {
  const { initialTab } = useLocalSearchParams<{ initialTab?: string }>();
  const [view, setView] = useState<ProfileView>('card');
  const [cardKey, setCardKey] = useState(0);
  const editSaveRef = useRef<EditProfileHandle | null>(null);

  useFocusEffect(useCallback(() => {
    setCardKey((k) => k + 1);
  }, []));
  const [shareVisible, setShareVisible] = useState(false);
  const [interests, setInterests] = useState<Chip[]>(DEFAULT_INTERESTS);
  const { data: profile } = useProfile();
  const { data: allLibrary } = useLibraryItems();
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
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
<ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled">
        {view === 'edit' ? (
          <View style={styles.editWrap}>
            <Pressable onPress={() => setView('card')} style={styles.editBack} hitSlop={16}>
              <Text style={styles.editBackText}>‹ Back</Text>
            </Pressable>
            <EditProfile
              profile={profile}
              interests={interests}
              onInterestsChange={setInterests}
              saveRef={editSaveRef}
              onSaved={async (input) => {
                await updateProfile.mutateAsync(input);
                setView('card');
              }}
            />
          </View>
        ) : (
          <ProfileCard
            key={cardKey}
            initialTab={initialTab as any}
            profile={profile}
            library={allLibrary ?? []}
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
        )}
      </ScrollView>
      {view === 'edit' && (
        <View style={styles.stickyFooter}>
          <Pressable
            style={styles.stickySaveBtn}
            onPress={() => editSaveRef.current?.save()}
            disabled={editSaveRef.current?.isSaving}>
            {editSaveRef.current?.isSaving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.stickySaveBtnText}>Save profile</Text>}
          </Pressable>
        </View>
      )}
      </KeyboardAvoidingView>
      <ShareProfileModal visible={shareVisible} onClose={() => setShareVisible(false)} profile={profile} />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    keyboardAvoid: { flex: 1 },
    scroll: { flex: 1 },
    content: { paddingBottom: Spacing.three },
    editWrap: { paddingHorizontal: 12 },
    editBack: { paddingVertical: 12 },
    editBackText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    stickyFooter: {
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      backgroundColor: Brand.paper,
    },
    stickySaveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    stickySaveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
