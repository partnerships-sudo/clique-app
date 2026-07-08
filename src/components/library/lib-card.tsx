import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import type { LibraryItem, LibraryStatus } from '@/features/library/api';
import { useProfile } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const STATUS_META: Record<Exclude<LibraryStatus, 'watchlist'>, { label: string; color: string; bg: string }> = {
  finished: { label: 'Finished', color: '#4FE87B', bg: '#EDFFF3' },
  watching: { label: 'Watching', color: '#E84F4F', bg: '#FFEDED' },
  reading: { label: 'Reading', color: '#4F9CE8', bg: '#EDF4FF' },
  playing: { label: 'Playing', color: '#E8A84F', bg: '#FFF6ED' },
  listening: { label: 'Listening', color: '#A855F7', bg: '#F5EEFF' },
};

export function LibCard({ item }: { item: LibraryItem }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand, TypeColors), [Brand, TypeColors]);
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const type = TypeColors[item.type];
  const statusMeta = STATUS_META[item.status as Exclude<LibraryStatus, 'watchlist'>] ?? STATUS_META.watching;
  function openRateModal() {
    router.push({
      pathname: '/rate-modal',
      params: {
        itemId: item.id,
        title: item.title,
        poster: item.poster ?? undefined,
        type: item.type,
        currentRating: item.rating ? String(item.rating) : undefined,
      },
    });
  }

  return (
    <View style={styles.card}>
      <Pressable onPress={openRateModal} hitSlop={4}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.poster} />
        ) : (
          <View style={[styles.typeIcon, { backgroundColor: type.bg }]}>
            <Text style={styles.typeIconText}>{type.icon}</Text>
          </View>
        )}
      </Pressable>
      <View style={styles.body}>
        <Pressable onPress={openRateModal} hitSlop={4}>
          <Text style={styles.title}>{item.title}</Text>
        </Pressable>
        {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
        <View style={styles.metaRow}>
          <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
            <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
          </View>
          {item.rating ? (
            <RatingIcons rating={item.rating} iconStyle={ratingIcon} textStyle={styles.stars} />
          ) : null}
          {item.date ? <Text style={styles.date}>{item.date}</Text> : null}
          <Pressable
            style={styles.shareBtn}
            onPress={() =>
              router.push({
                pathname: '/recommend-modal',
                params: { title: item.title, type: item.type, sub: item.sub ?? undefined, poster: item.poster ?? undefined, extRating: item.ext_rating ?? undefined },
              })
            }
            hitSlop={8}>
            <Text style={styles.shareBtnText}>↗</Text>
          </Pressable>
        </View>
        {item.note ? <Text style={styles.note}>&ldquo;{item.note}&rdquo;</Text> : null}
      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette, TypeColors: TypeColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      gap: 13,
      alignItems: 'flex-start',
    },
    typeIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeIconText: { fontSize: 19 },
    poster: { width: 44, height: 44, borderRadius: 12, backgroundColor: Brand.border },
    body: { flex: 1, minWidth: 0 },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: Brand.ink,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.8,
      color: Brand.muted,
      marginBottom: 6,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
    badge: {
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 9,
    },
    badgeText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    stars: { color: Brand.warm, fontSize: 13.6 },
    date: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    shareBtn: { marginLeft: 'auto', padding: 2 },
    shareBtnText: { fontSize: 14, color: Brand.muted },
    note: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12.8,
      color: '#666',
      marginTop: 5,
    },
  });
}
