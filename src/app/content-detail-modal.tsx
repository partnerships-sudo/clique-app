import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDecay } from 'react-native-reanimated';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useContentDetails, type ContentDetails } from '@/features/content/api';
import { getWhereToFindConfig } from '@/features/where-to-find/links';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const ACTOR_SIZE = 52;

function CastRow({ cast }: { cast: ContentDetails['cast'] }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [containerW, setContainerW] = useState(0);
  const [contentW, setContentW] = useState(0);
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const maxOffset = Math.max(0, contentW - containerW);

  const pan = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-maxOffset, startX.value + e.translationX));
    })
    .onEnd((e) => {
      translateX.value = withDecay({ velocity: e.velocityX, clamp: [-maxOffset, 0] });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.castViewport} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.castRow, rowStyle]}
          onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>
          {cast.map((actor) => (
            <View key={actor.name} style={styles.actorItem}>
              {actor.profilePath ? (
                <Image source={{ uri: actor.profilePath }} style={styles.actorCircle} />
              ) : (
                <View style={[styles.actorCircle, styles.actorFallback]}>
                  <Text style={styles.actorFallbackEmoji}>👤</Text>
                </View>
              )}
              <Text style={styles.actorName} numberOfLines={2}>
                {actor.name}
              </Text>
              {actor.character ? (
                <Text style={styles.actorCharacter} numberOfLines={1}>
                  {actor.character}
                </Text>
              ) : null}
            </View>
          ))}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

