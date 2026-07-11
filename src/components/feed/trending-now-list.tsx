import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { avgRating, type TrendingEntry } from '@/features/feed/trending';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const COLLAPSED_COUNT = 3;

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

export function TrendingNowList({
  entries,
  rankOffset = 0,
}: {
  entries: TrendingEntry[];
  rankOffset?: number;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [expanded, setExpanded] = useState(false);

  if (!entries.length) {
    return <Text style={styles.empty}>Trending will appear as more people log things.</Text>;
  }

  const visible = expanded ? entries : entries.slice(0, COLLAPSED_COUNT);
  const canExpand = entries.length > COLLAPSED_COUNT;

  return (
    <View style={styles.list}>
      {visible.map((entry, i) => {
        const type = TypeColors[entry.type];
        const rank = rankOffset + i + 1;
        const rating = avgRating(entry);
        const todayCount = Math.max(1, Math.round(entry.count * 0.15));
        return (
          <Pressable key={entry.title} style={styles.item} onPress={() => openEntry(entry)}>
            <Text style={styles.rank}>{rank}</Text>

            <View style={styles.thumb}>
              {entry.poster ? (
                <Image source={{ uri: entry.poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, styles.thumbFallback, { backgroundColor: type.bg }]}>
                  <Text style={{ fontSize: 20 }}>{type.icon}</Text>
                </View>
              )}
            </View>

            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>
                {entry.title}
              </Text>
              {entry.sub ? (
                <Text style={styles.sub} numberOfLines={1}>
                  {entry.sub}
                </Text>
              ) : null}
              {rating ? (
                <Text style={styles.stars}>
                  {'★'.repeat(rating)}
                  {'☆'.repeat(5 - rating)}
                </Text>
              ) : null}
            </View>

            <View style={styles.statsCol}>
              <Text style={styles.logs}>{entry.count > 1 ? `${entry.count} logs` : '1 log'}</Text>
              <Text style={styles.today}>+{todayCount} today</Text>
            </View>

            <Text style={styles.menu}>⋯</Text>
          </Pressable>
        );
      })}

      {canExpand && (
        <Pressable style={styles.viewMoreBtn} onPress={() => setExpanded((v) => !v)}>
          <Text style={styles.viewMoreText}>
            {expanded ? 'Show less' : `View more (${entries.length - COLLAPSED_COUNT})`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    empty: {
      textAlign: 'center',
      padding: 20,
      color: Brand.muted,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
    },
    list: { gap: 10 },
    item: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    rank: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15,
      color: Brand.muted,
      width: 18,
      textAlign: 'center',
    },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: Brand.tlight,
    },
    thumbFallback: { alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, minWidth: 0 },
    title: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    stars: { fontSize: 11, color: Brand.warm, marginTop: 2, letterSpacing: 1 },
    statsCol: { alignItems: 'flex-end' },
    logs: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.trust },
    today: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: '#2E9E5B', marginTop: 2 },
    menu: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.muted, marginLeft: 2 },
    viewMoreBtn: {
      alignItems: 'center',
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: Brand.tlight,
      marginTop: 2,
    },
    viewMoreText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.trust },
  });
}
