import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export function SectionLabel({ children }: { children: ReactNode }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.row}>
      <Text style={styles.text}>{children}</Text>
      <View style={styles.line} />
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    text: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    line: { flex: 1, height: 1, backgroundColor: Brand.border },
  });
}
