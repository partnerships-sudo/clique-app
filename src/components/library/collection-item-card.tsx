import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Alert, Dimensions, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Spacing, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import type { CollectionItem } from '@/features/collection/api';
import { RatingIcons } from '@/components/rating-icons';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const COLUMNS = 4;
const GRID_GAP = 10;
const { width: SCREEN_W } = Dimensions.get('window');
// Fixed width (not flex) so a partial last row stays left-aligned at the
// same tile size instead of stretching to fill the remaining columns.
const TILE_W = (SCREEN_W - Spacing.three * 2 - GRID_GAP * (COLUMNS - 1)) / COLUMNS;

export function CollectionItemCard({
  item,
  onPress,
  onRemove,
}: {
  item: CollectionItem;
  onPress?: () => void;
  /** Omit for a read-only view (someone else's shared collection) — disables long-press-to-remove. */
  onRemove?: () => void;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  // 'tv' shares the same palette as 'watch'; 'podcast' uses its own entry
  const typeKey = item.type === 'tv' ? 'watch' : item.type === 'podcast' ? 'podcast' : item.type;
  const type = TypeColors[typeKey as keyof typeof TypeColors];
  // Album covers are square, unlike book/DVD covers which are natively 2:3 —
  // matching the tile shape to the art avoids cropping either one.
  const isSquareArt = item.type === 'listen';

  function handleLongPress() {
    if (!onRemove) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(item.title, 'Remove this from your collection?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onRemove },
    ]);
  }

  return (
    <Pressable
      style={[styles.tile, isSquareArt && styles.tileSquare]}
      onPress={onPress}
      onLongPress={onRemove ? handleLongPress : undefined}
      delayLongPress={350}>
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterFallback, { backgroundColor: type.bg }]}>
          <Text style={styles.posterIcon}>{type.icon}</Text>
        </View>
      )}
      {item.user_rating ? (
        <View style={styles.ratingStrip}>
          <RatingIcons rating={item.user_rating} iconStyle="stars" textStyle={styles.ratingStars} />
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    tile: {
      width: TILE_W,
      aspectRatio: 2 / 3,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: Brand.border,
    },
    tileSquare: { aspectRatio: 1 },
    poster: { width: '100%', height: '100%' },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    posterIcon: { fontSize: 28 },
    ratingStrip: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingVertical: 5,
      alignItems: 'center',
    },
    ratingStars: { fontSize: 9, color: '#FFD700' },
  });
}
