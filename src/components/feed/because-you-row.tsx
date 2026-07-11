import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import type { TrendingEntry } from '@/features/feed/trending';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const CARD_W = 108;
const CARD_H = Math.round(CARD_W * 1.45);

function openEntry(entry: TrendingEntry) {
  router.push({
    pathname: '/content-detail-modal',
    params: {
      title: entry.title,
      type: entry.type,
      poster: entry.poster ?? undefined,
      sub: entry.sub ?? undefined,
    },
  });
}

export function BecauseYouRow({
  seedTitle,
  verb = 'watched',
  entries,
}: {
  seedTitle: string;
  verb?: string;
  entries: TrendingEntry[];
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  if (!entries.length) return null;

  return (
    <View>
      <Text style={styles.heading} numberOfLines={1}>
        Because you {verb} <Text style={styles.headingSeed}>{seedTitle}</Text>
      </Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={entries.filter((e, i, arr) => arr.findIndex((x) => x.type === e.type && x.title.toLowerCase() === e.title.toLowerCase()) === i)}
        keyExtractor={(e) => `${e.type}:${e.title}`}
        contentContainerStyle={styles.row}
        ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
        ListFooterComponent={
          <Pressable style={styles.sparkleBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.sparkleIcon}>✨</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => openEntry(item)}>
            {item.poster ? (
              <Image
                source={{ uri: item.poster }}
                style={StyleSheet.absoluteFill}
                resizeMode={item.type === 'listen' || item.type === 'podcast' ? 'contain' : 'cover'}
              />
            ) : (
              <View
                style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: TypeColors[item.type].bg }]}>
                <Text style={{ fontSize: 28 }}>{TypeColors[item.type].icon}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    heading: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 16,
      color: Brand.ink,
      marginBottom: 12,
    },
    headingSeed: { color: Brand.trust },
    row: { paddingRight: Spacing.three, alignItems: 'center' },
    card: {
      width: CARD_W,
      height: CARD_H,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: Brand.card,
    },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    sparkleBtn: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sparkleIcon: { fontSize: 20 },
  });
}
