import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export type Chip = { label: string; on: boolean };

export function ChipRow({
  chips,
  onToggle,
  variant = 'light',
}: {
  chips: Chip[];
  onToggle: (index: number) => void;
  variant?: 'light' | 'dark';
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  return (
    <View style={styles.row}>
      {chips.map((chip, i) => (
        <Pressable
          key={chip.label}
          onPress={() => onToggle(i)}
          style={[
            styles.chip,
            chip.on && (variant === 'dark' ? styles.chipOnDark : styles.chipOnLight),
          ]}>
          <Text style={[styles.text, chip.on && (variant === 'dark' ? styles.textOnDark : styles.textOnLight)]}>
            {chip.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 14,
      backgroundColor: Brand.card,
    },
    chipOnLight: { backgroundColor: Brand.tlight, borderColor: Brand.trust },
    chipOnDark: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    text: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
    textOnLight: { color: Brand.trust },
    textOnDark: { color: '#fff' },
  });
}
