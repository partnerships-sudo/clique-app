import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

function formatRevenue(revenue: number): string {
  if (revenue >= 1_000_000_000) return `$${(revenue / 1_000_000_000).toFixed(1)}B`;
  if (revenue >= 1_000_000) return `$${Math.round(revenue / 1_000_000)}M`;
  if (revenue >= 1_000) return `$${Math.round(revenue / 1_000)}K`;
  return revenue > 0 ? `$${revenue}` : 'N/A';
}

function daysInTheaters(releaseDate: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(releaseDate).getTime()) / 86_400_000));
}

function weeksLabel(days: number): string {
  if (days <= 7) return 'New this week';
  const weeks = Math.floor(days / 7);
  return `Week ${weeks + 1}`;
}

export function BoxOfficeRow({
  rank,
  title,
  poster,
  releaseDate,
  revenue,
  maxRevenue,
  onPress,
}: {
  rank: number;
  title: string;
  poster: string | null;
  releaseDate: string;
  revenue: number;
  maxRevenue: number;
  onPress: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const days = daysInTheaters(releaseDate);
  const isNew = days <= 7;
  const barPct = maxRevenue > 0 ? revenue / maxRevenue : 0;

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Text style={styles.rank}>{String(rank).padStart(2, '0')}</Text>

      {poster ? (
        <Image source={{ uri: poster }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={styles.posterEmoji}>🎬</Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          {isNew ? <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View> : null}
        </View>
        <Text style={styles.week}>{weeksLabel(days)}</Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${Math.round(barPct * 100)}%` }]} />
        </View>
      </View>

      <Text style={styles.revenue}>{formatRevenue(revenue)}</Text>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      gap: 12,
    },
    rank: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.border,
      letterSpacing: -1,
      minWidth: 28,
      textAlign: 'right',
    },
    poster: {
      width: 44,
      height: 62,
      borderRadius: 6,
      backgroundColor: Brand.tlight,
    },
    posterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterEmoji: { fontSize: 20 },
    info: { flex: 1, minWidth: 0, gap: 3 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13.5,
      color: Brand.ink,
      flex: 1,
    },
    newBadge: {
      backgroundColor: Brand.trust,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    newBadgeText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: '#fff',
      letterSpacing: 0.5,
    },
    week: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
    },
    barTrack: {
      height: 3,
      backgroundColor: Brand.border,
      borderRadius: 2,
      overflow: 'hidden',
      marginTop: 2,
    },
    barFill: {
      height: '100%',
      backgroundColor: Brand.trust,
      borderRadius: 2,
      opacity: 0.6,
    },
    revenue: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.trust,
      minWidth: 44,
      textAlign: 'right',
    },
  });
}
