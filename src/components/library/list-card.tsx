import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { ListSummary } from '@/features/lists/api';

interface Props {
  list: ListSummary;
  Brand: BrandPalette;
  onPress: () => void;
  onLongPress?: () => void;
}

export function ListCard({ list, Brand, onPress, onLongPress }: Props) {
  const styles = makeStyles(Brand);
  const posters = list.cover_posters.slice(0, 4);

  return (
    <Pressable style={styles.card} onPress={onPress} onLongPress={onLongPress}>
      {/* Mosaic cover */}
      <View style={styles.mosaic}>
        {posters.length === 0 && <View style={[styles.mosaicFill, styles.emptyMosaic]} />}
        {posters.length === 1 && (
          <Image source={{ uri: posters[0]! }} style={styles.mosaicFill} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[0]!} />
        )}
        {posters.length === 2 && (
          <View style={styles.mosaicRow}>
            <Image source={{ uri: posters[0]! }} style={styles.mosaicHalf} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[0]!} />
            <Image source={{ uri: posters[1]! }} style={styles.mosaicHalf} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[1]!} />
          </View>
        )}
        {posters.length === 3 && (
          <View style={styles.mosaicRow}>
            <Image source={{ uri: posters[0]! }} style={styles.mosaicHalf} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[0]!} />
            <View style={styles.mosaicCol}>
              <Image source={{ uri: posters[1]! }} style={styles.mosaicQuarter} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[1]!} />
              <Image source={{ uri: posters[2]! }} style={styles.mosaicQuarter} contentFit="cover" cachePolicy="memory-disk" recyclingKey={posters[2]!} />
            </View>
          </View>
        )}
        {posters.length >= 4 && (
          <View style={styles.mosaicGrid}>
            {posters.map((p, i) => (
              <Image key={i} source={{ uri: p! }} style={styles.mosaicQuarterGrid} contentFit="cover" cachePolicy="memory-disk" recyclingKey={p!} />
            ))}
          </View>
        )}
        {/* Privacy pill */}
        {!list.is_public && (
          <View style={styles.privatePill}>
            <Text style={styles.privateText}>Private</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{list.title}</Text>
        <Text style={styles.count}>
          {list.item_count} {list.item_count === 1 ? 'item' : 'items'}
        </Text>
        {!!list.description && (
          <Text style={styles.desc} numberOfLines={2}>{list.description}</Text>
        )}
      </View>
    </Pressable>
  );
}

const MOSAIC_SIZE = 110;

function makeStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      gap: 14,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      alignItems: 'flex-start',
    },
    mosaic: {
      width: MOSAIC_SIZE,
      height: MOSAIC_SIZE,
      borderRadius: 10,
      overflow: 'hidden',
      backgroundColor: Brand.border,
      flexShrink: 0,
    },
    mosaicFill: { width: '100%', height: '100%' },
    emptyMosaic: { backgroundColor: Brand.border },
    mosaicRow: { flex: 1, flexDirection: 'row' },
    mosaicHalf: { flex: 1, height: MOSAIC_SIZE },
    mosaicCol: { flex: 1, flexDirection: 'column' },
    mosaicQuarter: { flex: 1 },
    mosaicGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
    mosaicQuarterGrid: { width: '50%', height: MOSAIC_SIZE / 2 },
    privatePill: {
      position: 'absolute',
      bottom: 5,
      left: 5,
      backgroundColor: 'rgba(0,0,0,0.55)',
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    privateText: { fontFamily: BrandFonts.interMedium, fontSize: 9, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.4 },
    info: { flex: 1, paddingTop: 4 },
    title: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, marginBottom: 2 },
    count: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginBottom: 5 },
    desc: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.ink, lineHeight: 18 },
  });
}
