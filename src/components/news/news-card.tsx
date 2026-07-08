import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { timeAgo } from '@/features/feed/time-ago';
import type { NewsArticle } from '@/features/news/api';
import { useBrand } from '@/hooks/use-brand';

export function NewsCard({ article, onPress }: { article: NewsArticle; onPress: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      {article.thumbnail ? (
        <Image source={{ uri: article.thumbnail }} style={styles.thumbnail} />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailFallback]}>
          <Text style={styles.thumbnailEmoji}>📰</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{article.section}</Text>
          </View>
          <Text style={styles.time}>{timeAgo(article.publishedAt)}</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {article.title}
        </Text>
        {article.trailText ? (
          <Text style={styles.trailText} numberOfLines={2}>
            {article.trailText}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 12,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    thumbnail: { width: 72, height: 72, borderRadius: 12, backgroundColor: Brand.border },
    thumbnailFallback: { alignItems: 'center', justifyContent: 'center' },
    thumbnailEmoji: { fontSize: 26 },
    body: { flex: 1, minWidth: 0 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    pill: {
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 8,
    },
    pillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.trust,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted },
    title: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 3 },
    trailText: { fontFamily: BrandFonts.interRegular, fontSize: 12.8, color: Brand.muted, lineHeight: 17 },
  });
}
