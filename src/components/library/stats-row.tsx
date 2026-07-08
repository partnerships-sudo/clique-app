import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType, type TypeColorPalette } from '@/constants/theme';
import type { LibraryItem } from '@/features/library/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const STATS: { type: EntryType; label: string }[] = [
  { type: 'watch', label: 'TV' },
  { type: 'read', label: 'Books' },
  { type: 'play', label: 'Games' },
  { type: 'listen', label: 'Music' },
  { type: 'podcast', label: 'Pods' },
];

export function StatsRow({ items }: { items: LibraryItem[] }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand, TypeColors), [Brand, TypeColors]);

  return (
    <View style={styles.row}>
      {STATS.map((stat) => {
        const count = items.filter((i) => i.type === stat.type).length;
        return (
          <View key={stat.type} style={styles.cell}>
            <Text style={styles.icon}>{TypeColors[stat.type].icon}</Text>
            <Text style={styles.num}>{count}</Text>
            <Text style={styles.label}>{stat.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(Brand: BrandPalette, TypeColors: TypeColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    cell: {
      flex: 1,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingVertical: 10,
      alignItems: 'center',
    },
    icon: { fontSize: 17, marginBottom: 3 },
    num: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
      lineHeight: 20,
    },
    label: {
      fontSize: 10,
      color: Brand.muted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
  });
}
