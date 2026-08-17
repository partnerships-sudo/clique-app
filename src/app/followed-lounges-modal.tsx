import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts } from '@/constants/theme';
import { useFollowedRooms } from '@/features/discussions/api';
import { useBrand } from '@/hooks/use-brand';

export default function FollowedLoungesModal() {
  const Brand = useBrand();
  const { data: rooms = [] } = useFollowedRooms();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Brand.paper }]} edges={['top']}>
      <View style={[styles.nav, { borderBottomColor: Brand.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.navBack, { color: Brand.trust }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: Brand.ink }]}>Your Lounges</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {rooms.length === 0 && (
          <Text style={[styles.empty, { color: Brand.muted }]}>
            You haven't joined any lounges yet. Search for a show or film and follow its room.
          </Text>
        )}
        {rooms.map((room) => (
          <Pressable
            key={`${room.externalId}|${room.mediaType}`}
            style={[styles.row, { backgroundColor: Brand.card, borderColor: Brand.border }]}
            onPress={() => router.push({
              pathname: '/content-room-modal',
              params: {
                externalId: room.externalId,
                mediaType: room.mediaType,
                title: room.contentTitle,
                poster: room.contentPoster ?? '',
              },
            })}>
            {room.contentPoster ? (
              <Image source={{ uri: room.contentPoster }} style={styles.poster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={room.contentPoster} />
            ) : (
              <View style={[styles.poster, { backgroundColor: Brand.tlight }]} />
            )}
            <View style={styles.info}>
              <Text style={[styles.title, { color: Brand.ink }]} numberOfLines={2}>{room.contentTitle}</Text>
              <Text style={[styles.meta, { color: Brand.muted }]}>
                {room.followerCount} {room.followerCount === 1 ? 'follower' : 'followers'}
              </Text>
            </View>
            <Text style={[styles.chevron, { color: Brand.muted }]}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: { fontFamily: BrandFonts.syneBold, fontSize: 16, width: 60 },
  navTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16 },
  list: { padding: 16, gap: 10 },
  empty: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  poster: { width: 44, height: 60, borderRadius: 8, flexShrink: 0 },
  info: { flex: 1 },
  title: { fontFamily: BrandFonts.syneBold, fontSize: 14, lineHeight: 19, marginBottom: 3 },
  meta: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
  chevron: { fontFamily: BrandFonts.syneBold, fontSize: 20 },
});
