import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useMostReviewed, type MostReviewedEntry, type MostReviewedPeriod } from '@/features/feed/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const PERIODS: { label: string; value: MostReviewedPeriod }[] = [
  { label: 'This week', value: 'week' },
  { label: 'This month', value: 'month' },
  { label: 'This year', value: 'year' },
  { label: 'All time', value: 'alltime' },
];

const COLLAPSED = 5;

function openEntry(entry: MostReviewedEntry) {
  router.push({
    pathname: '/content-detail-modal',
    params: {
      title: entry.title,
      type: entry.type,
      poster: entry.poster ?? undefined,
      sub: entry.sub ?? undefined,
      externalId: entry.externalId ?? undefined,
    },
  });
}

export function MostReviewedSection({ typeFilter }: { typeFilter?: EntryType | 'all' }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [period, setPeriod] = useState<MostReviewedPeriod>('month');
  const [expanded, setExpanded] = useState(false);
  const { data = [], isLoading } = useMostReviewed(period);

  const filtered = typeFilter && typeFilter !== 'all' ? data.filter((e) => e.type === typeFilter) : data;
  const visible = expanded ? filtered : filtered.slice(0, COLLAPSED);

  return (
    <View style={styles.section}>
      {/* Header row */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Most Reviewed</Text>
      </View>

      {/* Period pills */}
      <View style={styles.pills}>
        {PERIODS.map((p) => {
          const active = period === p.value;
          return (
            <Pressable
              key={p.value}
              onPress={() => { setPeriod(p.value); setExpanded(false); }}
              style={[styles.pill, active && styles.pillActive]}>
              <Text style={[styles.pillText, active && styles.pillTextActive]}>{p.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* List */}
      {isLoading ? (
        <Text style={styles.empty}>Loading…</Text>
      ) : filtered.length === 0 ? (
        <Text style={styles.empty}>Nothing logged yet for this period.</Text>
      ) : (
        <View style={styles.list}>
          {visible.map((entry, i) => {
            const type = TypeColors[entry.type];
            const rating = entry.avgRating ? Math.round(entry.avgRating) : null;
            return (
              <Pressable key={`${entry.type}:${entry.title}`} style={styles.item} onPress={() => openEntry(entry)}>
                <Text style={styles.rank}>{i + 1}</Text>

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
                  <Text style={styles.title} numberOfLines={1}>{entry.title}</Text>
                  {entry.sub ? <Text style={styles.sub} numberOfLines={1}>{entry.sub}</Text> : null}
                  {rating ? (
                    <Text style={styles.stars}>
                      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.countCol}>
                  <Text style={styles.count}>{entry.count}</Text>
                  <Text style={styles.countLabel}>
                    {entry.count === 1 ? 'log' : 'logs'}
                  </Text>
                </View>
              </Pressable>
            );
          })}

          {filtered.length > COLLAPSED && (
            <Pressable style={styles.viewMoreBtn} onPress={() => setExpanded((v) => !v)}>
              <Text style={styles.viewMoreText}>
                {expanded ? 'Show less' : `View more (${filtered.length - COLLAPSED})`}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    section: { marginTop: 24 },
    headerRow: { marginBottom: 12 },
    heading: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    pill: {
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: Brand.border,
      paddingVertical: 5,
      paddingHorizontal: 12,
      backgroundColor: Brand.card,
    },
    pillActive: {
      borderColor: Brand.trust,
      backgroundColor: Brand.tlight,
    },
    pillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12.5,
      color: Brand.muted,
    },
    pillTextActive: { color: Brand.trust },
    empty: {
      textAlign: 'center',
      padding: 20,
      color: Brand.muted,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.5,
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
    countCol: { alignItems: 'center', minWidth: 36 },
    count: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.trust, lineHeight: 24 },
    countLabel: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 1 },
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
