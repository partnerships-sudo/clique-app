import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Chip } from '@/components/profile/chip-row';
import { DEFAULT_INTERESTS, EditProfile } from '@/components/profile/edit-profile';
import { ProfileCard } from '@/components/profile/profile-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
import { useLibraryItems } from '@/features/library/api';
import { useProfile, useUpdateProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

type ProfileView = 'card' | 'edit';

export default function ProfileScreen() {
  const [view, setView] = useState<ProfileView>('card');
  const [interests, setInterests] = useState<Chip[]>(DEFAULT_INTERESTS);
  const { data: profile } = useProfile();
  const { logged } = useLibraryItems();
  const { data: friends } = useFriends();
  const updateProfile = useUpdateProfile();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Pressable
          onPress={view === 'edit' ? () => setView('card') : () => router.back()}
          hitSlop={8}
          style={styles.backRow}>
          <Text style={styles.backBtn}>{view === 'edit' ? '‹ Profile' : '‹ Back'}</Text>
        </Pressable>

        {view === 'card' ? (
          <>
            <ProfileCard
              profile={profile}
              library={logged}
              friendsCount={friends?.length ?? 0}
              interests={interests.filter((i) => i.on).map((i) => i.label)}
            />
            <Pressable style={styles.editBtn} onPress={() => setView('edit')}>
              <Text style={styles.editBtnText}>✏️ Edit Profile</Text>
            </Pressable>
          </>
        ) : (
          <EditProfile
            profile={profile}
            interests={interests}
            onInterestsChange={setInterests}
            onSaved={async (input) => {
              await updateProfile.mutateAsync(input);
              setView('card');
            }}
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
  editBtn: {
    marginTop: Spacing.three,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  editBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
  });
}
