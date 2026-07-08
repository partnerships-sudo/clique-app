import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand } from '@/hooks/use-brand';

export default function NewsArticleModal() {
  const params = useLocalSearchParams<{
    title: string;
    trailText?: string;
    thumbnail?: string;
    byline?: string;
    section: string;
    publishedAt: string;
    url: string;
  }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function openArticle() {
    Linking.openURL(params.url).catch(() => {});
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <View style={styles.sheet}>
        {params.thumbnail ? (
          <Image source={{ uri: params.thumbnail }} style={styles.hero} />
        ) : (
          <View style={[styles.hero, styles.heroFallback]}>
            <Text style={styles.heroEmoji}>📰</Text>
          </View>
        )}

        <View style={styles.content}>
          <View style={styles.metaRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>{params.section}</Text>
            </View>
            <Text style={styles.time}>{timeAgo(params.publishedAt)}</Text>
          </View>
          <Text style={styles.title}>{params.title}</Text>
          {params.byline ? <Text style={styles.byline}>By {params.byline}</Text> : null}
          {params.trailText ? <Text style={styles.trailText}>{params.trailText}</Text> : null}

          <Pressable style={styles.readBtn} onPress={openArticle}>
            <Text style={styles.readBtnText}>Read full article ↗</Text>
          </Pressable>
        </View>

        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },
  hero: { width: '100%', height: 200, backgroundColor: Brand.border },
  heroFallback: { alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 48 },
  content: { padding: Spacing.four },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  pill: {
    backgroundColor: Brand.tlight,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  pillText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.trust,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  time: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: Brand.ink,
    marginBottom: 6,
  },
  byline: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 12.5,
    color: Brand.muted,
    marginBottom: 10,
  },
  trailText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14.5,
    color: Brand.ink,
    lineHeight: 21,
  },
  readBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: Spacing.four,
  },
  readBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  closeBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    marginTop: 'auto',
    marginBottom: Spacing.three,
  },
  closeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
