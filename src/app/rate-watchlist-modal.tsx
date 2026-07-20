import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useRateLibraryItem } from '@/features/library/api';
import { useProfile } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';

export default function RateWatchlistModal() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    type: EntryType;
    sub?: string;
    poster?: string;
    externalId?: string;
    mediaType?: string;
    extRating?: string;
  }>();

  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const type = TypeColors[params.type as EntryType] ?? TypeColors.watch;
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';

  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const rateItem = useRateLibraryItem();

  async function handleLog() {
    if (!rating) return;
    await rateItem.mutateAsync({
      id: params.id,
      rating,
      title: params.title,
      type: params.type as EntryType,
      sub: params.sub ?? null,
      poster: params.poster ?? null,
      externalId: params.externalId ?? null,
      mediaType: params.mediaType ?? null,
      extRating: params.extRating ?? null,
    });
    router.back();
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.6],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <View style={styles.sheet}>
        {/* Item card */}
        <View style={styles.itemCard}>
          {params.poster ? (
            <Image source={{ uri: params.poster }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.posterFallback, { backgroundColor: type.bg }]}>
              <Text style={{ fontSize: 22 }}>{type.icon}</Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <View style={[styles.typePill, { backgroundColor: type.bg }]}>
              <Text style={[styles.typePillText, { color: type.color }]}>{type.label}</Text>
            </View>
            <Text style={styles.title} numberOfLines={2}>{params.title}</Text>
            {params.sub ? <Text style={styles.sub} numberOfLines={1}>{params.sub}</Text> : null}
          </View>
        </View>

        {/* Rating picker */}
        <Text style={styles.sectionLabel}>Your rating</Text>
        <RatingPicker
          value={rating ?? 0}
          iconStyle={ratingIcon}
          onChange={(v) => setRating(v === 0 ? null : v)}
          size={36}
        />

        {/* Note */}
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          placeholderTextColor={Brand.muted}
          value={note}
          onChangeText={setNote}
          multiline
        />

        {/* Submit */}
        <Pressable
          style={[styles.logBtn, (!rating || rateItem.isPending) && styles.logBtnDisabled]}
          disabled={!rating || rateItem.isPending}
          onPress={handleLog}>
          {rateItem.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.logBtnText}>Log it →</Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: Brand.paper,
      padding: Spacing.four,
      gap: 16,
    },
    itemCard: {
      flexDirection: 'row',
      gap: 14,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 14,
      alignItems: 'center',
    },
    poster: { width: 56, height: 78, borderRadius: 10, backgroundColor: Brand.border },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    itemInfo: { flex: 1, minWidth: 0, gap: 4 },
    typePill: {
      alignSelf: 'flex-start',
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 8,
      marginBottom: 2,
    },
    typePillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink, lineHeight: 21 },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    noteInput: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.card,
      minHeight: 56,
      textAlignVertical: 'top',
    },
    logBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    logBtnDisabled: { opacity: 0.45 },
    logBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
