import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import type { TrendingEntry } from '@/features/feed/trending';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { Avatar } from '@/components/avatar';

const CARD_W = 140;
const POSTER_H = Math.round(CARD_W * 1.55);
const AVATAR_SIZE = 20;
const AVATAR_OVERLAP = 8;
const MAX_AVATARS = 3;

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

function TopPickCard({
  entry,
  rank,
  Brand,
  TypeColors,
}: {
  entry: TrendingEntry;
  rank: number;
  Brand: BrandPalette;
  TypeColors: TypeColorPalette;
}) {
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const shownLoggers = entry.loggers.slice(0, MAX_AVATARS);
  const overflow = entry.loggers.length - shownLoggers.length;
  // Music and podcast art is square and doesn't match this tall 2:3-ish
  // card — "cover" would crop the edge that doesn't fit, cutting off a
  // podcast's title baked into its cover art. "contain" keeps the whole
  // image visible instead. Games now have real portrait box art (IGDB), so
  // they're treated like movies/books here, not music/podcasts.
  const needsContainFit = entry.type === 'listen' || entry.type === 'podcast';

  return (
    <Pressable style={styles.card} onPress={() => openEntry(entry)}>
      {entry.poster ? (
        <Image
          source={{ uri: entry.poster }}
          style={StyleSheet.absoluteFill}
          resizeMode={needsContainFit ? 'contain' : 'cover'}
        />
      ) : (
        <View
          style={[StyleSheet.absoluteFill, styles.posterFallback, { backgroundColor: TypeColors[entry.type].bg }]}>
          <Text style={{ fontSize: 34 }}>{TypeColors[entry.type].icon}</Text>
        </View>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(8, 5, 24, 0.55)', 'rgba(8, 5, 24, 0.95)']}
        locations={[0, 0.45, 1]}
        style={styles.infoGradient}>
        <Text style={styles.rankText}>{rank}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {entry.title}
        </Text>
        <Text style={styles.typeLabel} numberOfLines={1}>
          {(TypeColors[entry.type] ?? TypeColors.watch).label}
        </Text>

        {shownLoggers.length > 0 && (
          <View style={styles.avatarRow}>
            {shownLoggers.map((logger, i) => (
              <View
                key={logger.name + i}
                style={[styles.avatarWrap, { marginLeft: i === 0 ? 0 : -AVATAR_OVERLAP }]}>
                <Avatar name={logger.name} avatarUrl={logger.avatarUrl} size={AVATAR_SIZE} ring="rgba(8,5,24,0.95)" />
              </View>
            ))}
            {overflow > 0 && (
              <View style={[styles.overflowBubble, { marginLeft: -AVATAR_OVERLAP }]}>
                <Text style={styles.overflowText}>+{overflow}</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

export function TopPicksRow({ entries }: { entries: TrendingEntry[] }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  if (!entries.length) return null;

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={entries}
      keyExtractor={(e) => e.title}
      contentContainerStyle={styles.row}
      ItemSeparatorComponent={() => <View style={{ width: 14 }} />}
      renderItem={({ item, index }) => (
        <TopPickCard entry={item} rank={index + 1} Brand={Brand} TypeColors={TypeColors} />
      )}
    />
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: { paddingRight: Spacing.three },
    card: {
      width: CARD_W,
      height: POSTER_H,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: Brand.card,
    },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    infoGradient: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 60,
    },
    rankText: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 32,
      lineHeight: 34,
      color: '#fff',
    },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#fff',
      marginTop: 4,
    },
    typeLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11.5,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    avatarRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    avatarWrap: { borderRadius: 100 },
    overflowBubble: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Brand.tlight,
      borderWidth: 2,
      borderColor: 'rgba(8,5,24,0.95)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    overflowText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: Brand.muted,
    },
  });
}
