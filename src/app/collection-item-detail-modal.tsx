import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import type { CollectionType } from '@/features/collection/api';
import { useRemoveFromCollection, useUpdateCollectionItemRating } from '@/features/collection/api';
import { useProfile } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const FORMAT_LABELS: Record<string, string> = {
  book: '📚 Book',
  dvd: '💿 DVD',
  bluray: '🔵 Blu-ray',
  '4k': '4K UHD',
  cd: '💿 CD',
  vinyl: '🎵 Vinyl',
  game: '🕹 Game',
};

function collectionTypeToEntryType(type: string): EntryType {
  if (type === 'tv') return 'watch';
  return type as EntryType;
}

export default function CollectionItemDetailModal() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    sub?: string;
    poster?: string;
    type: CollectionType;
    format?: string;
    userRating?: string;
    externalId?: string;
    isOwner?: string;
  }>();

  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const [rating, setRating] = useState(Number(params.userRating) || 0);
  const updateRating = useUpdateCollectionItemRating();
  const removeItem = useRemoveFromCollection();

  const isOwner = params.isOwner !== '0';
  const typeKey = params.type === 'tv' ? 'watch' : params.type === 'podcast' ? 'podcast' : params.type;
  const typeConfig = TypeColors[typeKey as keyof typeof TypeColors];
  const isSquareArt = params.type === 'listen' || params.type === 'podcast';
  const entryType = collectionTypeToEntryType(params.type ?? 'watch');

  async function handleSaveRating() {
    await updateRating.mutateAsync({ id: params.id, rating: rating || null });
  }

  function handleRemove() {
    Alert.alert(params.title, 'Remove this from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeItem.mutateAsync(params.id);
          router.back();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.sheet}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}>
      {/* Poster + info header */}
      <View style={styles.header}>
        <View style={[styles.posterBox, isSquareArt && styles.posterBoxSquare]}>
          {params.poster ? (
            <Image source={{ uri: params.poster }} style={styles.posterImg} resizeMode="cover" />
          ) : (
            <View style={[styles.posterImg, styles.posterFallback, { backgroundColor: typeConfig?.bg }]}>
              <Text style={styles.posterIcon}>{typeConfig?.icon ?? '🎬'}</Text>
            </View>
          )}
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title} numberOfLines={4}>
            {params.title}
          </Text>
          {params.sub ? (
            <Text style={styles.sub} numberOfLines={2}>
              {params.sub}
            </Text>
          ) : null}
          {params.format && FORMAT_LABELS[params.format] ? (
            <View style={styles.formatBadge}>
              <Text style={styles.formatBadgeText}>{FORMAT_LABELS[params.format]}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Rating section — own profile only */}
      {isOwner ? (
        <View style={styles.ratingSection}>
          <Text style={styles.sectionLabel}>Your Rating</Text>
          <RatingPicker value={rating} iconStyle={ratingIcon} onChange={setRating} size={36} />
          <Pressable
            style={[styles.saveBtn, updateRating.isPending && styles.saveBtnLoading]}
            onPress={handleSaveRating}
            disabled={updateRating.isPending}>
            {updateRating.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>{rating ? 'Save rating' : 'Clear rating'}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actions}>
        <Pressable
          style={styles.infoBtn}
          onPress={() =>
            router.push({
              pathname: '/content-detail-modal',
              params: {
                title: params.title,
                type: entryType,
                poster: params.poster ?? undefined,
                sub: params.sub ?? undefined,
                externalId: params.externalId ?? undefined,
              },
            })
          }>
          <Text style={styles.infoBtnText}>View full info ›</Text>
        </Pressable>
        {isOwner ? (
          <Pressable
            style={styles.removeBtn}
            onPress={handleRemove}
            disabled={removeItem.isPending}>
            {removeItem.isPending ? (
              <ActivityIndicator color="#E84F4F" size="small" />
            ) : (
              <Text style={styles.removeBtnText}>Remove from collection</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    sheet: { flex: 1, backgroundColor: Brand.paper },
    content: {
      paddingHorizontal: Spacing.three,
      paddingTop: 20,
      paddingBottom: 36,
    },
    header: { flexDirection: 'row', gap: 14, marginBottom: 28 },
    posterBox: {
      width: 96,
      height: 144,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: Brand.border,
    },
    posterBoxSquare: { width: 120, height: 120 },
    posterImg: { width: '100%', height: '100%' },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    posterIcon: { fontSize: 34 },
    headerInfo: { flex: 1, minWidth: 0, justifyContent: 'flex-start', paddingTop: 2 },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
      lineHeight: 23,
      marginBottom: 5,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      marginBottom: 10,
    },
    formatBadge: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.tlight,
      borderRadius: 8,
      paddingVertical: 3,
      paddingHorizontal: 9,
    },
    formatBadgeText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.trust,
    },
    ratingSection: {
      alignItems: 'center',
      marginBottom: 28,
      paddingVertical: 18,
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: 14,
    },
    saveBtn: {
      marginTop: 18,
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 36,
      alignItems: 'center',
      minWidth: 140,
    },
    saveBtnLoading: { opacity: 0.7 },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    actions: { gap: 10 },
    infoBtn: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    infoBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.trust,
    },
    removeBtn: {
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    removeBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: '#E84F4F',
    },
  });
}
