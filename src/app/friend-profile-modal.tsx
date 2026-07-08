import { useFocusEffect } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ProfileCard } from '@/components/profile/profile-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFriendsCount } from '@/features/friends/api';
import { useLibraryItemsByUser } from '@/features/library/api';
import { useProfileById } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export default function FriendProfileModal() {
  const params = useLocalSearchParams<{ userId: string }>();
  const { data: profile, isLoading, refetch: refetchProfile } = useProfileById(params.userId);
  const { logged, isLoading: libraryLoading, refetch: refetchLibrary } = useLibraryItemsByUser(params.userId);
  const { data: friendsCount, refetch: refetchFriendsCount } = useFriendsCount(params.userId);
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  useFocusEffect(
    useCallback(() => {
      refetchProfile();
      refetchLibrary();
      refetchFriendsCount();
    }, [refetchProfile, refetchLibrary, refetchFriendsCount])
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
            friendsCount={friendsCount ?? 0}
            interests={[]}
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
