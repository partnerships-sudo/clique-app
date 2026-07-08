import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useRateLibraryItem } from '@/features/library/api';
import { useProfile } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export default function RateModal() {
  const params = useLocalSearchParams<{
    itemId: string;
    title: string;
    poster?: string;
    type?: EntryType;
    currentRating?: string;
  }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const rateItem = useRateLibraryItem();
  const [rating, setRating] = useState(Number(params.currentRating) || 0);
  const type = params.type ? TypeColors[params.type] : null;

  async function handleSave() {
    await rateItem.mutateAsync({
      id: params.itemId,
      rating,
      title: params.title,
      type: (params.type ?? 'watch') as EntryType,
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>

      <View style={styles.content}>
        {params.poster ? (
          <Image source={{ uri: params.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback, { backgroundColor: type?.bg }]}>
            <Text style={styles.posterFallbackEmoji}>{type?.icon ?? '🎬'}</Text>
          </View>
        )}

        <Text style={styles.title}>{params.title}</Text>
        <Text style={styles.sub}>How would you rate it?</Text>

        <RatingPicker value={rating} iconStyle={ratingIcon} onChange={setRating} size={40} />

        <Pressable
          style={[styles.saveBtn, !rating && styles.saveBtnDisabled]}
          disabled={!rating || rateItem.isPending}
          onPress={handleSave}>
          {rateItem.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>Save rating</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { flex: 1, alignItems: 'center', padding: Spacing.four, paddingTop: Spacing.four },
    poster: { width: 140, height: 200, borderRadius: 16, backgroundColor: Brand.border, marginBottom: 20 },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    posterFallbackEmoji: { fontSize: 44 },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 20,
      color: Brand.ink,
      textAlign: 'center',
      marginBottom: 6,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      marginBottom: 22,
    },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 40,
      alignItems: 'center',
      marginTop: 28,
      alignSelf: 'stretch',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
