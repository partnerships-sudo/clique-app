import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useCinemaDetails } from '@/features/movies/api';
import { getWhereToFindConfig, type StoreLink } from '@/features/where-to-find/links';
import { useBrand } from '@/hooks/use-brand';

export default function WhereToFindModal() {
  const params = useLocalSearchParams<{
    title: string;
    type: EntryType | 'cinema';
    poster?: string;
    tmdbId?: string;
  }>();
  const config = getWhereToFindConfig(params.type ?? 'watch', params.title ?? '');
  const { data: cinemaDetails } = useCinemaDetails(
    params.type === 'cinema' ? params.tmdbId : undefined,
  );
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function openStore(store: StoreLink) {
    Linking.openURL(store.url).catch(() => {});
  }

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <View style={styles.sheet}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          <LinearGradient
            colors={config.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {params.poster ? (
            <Image source={{ uri: params.poster }} style={styles.heroPoster} />
          ) : (
            <View style={styles.heroPoster}>
              <Text style={styles.heroPosterEmoji}>{config.emoji}</Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.heroTitle} numberOfLines={2}>
              {params.title}
            </Text>
            <Text style={styles.heroMeta}>{config.label}</Text>
          </View>
        </View>

        {/* ── Cinema: synopsis + cast ── */}
        {cinemaDetails ? (
          <View style={styles.cinemaSection}>
            {cinemaDetails.overview ? (
              <View style={styles.synopsisBlock}>
                <Text
                  style={styles.synopsisText}
                  numberOfLines={synopsisExpanded ? undefined : 3}>
                  {cinemaDetails.overview}
                </Text>
                <Pressable onPress={() => setSynopsisExpanded((v) => !v)} hitSlop={6}>
                  <Text style={styles.synopsisToggle}>
                    {synopsisExpanded ? 'See less' : 'See more'}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {cinemaDetails.cast.length > 0 ? (
              <View style={styles.castSection}>
                <Text style={styles.castLabel}>Top cast</Text>
                <View style={styles.castRow}>
                  {cinemaDetails.cast.map((actor) => (
                    <View key={actor.name} style={styles.actorItem}>
                      {actor.profilePath ? (
                        <Image source={{ uri: actor.profilePath }} style={styles.actorCircle} />
                      ) : (
                        <View style={[styles.actorCircle, styles.actorFallback]}>
                          <Text style={styles.actorFallbackText}>👤</Text>
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
                </View>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Store links ── */}
        <View style={styles.content}>
          <Text style={styles.secLbl}>{config.label}</Text>
          {config.stores.map((store, i) => (
            <Pressable
              key={store.name}
              style={[styles.row, i > 0 ? styles.rowSpacing : undefined]}
              onPress={() => openStore(store)}>
              <Text style={styles.logo}>{store.logo}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{store.name}</Text>
                <Text style={styles.price}>{store.price}</Text>
              </View>
              <View style={[styles.cta, { backgroundColor: store.color }]}>
                <Text style={styles.ctaText}>{store.cta}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>
    </>
  );
}

const ACTOR_SIZE = 58;

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },

  // Hero
  hero: {
    height: 150,
    padding: Spacing.four,
    paddingTop: 28,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-end',
  },
  heroPoster: {
    width: 64,
    height: 90,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPosterEmoji: { fontSize: 30 },
  heroInfo: { flex: 1, minWidth: 0 },
  heroTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 19, color: '#fff' },
  heroMeta: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },

  // Cinema section
  cinemaSection: {
    paddingHorizontal: Spacing.three,
    paddingTop: 14,
    paddingBottom: 6,
  },
  synopsisBlock: { marginBottom: 12 },
  synopsisText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: Brand.ink,
    lineHeight: 19,
  },
  synopsisToggle: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12,
    color: Brand.trust,
    marginTop: 4,
  },
  castSection: { marginBottom: 4 },
  castLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 10,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  castRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actorItem: { alignItems: 'center', width: ACTOR_SIZE + 12 },
  actorCircle: {
    width: ACTOR_SIZE,
    height: ACTOR_SIZE,
    borderRadius: ACTOR_SIZE / 2,
    backgroundColor: Brand.border,
  },
  actorFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: Brand.tlight },
  actorFallbackText: { fontSize: 22 },
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
    lineHeight: 12,
  },

  // Store list
  content: { paddingHorizontal: Spacing.three, paddingBottom: 8, paddingTop: 4 },
  secLbl: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 13,
  },
  rowSpacing: { marginTop: 8 },
  logo: { fontSize: 21, width: 28, textAlign: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
  price: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  cta: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  ctaText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: '#fff' },

  // Done
  closeBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    marginTop: 'auto',
    marginBottom: Spacing.three,
  },
  closeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
