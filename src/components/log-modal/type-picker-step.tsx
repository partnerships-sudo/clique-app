import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const TYPES: { value: EntryType; label: string; symbol: string }[] = [
  { value: 'watch', label: 'TV & Film', symbol: 'tv' },
  { value: 'read', label: 'Books', symbol: 'book' },
  { value: 'play', label: 'Games', symbol: 'gamecontroller' },
  { value: 'listen', label: 'Music', symbol: 'headphones' },
  { value: 'podcast', label: 'Podcasts', symbol: 'mic' },
];

const CIRCLE = 90;

export function TypePickerStep({
  value,
  onSelect,
}: {
  value: EntryType | null;
  onSelect: (type: EntryType) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const row1 = TYPES.slice(0, 3);
  const row2 = TYPES.slice(3);

  function renderItem(t: typeof TYPES[number]) {
    const selected = t.value === value;
    return (
      <Pressable key={t.value} style={styles.item} onPress={() => onSelect(t.value)}>
        <View style={[styles.circle, selected && styles.circleSelected]}>
          <SymbolView
            name={t.symbol as any}
            size={32}
            tintColor={selected ? Brand.trust : Brand.muted}
            type="monochrome"
          />
        </View>
        <Text style={[styles.label, selected && styles.labelSelected]}>{t.label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>{row1.map(renderItem)}</View>
      <View style={[styles.row, styles.rowCenter]}>{row2.map(renderItem)}</View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    wrap: { gap: 24 },
    row: { flexDirection: 'row', justifyContent: 'space-around' },
    rowCenter: { justifyContent: 'center', gap: 40 },
    item: { alignItems: 'center', gap: 6, width: CIRCLE },
    circle: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      backgroundColor: Brand.card,
      borderWidth: 2,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleSelected: {
      backgroundColor: Brand.tlight,
      borderColor: Brand.trust,
    },
    label: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.muted,
      textAlign: 'center',
    },
    labelSelected: {
      color: Brand.trust,
    },
  });
}
