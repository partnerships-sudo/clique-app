import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile, useUpdateCollectionSharing } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export default function CollectionSharingSettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const updateSharing = useUpdateCollectionSharing();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>My Collection</Text>
        <Text style={styles.intro}>
          Choose what friends can see when they visit your profile. Off means it stays private —
          only you can see it.
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>📖 Books</Text>
              <Text style={styles.rowSub}>Show the books in your collection on your profile</Text>
            </View>
            <Switch
              value={profile?.collection_share_books ?? false}
              onValueChange={(value) => updateSharing.mutate({ shareBooks: value })}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>🎬 Movies & TV</Text>
              <Text style={styles.rowSub}>Show your DVDs/Blu-rays/4Ks on your profile</Text>
            </View>
            <Switch
              value={profile?.collection_share_movies ?? false}
              onValueChange={(value) => updateSharing.mutate({ shareMovies: value })}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>🎵 Music</Text>
              <Text style={styles.rowSub}>Show your CDs/Vinyls on your profile</Text>
            </View>
            <Switch
              value={profile?.collection_share_music ?? false}
              onValueChange={(value) => updateSharing.mutate({ shareMusic: value })}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>🎮 Games</Text>
              <Text style={styles.rowSub}>Show the games in your collection on your profile</Text>
            </View>
            <Switch
              value={profile?.collection_share_games ?? false}
              onValueChange={(value) => updateSharing.mutate({ shareGames: value })}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>🎙 Podcasts</Text>
              <Text style={styles.rowSub}>Show the podcasts in your collection on your profile</Text>
            </View>
            <Switch
              value={profile?.collection_share_podcasts ?? false}
              onValueChange={(value) => updateSharing.mutate({ sharePodcasts: value })}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, marginBottom: Spacing.three },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { flex: 1, paddingHorizontal: Spacing.three },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink, marginBottom: 10 },
    intro: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      lineHeight: 19,
      marginBottom: Spacing.four,
    },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: Spacing.three,
      gap: 12,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 2 },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
  });
}
