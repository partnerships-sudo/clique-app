import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscussionCard } from '@/components/feed/discussion-card';
import { BrandFonts } from '@/constants/theme';
import { useContentRoomDiscussions } from '@/features/discussions/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const MEDIA_TYPE_LABELS: Record<string, string> = {
  movie: 'Film',
  tv: 'TV',
  book: 'Book',
  game: 'Game',
  album: 'Music',
  podcast: 'Podcast',
};

export default function ContentRoomModal() {
  const { externalId, mediaType, title, poster } = useLocalSearchParams<{
    externalId: string;
    mediaType: string;
    title: string;
    poster?: string;
  }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const { data: discussions = [], isLoading } = useContentRoomDiscussions(externalId, mediaType);

  const typeLabel = MEDIA_TYPE_LABELS[mediaType ?? ''] ?? mediaType ?? '';
  // Map mediaType → TypeColors key
  const tcKey = mediaType === 'movie' || mediaType === 'tv' ? 'watch'
    : mediaType === 'book' ? 'read'
    : mediaType === 'game' ? 'play'
    : mediaType === 'album' ? 'listen'
    : mediaType === 'podcast' ? 'podcast'
    : null;
  const typeColors = tcKey ? (TypeColors as any)[tcKey] : { color: '#6B7280', bg: '#F3F4F6' };

  function handleStart() {
    router.push({
      pathname: '/create-discussion-modal',
      params: { prefillExternalId: externalId, prefillMediaType: mediaType, prefillTitle: title, prefillPoster: poster ?? '' },
    });
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Brand.paper }]} edges={['top']}>
      {/* Nav */}
      <View style={[styles.navBar, { borderBottomColor: Brand.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
          <Text style={[styles.backText, { color: Brand.trust }]}>Back</Text>
        </Pressable>
        <View style={{ width: 60 }} />
      </View>

      <FlatList
        data={discussions}
        keyExtractor={(d) => d.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={() => (
          <View style={styles.header}>
            {/* Poster + info */}
            <View style={styles.heroRow}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.posterPlaceholder, { backgroundColor: typeColors.bg }]}>
                  <SymbolView name="photo" size={28} tintColor={typeColors.color} type="monochrome" style={{ width: 28, height: 28 }} />
                </View>
              )}
              <View style={styles.heroInfo}>
                <View style={[styles.typePill, { backgroundColor: typeColors.bg }]}>
                  <Text style={[styles.typeText, { color: typeColors.color }]}>{typeLabel.toUpperCase()}</Text>
                </View>
                <Text style={[styles.roomTitle, { color: Brand.ink }]}>{title}</Text>
                <Text style={[styles.roomSub, { color: Brand.muted }]}>
                  {discussions.length} {discussions.length === 1 ? 'discussion' : 'discussions'}
                </Text>
              </View>
            </View>

            {/* Start discussion CTA */}
            <Pressable style={[styles.startBtn, { backgroundColor: Brand.trust }]} onPress={handleStart}>
              <SymbolView name="plus" size={13} tintColor="#fff" type="monochrome" style={{ width: 13, height: 13 }} />
              <Text style={styles.startBtnText}>Start a discussion</Text>
            </Pressable>

            {discussions.length > 0 && (
              <Text style={[styles.sectionLabel, { color: Brand.muted }]}>DISCUSSIONS</Text>
            )}
          </View>
        )}
        renderItem={({ item }) => <DiscussionCard item={item} />}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Brand.trust} />
          ) : (
            <View style={[styles.emptyCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
              <Text style={[styles.emptyTitle, { color: Brand.ink }]}>No discussions yet</Text>
              <Text style={[styles.emptySub, { color: Brand.muted }]}>Be the first to start one about {title}</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
  backText: { fontFamily: BrandFonts.interMedium, fontSize: 15 },
  list: { padding: 16, paddingBottom: 40 },
  header: { gap: 14, marginBottom: 8 },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  poster: { width: 72, height: 100, borderRadius: 10, flexShrink: 0 },
  posterPlaceholder: {
    width: 72, height: 100, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  heroInfo: { flex: 1, gap: 6, paddingTop: 2 },
  typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  typeText: { fontFamily: BrandFonts.interMedium, fontSize: 10, letterSpacing: 0.5 },
  roomTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, lineHeight: 26 },
  roomSub: { fontFamily: BrandFonts.interRegular, fontSize: 13 },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 12,
  },
  startBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  sectionLabel: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 11,
    letterSpacing: 0.8,
    marginTop: 4,
  },
  emptyCard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    borderStyle: 'dashed',
    padding: 32,
    gap: 6,
  },
  emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15 },
  emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, textAlign: 'center' },
});
