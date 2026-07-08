import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export type FeedView = 'feed' | 'circle' | 'global' | 'foryou';

const VIEWS: { value: FeedView; label: string; symbol: string }[] = [
  { value: 'feed', label: 'Feed', symbol: 'house' },
  { value: 'circle', label: 'My Circle', symbol: 'person.2' },
  { value: 'global', label: 'Global', symbol: 'globe' },
  { value: 'foryou', label: 'For You', symbol: 'sparkles' },
];

export function FeedViewSwitcher({
  value,
  onChange,
}: {
  value: FeedView;
  onChange: (value: FeedView) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.row}>
      {VIEWS.map((view) => {
        const active = view.value === value;
        return (
          <Pressable key={view.value} onPress={() => onChange(view.value)} style={styles.item}>
            <SymbolView
              name={view.symbol as any}
              size={24}
              tintColor={active ? Brand.trust : Brand.muted}
              type="monochrome"
            />
            <Text style={[styles.label, active && styles.labelActive]}>{view.label}</Text>
            {active && <View style={styles.indicator} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      paddingBottom: 14,
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    item: { alignItems: 'center', gap: 5, flex: 1, paddingTop: 4, paddingBottom: 6 },
    label: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
    },
    labelActive: {
      fontFamily: BrandFonts.syneBold,
      color: Brand.trust,
    },
    indicator: {
      position: 'absolute',
      bottom: 0,
      left: '20%',
      right: '20%',
      height: 2.5,
      borderRadius: 2,
      backgroundColor: Brand.trust,
    },
  });
}
