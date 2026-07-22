import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export type LibrarySort = 'recent' | 'alpha';

const OPTIONS: { value: LibrarySort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'alpha', label: 'A–Z' },
];

export function SortRow({
  value,
  onChange,
}: {
  value: LibrarySort;
  onChange: (sort: LibrarySort) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>Sort by</Text>
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.btn, active && styles.btnActive]}>
            <Text style={[styles.btnText, active && styles.btnTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: 16 },
    label: { fontSize: 12.5, color: Brand.muted, fontFamily: BrandFonts.interRegular, marginRight: 2 },
    btn: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 20,
      paddingVertical: 5,
      paddingHorizontal: 12,
    },
    btnActive: {
      backgroundColor: Brand.ink,
      borderColor: Brand.ink,
    },
    btnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.muted,
    },
    btnTextActive: {
      color: '#fff',
    },
  });
}
