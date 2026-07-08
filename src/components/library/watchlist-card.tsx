import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import { extractArtistName } from '@/features/artist/api';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import type { LibraryItem } from '@/features/library/api';
import { WHERE_TO_FIND_CTA } from '@/features/where-to-find/links';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export function WatchlistCard({
  item,
  onLogIt,
  onRemove,
}: {
  item: LibraryItem;
  onLogIt: () => void;
  onRemove: () => void;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand, TypeColors), [Brand, TypeColors]);
  const type = TypeColors[item.type];
  const artistName = item.type === 'listen' ? extractArtistName(item.sub) : null;

  return (
    <View style={styles.card}>
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={styles.poster} />
      ) : (
        <View style={[styles.typeIcon, { backgroundColor: type.bg }]}>
          <Text style={styles.typeIconText}>{type.icon}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{item.title}</Text>
          <Pressable style={styles.logBtn} onPress={onLogIt}>
            <Text style={styles.logBtnText}>✓ Log it</Text>
          </Pressable>
        </View>
        {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
        {item.rec_from_user_name ? (
          <View style={styles.recRow}>
            <Text style={styles.recFrom}>Rec by {item.rec_from_user_name}</Text>
            {item.rec_compat_score != null ? (
              <View style={[styles.recCompatBadge, { backgroundColor: compatColor(item.rec_compat_score) + '1A' }]}>
                <Text style={[styles.recCompatText, { color: compatColor(item.rec_compat_score) }]}>
                  {compatEmoji(item.rec_compat_score)} {item.rec_compat_score}%
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {item.note ? <Text style={styles.note}>&ldquo;{item.note}&rdquo;</Text> : null}
        <View style={styles.ctaRow}>
          <Pressable
            style={[styles.whereBtn, { backgroundColor: type.color }]}
            onPress={() =>
              router.push({
                pathname: '/where-to-find-modal',
                params: { title: item.title, type: item.type, poster: item.poster ?? undefined },
              })
            }>
            <Text style={styles.whereBtnText}>{WHERE_TO_FIND_CTA[item.type]}</Text>
          </Pressable>
          {artistName ? (
            <Pressable
              style={styles.artistBtn}
              onPress={() => router.push({ pathname: '/artist-modal', params: { artist: artistName } })}>
              <Text style={styles.artistBtnText}>🎤 Artist info</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.bottomRow}>
          {item.date ? <Text style={styles.date}>Added {item.date}</Text> : null}
          <Pressable style={styles.removeBtn} onPress={onRemove}>
            <Text style={styles.removeBtnText}>✕ Remove</Text>
          </Pressable>
        </View>
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: Brand.ink,
      flexShrink: 1,
    },
    logBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 10,
      paddingVertical: 4,
      paddingHorizontal: 9,
      marginLeft: 'auto',
    },
    logBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: '#fff',
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.8,
      color: Brand.muted,
    },
    recRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 4,
      flexWrap: 'wrap',
    },
    recFrom: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.trust,
    },
    recCompatBadge: {
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 7,
    },
    recCompatText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10.5,
    },
    note: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12.8,
      color: '#666',
      marginTop: 5,
    },
    ctaRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    whereBtn: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 13,
    },
    whereBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#fff',
    },
    artistBtn: {
      alignSelf: 'flex-start',
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 13,
      backgroundColor: Brand.tlight,
    },
    artistBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.trust,
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 6,
    },
    date: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },
    removeBtn: { marginLeft: 'auto' },
    removeBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: '#E84F4F',
    },
  });
}
