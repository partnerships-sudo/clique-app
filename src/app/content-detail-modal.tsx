import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDecay } from 'react-native-reanimated';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useContentDetails, type ContentDetails } from '@/features/content/api';
import { getWhereToFindConfig } from '@/features/where-to-find/links';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const HERO_H = 200;
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
  }>();

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const { data: details, isLoading } = useContentDetails(params.title, params.type);
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const typeConfig = TypeColors[params.type ?? 'watch'];
  const whereConfig = getWhereToFindConfig(params.type ?? 'watch', params.title ?? '');

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
      <View style={styles.sheet}>
        {/* ── Hero banner ── */}
        <View style={styles.hero}>
          {params.poster ? (
            <Image
              source={{ uri: params.poster }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, styles.heroBg, { backgroundColor: typeConfig.bg }]}>
              <Text style={styles.heroBgEmoji}>{typeConfig.icon}</Text>
            </View>
          )}
          {/* gradient bleed */}
          <LinearGradient
            colors={['transparent', Brand.paper]}
            style={styles.heroGradient}
          />
        </View>

        {/* ── Body ── */}
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} showsVerticalScrollIndicator={false}>
          {/* Title + sub always at top */}
          <Text style={styles.titleText} numberOfLines={3}>{params.title}</Text>
          {params.sub ? <Text style={styles.subText} numberOfLines={2}>{params.sub}</Text> : null}

          {isLoading ? (
            <ActivityIndicator color={Brand.trust} style={{ marginTop: 12, marginBottom: 16 }} />
          ) : (
            <>
              {/* Rating + meta row */}
              {details?.rating || details?.year || details?.genre || details?.runtime ? (
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

              {/* Synopsis */}
              {details?.overview ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Synopsis</Text>
                  <Text
                    style={styles.synopsisText}
                    numberOfLines={synopsisExpanded ? undefined : 3}>
                    {details.overview}
                  </Text>
                  <Pressable
                    onPress={() => setSynopsisExpanded((v) => !v)}
                    hitSlop={8}>
                    <Text style={styles.synopsisToggle}>
                      {synopsisExpanded ? 'See less' : 'See more...'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}

              {/* Cast */}
              {details?.cast && details.cast.length > 0 ? (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>Top cast</Text>
                  <CastRow cast={details.cast} />
                </View>
              ) : null}
            </>
          )}

          {/* Where to find — always shown */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{whereConfig.label}</Text>
            {whereConfig.stores.map((store, i) => (
              <Pressable
                key={store.name}
                style={[styles.storeRow, i > 0 && styles.storeRowSpacing]}
                onPress={() => Linking.openURL(store.url).catch(() => {})}>
                <Text style={styles.storeLogo}>{store.logo}</Text>
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
        </ScrollView>

        <Pressable style={styles.doneBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },

  // Hero
  hero: { height: HERO_H, overflow: 'hidden' },
  heroBg: { alignItems: 'center', justifyContent: 'center' },
  heroBgEmoji: { fontSize: 72 },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: HERO_H * 0.35,
  },

  // Body
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },
  titleText: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 22,
    color: Brand.ink,
    lineHeight: 28,
    marginBottom: 3,
  },
  subText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: Brand.muted,
    marginBottom: 12,
  },
  section: { marginBottom: 20 },

  // Rating + meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 16,
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
  storeInfo: { flex: 1, minWidth: 0 },
  storeName: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  storePrice: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 1 },
  storeCta: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  storeCtaText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: '#fff' },

  // Done
  doneBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 'auto',
  },
  doneBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
