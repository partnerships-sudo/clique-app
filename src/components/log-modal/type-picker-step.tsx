import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const TYPES: { value: EntryType; label: string }[] = [
  { value: 'watch', label: 'TV & Film' },
  { value: 'read', label: 'Books' },
  { value: 'play', label: 'Games' },
  { value: 'listen', label: 'Music' },
  { value: 'podcast', label: 'Podcast' },
];

export function TypePickerStep({
  value,
  onSelect,
}: {
  value: EntryType | null;
  onSelect: (type: EntryType) => void;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  return (
    <View style={styles.grid}>
      {TYPES.map((t) => {
        const selected = t.value === value;
        return (
          <Pressable
            key={t.value}
            onPress={() => onSelect(t.value)}
            style={[styles.card, selected && styles.cardSelected]}>
            <Text style={styles.icon}>{TypeColors[t.value].icon}</Text>
            <Text style={styles.label}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      width: '47%',
      borderWidth: 2,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    cardSelected: {
      borderColor: Brand.trust,
      backgroundColor: Brand.tlight,
    },
    icon: { fontSize: 26, marginBottom: 6 },
    label: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.ink,
    },
  });
}
