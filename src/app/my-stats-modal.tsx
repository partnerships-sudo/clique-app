import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useLibraryItems } from '@/features/library/api';
import { computeProfileStats } from '@/features/library/stats';
import { useBrand } from '@/hooks/use-brand';

export default function MyStatsModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { logged } = useLibraryItems();
  const stats = useMemo(() => computeProfileStats(logged), [logged]);

  const maxCategoryCount = Math.max(...stats.topCategories.map((c) => c.count), 1);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>My Stats</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Top row: Streak + Top Genres */}
        <View style={styles.topRow}>
          {/* Streak card */}
          <View style={[styles.card, styles.streakCard]}>
            <View style={styles.streakIconRow}>
              <Text style={styles.streakIcon}>🔥</Text>
            </View>
            <Text style={styles.streakDays}>{stats.streakDays} {stats.streakDays === 1 ? 'day' : 'days'}</Text>
            <Text style={styles.streakLabel}>LOGGING STREAK</Text>
            <Text style={styles.streakMsg}>{stats.streakMessage}</Text>
            <View style={styles.weekRow}>
              {stats.weekDays.map((d, i) => (
                <View key={i} style={styles.weekDay}>
                  <View style={[styles.weekDot, d.done && styles.weekDotDone]}>
                    {d.done ? <Text style={styles.weekCheck}>✓</Text> : null}
                  </View>
                  <Text style={styles.weekLabel}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Top Genres */}
          <View style={[styles.card, styles.genresCard]}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>TOP GENRES</Text>
            </View>
            {stats.topGenres.length === 0 ? (
              <Text style={styles.emptyText}>Log more to see genres</Text>
            ) : (
              stats.topGenres.map((g, i) => (
                <View key={g.name} style={styles.genreRow}>
                  <Text style={[styles.genreRank, { color: g.color }]}>#{i + 1}</Text>
                  <View style={styles.genreInfo}>
                    <View style={styles.genreBarBg}>
                      <View style={[styles.genreBarFill, { backgroundColor: g.color, width: `${Math.round((g.count / (stats.topGenres[0]?.count || 1)) * 100)}%` }]} />
                    </View>
                    <Text style={styles.genreName} numberOfLines={1}>{g.name}</Text>
                  </View>
                  <Text style={styles.genreCount}>{g.count}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Top Categories */}
        <View style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle}>TOP CATEGORIES</Text>
          </View>
          {stats.topCategories.map((cat) => (
            <View key={cat.label} style={styles.catRow}>
              <Text style={styles.catIcon}>{cat.icon}</Text>
              <Text style={styles.catLabel}>{cat.label}</Text>
              <View style={styles.catBarBg}>
                <View style={[styles.catBarFill, { backgroundColor: cat.color, width: `${Math.round((cat.count / maxCategoryCount) * 100)}%` }]} />
              </View>
              <Text style={styles.catCount}>{cat.count}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, marginBottom: 8 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink },
    content: { padding: Spacing.three, gap: 12, paddingBottom: Spacing.six },

    topRow: { flexDirection: 'row', gap: 12 },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    streakCard: { flex: 1 },
    genresCard: { flex: 1 },

    streakIconRow: { alignItems: 'center', marginBottom: 8 },
    streakIcon: { fontSize: 32 },
    streakDays: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: '#F4A340', textAlign: 'center' },
    streakLabel: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textAlign: 'center', letterSpacing: 1, marginBottom: 4 },
    streakMsg: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.ink, textAlign: 'center', marginBottom: 12 },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between' },
    weekDay: { alignItems: 'center', gap: 3 },
    weekDot: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1.5, borderColor: Brand.border,
      alignItems: 'center', justifyContent: 'center',
    },
    weekDotDone: { backgroundColor: '#F4A340', borderColor: '#F4A340' },
    weekCheck: { fontSize: 11, color: '#fff', fontWeight: '700' },
    weekLabel: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted },

    cardTitleRow: { marginBottom: 12 },
    cardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted, letterSpacing: 1 },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, textAlign: 'center', paddingVertical: 12 },

    genreRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    genreRank: { fontFamily: BrandFonts.syneExtraBold, fontSize: 12, width: 20 },
    genreInfo: { flex: 1, gap: 3 },
    genreBarBg: { height: 4, backgroundColor: Brand.border, borderRadius: 2, overflow: 'hidden' },
    genreBarFill: { height: 4, borderRadius: 2 },
    genreName: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.ink },
    genreCount: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink, width: 20, textAlign: 'right' },

    catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    catIcon: { fontSize: 18, width: 26, textAlign: 'center' },
    catLabel: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.ink, width: 70 },
    catBarBg: { flex: 1, height: 6, backgroundColor: Brand.border, borderRadius: 3, overflow: 'hidden' },
    catBarFill: { height: 6, borderRadius: 3 },
    catCount: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, width: 28, textAlign: 'right' },
  });
}
