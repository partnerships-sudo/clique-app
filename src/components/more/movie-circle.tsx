import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const SIZE = 84;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${parseInt(d)} ${MONTHS[parseInt(m) - 1]} ${y}`;
}

export function MovieCircle({
  title,
  poster,
  releaseDate,
  onPress,
}: {
  title: string;
  poster: string | null;
  releaseDate?: string;
  onPress: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  return (
    <Pressable style={styles.wrap} onPress={onPress}>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.circle} />
      ) : (
        <View style={[styles.circle, styles.fallback]}>
          <Text style={styles.fallbackEmoji}>🎬</Text>
        </View>
      )}
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      {releaseDate ? (
        <Text style={styles.date}>{formatDate(releaseDate)}</Text>
      ) : null}
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    wrap: { width: SIZE, alignItems: 'center' },
    circle: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: Brand.border },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    fallbackEmoji: { fontSize: 28 },
    title: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11.5,
      color: Brand.ink,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 14,
    },
    date: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 10,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 3,
    },
  });
}
