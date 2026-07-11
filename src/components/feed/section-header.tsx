import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export function SectionHeader({ title, onViewAll }: { title: string; onViewAll?: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onViewAll ? (
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.viewAll}>View all ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    viewAll: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.trust },
  });
}
