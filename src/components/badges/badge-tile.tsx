import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { TIER_COLORS, type BadgeDef } from '@/features/badges/catalog';
import { useBrand } from '@/hooks/use-brand';

const UNEARNED_BG = '#D8D5E0';

export function BadgeTile({
  badge,
  earned,
  progress,
  size = 60,
  onPress,
}: {
  badge: Pick<BadgeDef, 'key' | 'name' | 'icon' | 'tier'>;
  earned: boolean;
  progress: number;
  size?: number;
  onPress?: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const tierColor = TIER_COLORS[badge.tier];

  return (
    <Pressable style={styles.wrap} onPress={onPress} hitSlop={4}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
          { backgroundColor: earned ? tierColor + '33' : UNEARNED_BG + '4D' },
          earned && { borderColor: tierColor, borderWidth: 2 },
        ]}>
        <Text style={[styles.icon, { fontSize: size * 0.42, opacity: earned ? 1 : 0.32 }]}>{badge.icon}</Text>
      </View>
      <Text style={[styles.name, !earned && styles.nameDim]} numberOfLines={2}>
        {badge.name}
      </Text>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    wrap: { width: 72, alignItems: 'center' },
    circle: { alignItems: 'center', justifyContent: 'center' },
    icon: {},
    name: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 10.5,
      color: Brand.ink,
      textAlign: 'center',
      marginTop: 5,
      lineHeight: 13,
    },
    nameDim: { color: Brand.muted },
  });
}
