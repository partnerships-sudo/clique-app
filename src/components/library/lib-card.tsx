import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { InstagramIcon } from '@/components/share/instagram-icon';
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
        sub: item.sub ?? undefined,
        externalId: item.external_id ?? undefined,
        mediaType: item.media_type ?? undefined,
        extRating: item.ext_rating ?? undefined,
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
          {item.type === 'watch' && item.media_type === 'tv' && item.status === 'watching' ? (
            <Pressable
              style={styles.epBadge}
              hitSlop={8}
              onPress={() => router.push({
                pathname: '/episode-progress-modal',
                params: {
                  itemId: item.id,
                  title: item.title,
                  poster: item.poster ?? undefined,
                  externalId: item.external_id ?? undefined,
                  currentSeason: item.ep_season?.toString() ?? '1',
                  currentEpisode: item.ep_episode?.toString() ?? '1',
                },
              })}>
              <Text style={styles.epBadgeText}>
                {item.ep_season != null ? `S${item.ep_season} E${item.ep_episode}` : '▶ Set progress'}
              </Text>
            </Pressable>
          ) : null}
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
          <Pressable
            style={styles.storyBtn}
            onPress={() =>
              router.push({
                pathname: '/share-card-modal',
                params: {
                  title: item.title,
                  type: item.type,
                  sub: item.sub ?? undefined,
                  poster: item.poster ?? undefined,
                  rating: item.rating ? String(item.rating) : undefined,
                  note: item.note ?? undefined,
                  date: item.date ?? undefined,
                },
              })
            }
            hitSlop={8}>
            <InstagramIcon size={16} />
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
      paddingVertical: 10,
      paddingHorizontal: 12,
      flexDirection: 'row',
      gap: 12,
      alignItems: 'center',
    },
    typeIcon: {
      width: 48,
      height: 64,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeIconText: { fontSize: 19 },
    poster: { width: 48, height: 64, borderRadius: 8, backgroundColor: Brand.border },
    body: { flex: 1, minWidth: 0 },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.ink,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginBottom: 4,
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
    epBadge: { backgroundColor: Brand.tlight, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
    epBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.trust, textTransform: 'uppercase', letterSpacing: 0.4 },
    stars: { color: Brand.warm, fontSize: 13.6 },
    date: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    shareBtn: { marginLeft: 'auto', padding: 2 },
    storyBtn: { padding: 2 },
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
