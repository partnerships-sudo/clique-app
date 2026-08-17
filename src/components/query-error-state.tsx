import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

/**
 * Shown when a screen's data failed to load.
 *
 * Without this a failed query renders as an *empty* screen, which reads as
 * "you have no chats/friends/books" rather than "we couldn't reach the
 * server" — the same thing a person would see if their data had been deleted.
 *
 * Mirrors the feed's existing error state so every tab fails the same way.
 */
export function QueryErrorState({
  title,
  body = 'Check your connection and try again.',
  emoji = '📡',
  onRetry,
}: {
  title: string;
  body?: string;
  emoji?: string;
  onRetry: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <View style={styles.errorState}>
      <Text style={styles.errorEmoji}>{emoji}</Text>
      <Text style={styles.errorTitle}>{title}</Text>
      <Text style={styles.errorBody}>{body}</Text>
      <Pressable
        style={styles.errorRetryBtn}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry loading">
        <Text style={styles.errorRetryText}>Retry</Text>
      </Pressable>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    errorState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
    errorEmoji: { fontSize: 40, marginBottom: 14 },
    errorTitle: { fontFamily: BrandFonts.syneBold, fontSize: 17, color: Brand.ink, marginBottom: 8, textAlign: 'center' },
    errorBody: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    errorRetryBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 28 },
    errorRetryText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  });
}
