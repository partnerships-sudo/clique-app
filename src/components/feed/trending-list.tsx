import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import type { TrendingEntry } from '@/features/feed/trending';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const CARD_W = 112;
const CARD_H = Math.round(CARD_W * 1.5);
const AVATAR_SIZE = 24;
const AVATAR_OVERLAP = 9;
const MAX_AVATARS = 3;

function openTrending(entry: TrendingEntry) {
  router.push({
    pathname: '/content-detail-modal',
    params: {
      title: entry.title,
      type: entry.type,
      poster: entry.poster ?? undefined,
      sub: entry.sub ?? undefined,
      externalId: entry.externalId ?? undefined,
      mediaType: entry.mediaType ?? undefined,
    },
  });
}

function Top10Card({
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
  const needsContainFit = entry.type === 'listen' || entry.type === 'podcast';

  return (
    <Pressable
      onPress={() => openTrending(entry)}
      style={{ width: CARD_W, height: CARD_H, borderRadius: 14, overflow: 'hidden', backgroundColor: Brand.card }}>
      {entry.poster ? (
        <Image
          source={{ uri: entry.poster }}
          style={StyleSheet.absoluteFill}
          resizeMode={needsContainFit ? 'contain' : 'cover'}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: TypeColors[entry.type].bg,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}>
          <Text style={{ fontSize: 40 }}>{TypeColors[entry.type].icon}</Text>
        </View>
      )}
      <LinearGradient
        colors={['transparent', 'rgba(60, 50, 180, 0.92)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: CARD_H * 0.55,
          justifyContent: 'flex-end',
          paddingBottom: 8,
          paddingLeft: 10,
        }}>
        <Text
          style={{
            fontFamily: BrandFonts.syneExtraBold,
            fontSize: 42,
            color: '#fff',
            lineHeight: 44,
            opacity: 0.95,
          }}>
          {rank}
        </Text>
      </LinearGradient>
    </Pressable>
  );
}

export function TrendingList({
  entries,
  showTop10Banner,
  bannerTitle = 'Top 10 right now',
}: {
  entries: TrendingEntry[];
  showTop10Banner?: boolean;
  bannerTitle?: string;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  if (!entries.length) {
    return (
      <Text style={styles.empty}>
        Trending will appear as more people log things.
      </Text>
    );
  }

  const top10 = showTop10Banner ? entries.slice(0, 10) : [];
  const listEntries = showTop10Banner ? entries.slice(10) : entries;
  const rankOffset = showTop10Banner ? 10 : 0;

  return (
    <View style={styles.list}>
      {showTop10Banner && top10.length > 0 && (
        <View style={styles.bannerSection}>
          <Text style={styles.bannerTitle}>{bannerTitle}</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={top10}
            keyExtractor={(e) => e.title}
            contentContainerStyle={styles.bannerRow}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            renderItem={({ item, index }) => (
              <Top10Card
                entry={item}
                rank={index + 1}
                Brand={Brand}
                TypeColors={TypeColors}
              />
            )}
          />
        </View>
      )}

      {listEntries.length > 0 && (
        <>
          {showTop10Banner && <Text style={styles.restTitle}>More trending</Text>}
          {listEntries.map((entry, i) => {
            const type = TypeColors[entry.type];
            const rank = i + rankOffset + 1;
            const isHot = rank === 1 && entry.count > 1;
            const shownLoggers = entry.loggers.slice(0, MAX_AVATARS);
            const overflow = entry.loggers.length - shownLoggers.length;
            return (
              <Pressable
                key={entry.title}
                style={styles.item}
                onPress={() => openTrending(entry)}>
                <Text style={[styles.rank, isHot && styles.rankHot]}>{rank}</Text>
                {entry.poster ? (
                  <Image
                    source={{ uri: entry.poster }}
                    style={styles.typeIcon}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.typeIcon, { backgroundColor: type.bg }]}>
                    <Text style={styles.typeIconText}>{type.icon}</Text>
                  </View>
                )}
                <View style={styles.info}>
                  <Text style={styles.title}>{entry.title}</Text>
                  {entry.sub ? <Text style={styles.sub}>{entry.sub}</Text> : null}
                </View>
                {shownLoggers.length > 0 ? (
                  <View style={styles.avatarRow}>
                    {shownLoggers.map((logger, li) => (
                      <View
                        key={logger.name + li}
                        style={[styles.avatarWrap, li > 0 && { marginLeft: -AVATAR_OVERLAP }]}>
                        <Avatar name={logger.name} avatarUrl={logger.avatarUrl} size={AVATAR_SIZE} ring={Brand.card} />
                      </View>
                    ))}
                    {overflow > 0 && (
                      <View style={[styles.overflowBubble, { marginLeft: -AVATAR_OVERLAP }]}>
                        <Text style={styles.overflowText}>+{overflow}</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.count}>{entry.count > 1 ? `${entry.count} logs` : '1 log'}</Text>
                )}
              </Pressable>
            );
          })}
        </>
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
    bannerSection: { marginBottom: 6 },
    bannerTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 16,
      color: Brand.ink,
      marginBottom: 12,
    },
    bannerRow: { paddingRight: Spacing.three },
    restTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15,
      color: Brand.ink,
      marginTop: 4,
      marginBottom: 2,
    },
    item: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    rank: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.border,
      width: 24,
      textAlign: 'center',
    },
    rankHot: { color: Brand.warm },
    typeIcon: {
      width: 36,
      height: 36,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    typeIconText: { fontSize: 14 },
    info: { flex: 1, minWidth: 0 },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.ink,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      marginTop: 2,
    },
    count: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.5,
      color: Brand.trust,
    },
    avatarRow: { flexDirection: 'row', alignItems: 'center' },
    avatarWrap: { borderRadius: AVATAR_SIZE / 2 },
    overflowBubble: {
      width: AVATAR_SIZE,
      height: AVATAR_SIZE,
      borderRadius: AVATAR_SIZE / 2,
      backgroundColor: Brand.tlight,
      borderWidth: 1.5,
      borderColor: Brand.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    overflowText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      color: Brand.trust,
    },
  });
}
