import { router } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type TypeColorPalette } from '@/constants/theme';
import { extractArtistName } from '@/features/artist/api';
import type { FriendWatchlistItem } from '@/features/library/api';
import { WHERE_TO_FIND_CTA } from '@/features/where-to-find/links';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export function FriendRecCard({
  item,
  onAdd,
}: {
  item: FriendWatchlistItem;
  onAdd: () => void;
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
        <Text style={styles.title}>{item.title}</Text>
        {item.sub ? <Text style={styles.sub}>{item.sub}</Text> : null}
        <Text style={styles.recommendedBy}>👥 Recommended by {item.recommendedBy}</Text>
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
        <Pressable style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>+ Add to my watchlist</Text>
        </Pressable>
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
    },
    recommendedBy: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.trust,
      marginTop: 4,
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
    addBtn: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.ink,
      borderRadius: 10,
      paddingVertical: 7,
      paddingHorizontal: 13,
      marginTop: 8,
    },
    addBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#fff',
    },
  });
}
