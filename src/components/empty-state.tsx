import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

/**
 * Standard "nothing here yet" state.
 *
 * Empty states had drifted to nine different title sizes (12.8 → 22) and four
 * body sizes across the app. The five main tabs had already converged on
 * 40 / 16 / 13.6 by copy-paste; this component makes that the single source so
 * new screens inherit it instead of inventing another variant.
 *
 * Pair with QueryErrorState, which does the same job for failed fetches — an
 * empty list and a failed one should never look alike.
 */
export function EmptyState({
  emoji,
  title,
  body,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          style={styles.btn}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}>
          <Text style={styles.btnText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    wrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emoji: { fontSize: 40, marginBottom: 14 },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: Brand.ink,
      marginBottom: 8,
      textAlign: 'center',
    },
    body: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
    btn: {
      marginTop: 18,
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 12,
      paddingHorizontal: 28,
    },
    btnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  });
}
