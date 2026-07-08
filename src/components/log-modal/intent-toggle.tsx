import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export type LogIntent = 'log' | 'watchlist';

export function IntentToggle({
  value,
  onChange,
}: {
  value: LogIntent;
  onChange: (intent: LogIntent) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  return (
    <View style={styles.row}>
      <Pressable
        style={[styles.option, value === 'log' && styles.optionActive]}
        onPress={() => onChange('log')}>
        <Text style={[styles.text, value === 'log' && styles.textActive]}>Log it now</Text>
      </Pressable>
      <Pressable
        style={[styles.option, value === 'watchlist' && styles.optionActive]}
        onPress={() => onChange('watchlist')}>
        <Text style={[styles.text, value === 'watchlist' && styles.textActive]}>
          Add to watchlist
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: Brand.paper,
      borderRadius: 12,
      padding: 4,
      marginBottom: 18,
    },
    option: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 9,
      alignItems: 'center',
    },
    optionActive: {
      backgroundColor: Brand.ink,
    },
    text: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.muted,
    },
    textActive: {
      color: '#fff',
    },
  });
}
