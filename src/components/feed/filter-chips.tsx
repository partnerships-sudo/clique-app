import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import { useBrand } from '@/hooks/use-brand';

const FILTERS: { value: FeedFilterValue; label: string; symbol: string }[] = [
  { value: 'all', label: 'All', symbol: 'square.grid.2x2' },
  { value: 'watch', label: 'TV & Film', symbol: 'movieclapper' },
  { value: 'read', label: 'Books', symbol: 'book.closed' },
  { value: 'play', label: 'Games', symbol: 'gamecontroller' },
  { value: 'podcast', label: 'Podcasts', symbol: 'mic' },
  { value: 'listen', label: 'Music', symbol: 'headphones' },
];

export function FilterChips({
  value,
  onChange,
}: {
  value: FeedFilterValue;
  onChange: (value: FeedFilterValue) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.row}
      contentContainerStyle={styles.content}>
      {FILTERS.map((filter) => {
        const active = filter.value === value;
        return (
          <Pressable key={filter.value} onPress={() => onChange(filter.value)} style={styles.item}>
            <View style={[styles.tile, active && styles.tileActive]}>
              <SymbolView
                name={filter.symbol as any}
                size={28}
                tintColor={active ? '#fff' : Brand.muted}
                type="monochrome"
              />
            </View>
            <Text style={[styles.label, active && styles.labelActive]}>{filter.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { marginBottom: 14 },
    content: { gap: 10, paddingRight: 16 },
    item: { alignItems: 'center', gap: 7 },
    tile: {
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    tileActive: {
      backgroundColor: Brand.trust,
      borderColor: Brand.trust,
      shadowOpacity: 0.22,
      shadowRadius: 10,
    },
    label: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
    },
    labelActive: {
      fontFamily: BrandFonts.syneBold,
      color: Brand.trust,
    },
  });
}