export default function ContentDetailModal() {
  const params = useLocalSearchParams<{
    title: string;
    type: EntryType;
    poster?: string;
    sub?: string;
    externalId?: string;
  }>();

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [synopsisTruncated, setSynopsisTruncated] = useState(false);
  const { data: details, isLoading } = useContentDetails(params.title, params.type);
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const typeConfig = TypeColors[params.type ?? 'watch'];
  const whereConfig = getWhereToFindConfig(params.type ?? 'watch', params.title ?? '', params.externalId);
  const usingRealProviders =
    (params.type === 'watch' || params.type === 'play') && (details?.watchProviders?.length ?? 0) > 0;
  const stores = usingRealProviders ? details!.watchProviders : whereConfig.stores;
  // TMDB/Google Books/IGDB posters are all ~2:3, Spotify music/podcast art
  // is exactly 1:1 — forcing music/podcasts into a 2:3 box would crop the
  // square art, so they get their own matching box instead.
  const isSquareCover = params.type === 'listen' || params.type === 'podcast';

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.92],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <ScrollView style={[styles.sheet, styles.body]} showsVerticalScrollIndicator={false}>
        <View style={styles.bodyContent}>
          {/* Poster on the left (kept in its natural aspect ratio, never
              stretched), title + meta on the right. */}
          <View style={styles.headerRow}>
            <View
              style={[styles.posterBox, isSquareCover && styles.posterBoxSquare]}>
              {params.poster ? (
                <Image source={{ uri: params.poster }} style={styles.posterImg} resizeMode="cover" />
              ) : (
                <View style={[styles.posterImg, styles.posterFallback, { backgroundColor: typeConfig.bg }]}>
                  <Text style={styles.posterFallbackEmoji}>{typeConfig.icon}</Text>
                </View>
              )}
            </View>
            <View style={styles.headerInfo}>
              <Text style={styles.titleText} numberOfLines={4}>{params.title}</Text>
              {params.sub ? <Text style={styles.subText} numberOfLines={2}>{params.sub}</Text> : null}
              {isLoading ? (
                <ActivityIndicator color={Brand.trust} style={styles.headerLoading} />
              ) : details?.rating || details?.year || details?.genre || details?.runtime ? (
                <View style={styles.metaRow}>
                  {details?.rating ? (
                    <View style={styles.ratingPill}>
                      <Text style={styles.ratingPillText}>★ {details.rating}</Text>
                    </View>
                  ) : null}
                  {details?.year ? <Text style={styles.metaText}>{details.year}</Text> : null}
                  {details?.genre ? <Text style={styles.metaText}>{details.genre}</Text> : null}
                  {details?.runtime ? <Text style={styles.metaText}>{details.runtime}</Text> : null}
                </View>
              ) : null}
            </View>
          </View>

          {/* Synopsis */}
          {!isLoading && details?.overview ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Synopsis</Text>
              {/* Invisible full-height measurer: tells us whether the text
                  actually overflows 3 lines, so we only show the toggle
                  when there's really more to reveal. */}
              <Text
                style={[styles.synopsisText, styles.synopsisMeasure]}
                onTextLayout={(e) => setSynopsisTruncated(e.nativeEvent.lines.length > 3)}>
                {details.overview}
              </Text>
              <Text
                style={styles.synopsisText}
                numberOfLines={synopsisExpanded ? undefined : 3}>
                {details.overview}
              </Text>
              {synopsisTruncated ? (
                <Pressable
                  onPress={() => setSynopsisExpanded((v) => !v)}
                  hitSlop={8}>
                  <Text style={styles.synopsisToggle}>
                    {synopsisExpanded ? 'See less' : 'See more...'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {/* Trailer */}
          {!isLoading && details?.trailerUrl && details?.trailerThumbnail ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Trailer</Text>
              <Pressable
                onPress={() => Linking.openURL(details.trailerUrl!).catch(() => {})}
                style={styles.trailerContainer}>
                <Image source={{ uri: details.trailerThumbnail }} style={styles.trailerThumb} resizeMode="cover" />
                <View style={styles.trailerPlayBtn}>
                  <Text style={styles.trailerPlayIcon}>▶</Text>
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* Cast */}
          {!isLoading && details?.cast && details.cast.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Top cast</Text>
              <CastRow cast={details.cast} />
            </View>
          ) : null}

          {/* Where to find — always shown */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{whereConfig.label}</Text>
            {usingRealProviders && params.type === 'watch' ? (
              <Text style={styles.providerAttribution}>Availability powered by JustWatch</Text>
            ) : null}
            {stores.map((store, i) => (
              <Pressable
                key={store.name}
                style={[styles.storeRow, i > 0 && styles.storeRowSpacing]}
                onPress={() => Linking.openURL(store.url).catch(() => {})}>
                {store.logoUrl ? (
                  <Image source={{ uri: store.logoUrl }} style={styles.storeLogoImg} />
                ) : (
                  <Text style={styles.storeLogo}>{store.logo}</Text>
                )}
                <View style={styles.storeInfo}>
                  <Text style={styles.storeName}>{store.name}</Text>
                  <Text style={styles.storePrice}>{store.price}</Text>
                </View>
                <View style={[styles.storeCta, { backgroundColor: store.color }]}>
                  <Text style={styles.storeCtaText}>{store.cta}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },

  // Header: poster (kept in its natural aspect ratio) + title/meta side by side
  headerRow: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  posterBox: {
    width: 100,
    height: 150,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Brand.border,
  },
  posterBoxSquare: { width: 130, height: 130 },
  posterImg: { width: '100%', height: '100%' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterFallbackEmoji: { fontSize: 40 },
  headerInfo: { flex: 1, minWidth: 0, justifyContent: 'flex-start', paddingTop: 2 },
  headerLoading: { marginTop: 8, alignSelf: 'flex-start' },
  titleText: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: Brand.ink,
    lineHeight: 25,
    marginBottom: 3,
  },
  subText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: Brand.muted,
    marginBottom: 8,
  },
  section: { marginBottom: 20 },
  trailerContainer: { borderRadius: 12, overflow: 'hidden', aspectRatio: 16 / 9, backgroundColor: '#000' },
  trailerThumb: { width: '100%', height: '100%' },
  trailerPlayBtn: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  trailerPlayIcon: { fontSize: 36, color: '#fff' },

  // Rating + meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  ratingPill: {
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  ratingPillText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: '#CC9900',
  },
  metaText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.8,
    color: Brand.muted,
  },
  sectionLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 10,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
  },

  // Synopsis
  synopsisText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.5,
    color: Brand.ink,
    lineHeight: 20,
  },
  synopsisMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
  },
  synopsisToggle: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12.5,
    color: Brand.trust,
    marginTop: 5,
  },

  // Cast
  castViewport: { overflow: 'hidden' },
  castRow: { flexDirection: 'row', gap: 14, alignSelf: 'flex-start' },
  actorItem: { alignItems: 'center', width: ACTOR_SIZE + 12 },
  actorCircle: {
    width: ACTOR_SIZE,
    height: ACTOR_SIZE,
    borderRadius: ACTOR_SIZE / 2,
    backgroundColor: Brand.border,
  },
  actorFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.tlight },
  actorFallbackEmoji: { fontSize: 22 },
  actorName: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 10.5,
    color: Brand.ink,
    textAlign: 'center',
    marginTop: 5,
    lineHeight: 13,
  },
  actorCharacter: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 9.5,
    color: Brand.muted,
    textAlign: 'center',
    marginTop: 2,
  },

  // Store links
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 11,
  },
  storeRowSpacing: { marginTop: 7 },
  storeLogo: { fontSize: 18, width: 24, textAlign: 'center' },
  storeLogoImg: { width: 24, height: 24, borderRadius: 6 },
  storeInfo: { flex: 1, minWidth: 0 },
  storeName: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  storePrice: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 1 },
  storeCta: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  storeCtaText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: '#fff' },
  providerAttribution: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 10,
    color: Brand.muted,
    marginTop: -4,
    marginBottom: 8,
  },
  });
}
