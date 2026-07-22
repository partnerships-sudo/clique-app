import React, { useEffect, useRef } from 'react';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useAudioPlayer } from 'expo-audio';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withDecay } from 'react-native-reanimated';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useContentDetails, type ContentDetails } from '@/features/content/api';
import { getWhereToFindConfig } from '@/features/where-to-find/links';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const ACTOR_SIZE = 52;

function PodcastEpisodeRow({ cast, styles }: { cast: ContentDetails['cast']; styles: ReturnType<typeof createStyles> }) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const player = useAudioPlayer(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (stopTimer.current) clearTimeout(stopTimer.current);
      try { player.pause(); } catch { /* ignore */ }
    };
  }, []);

  function handlePress(i: number) {
    const ep = cast[i];
    if (!ep.previewUrl) return;
    const isTrailer = ep.character === 'Trailer';

    if (!isTrailer) {
      Linking.openURL(ep.previewUrl).catch(() => {});
      return;
    }

    if (playingIndex === i) {
      player.pause();
      if (stopTimer.current) clearTimeout(stopTimer.current);
      setPlayingIndex(null);
    } else {
      player.replace({ uri: ep.previewUrl });
      player.play();
      setPlayingIndex(i);
      if (stopTimer.current) clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(() => {
        player.pause();
        setPlayingIndex(null);
      }, 30000);
    }
  }

  return (
    <View style={styles.episodeList}>
      {cast.map((ep, i) => (
        <Pressable key={`${i}-${ep.name}`} style={styles.episodeRow} onPress={() => handlePress(i)}>
          <View style={styles.episodeThumbWrap}>
            {ep.profilePath ? (
              <Image source={{ uri: ep.profilePath }} style={styles.episodeThumb} />
            ) : (
              <View style={[styles.episodeThumb, styles.actorFallback]}>
                <Text style={styles.actorFallbackEmoji}>🎙️</Text>
              </View>
            )}
            {ep.previewUrl ? (
              <View style={styles.trackPlayOverlay}>
                <SymbolView name={playingIndex === i ? 'pause.fill' : 'play.fill'} size={14} tintColor="#fff" type="monochrome" />
              </View>
            ) : null}
          </View>
          <View style={styles.episodeInfo}>
            <Text style={styles.episodeName} numberOfLines={2}>{ep.name}</Text>
            {ep.character ? <Text style={styles.episodeDate}>{ep.character}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function MusicTrackRow({ cast, styles }: { cast: ContentDetails['cast']; styles: ReturnType<typeof createStyles> }) {
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const player = useAudioPlayer(null);

  useEffect(() => {
    return () => { try { player.pause(); } catch { /* ignore */ } };
  }, []);

  function handlePress(index: number) {
    const track = cast[index];
    if (!track.previewUrl) return;
    if (playingIndex === index) {
      player.pause();
      setPlayingIndex(null);
    } else {
      player.replace({ uri: track.previewUrl });
      player.play();
      setPlayingIndex(index);
    }
  }

  return (
    <View style={styles.castRowFit}>
      {cast.map((track, i) => (
        <Pressable key={`${i}-${track.name}`} style={styles.actorItemFit} onPress={() => handlePress(i)}>
          <View style={styles.trackThumbWrap}>
            {track.profilePath ? (
              <Image source={{ uri: track.profilePath }} style={[styles.actorCircle, styles.actorSquare]} />
            ) : (
              <View style={[styles.actorCircle, styles.actorSquare, styles.actorFallback]}>
                <Text style={styles.actorFallbackEmoji}>🎵</Text>
              </View>
            )}
            {track.previewUrl ? (
              <View style={styles.trackPlayOverlay}>
                <SymbolView name={playingIndex === i ? 'pause.fill' : 'play.fill'} size={14} tintColor="#fff" type="monochrome" />
              </View>
            ) : null}
          </View>
          <Text style={styles.actorName} numberOfLines={2}>{track.name}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function CastRow({ cast, square, fit }: { cast: ContentDetails['cast']; square?: boolean; fit?: boolean }) {
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

  if (fit) {
    return <MusicTrackRow cast={cast} styles={styles} />;
  }

  return (
    <View style={styles.castViewport} onLayout={(e) => setContainerW(e.nativeEvent.layout.width)}>
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[styles.castRow, rowStyle]}
          onLayout={(e) => setContentW(e.nativeEvent.layout.width)}>
          {cast.map((actor) => (
            <View key={actor.name} style={styles.actorItem}>
              {actor.profilePath ? (
                <Image source={{ uri: actor.profilePath }} style={[styles.actorCircle, square && styles.actorSquare]} />
              ) : (
                <View style={[styles.actorCircle, square && styles.actorSquare, styles.actorFallback]}>
                  <Text style={styles.actorFallbackEmoji}>{square ? '🎵' : '👤'}</Text>
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
    mediaType?: string;
  }>();

  const [synopsisExpanded, setSynopsisExpanded] = useState(false);
  const [synopsisTruncated, setSynopsisTruncated] = useState(false);
  const [authorBioExpanded, setAuthorBioExpanded] = useState(false);
  const [authorBioTruncated, setAuthorBioTruncated] = useState(false);

  // Some entries (especially from friend collections) store 'tv' or 'movie'
  // as the type instead of the app's EntryType 'watch'. Normalise here.
  const resolvedType: EntryType =
    params.type === 'tv' || params.type === 'movie' ? 'watch' : (params.type as EntryType);
  const resolvedMediaType: string | undefined =
    params.type === 'tv' ? 'tv' : params.type === 'movie' ? 'movie' : params.mediaType;

  const { data: details, isLoading } = useContentDetails(params.title, resolvedType, params.externalId, resolvedMediaType);

  // For podcasts, show first host name in meta row as a preview
  const podcastHost = resolvedType === 'podcast'
    ? (() => {
        const raw = details?.hosts?.[0]?.name ?? (params.sub?.split('·')[0]?.trim() || null);
        if (!raw) return null;
        return raw === raw.toUpperCase()
          ? raw.replace(/\b\w/g, (c) => c.toUpperCase()).toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
          : raw;
      })()
    : null;
  const insets = useSafeAreaInsets();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function navigateToLog(intent: 'log' | 'watchlist') {
    router.push({
      pathname: '/log-modal',
      params: {
        intent,
        prefillTitle: params.title ?? '',
        prefillType: resolvedType,
        prefillSub: params.sub ?? '',
        prefillPoster: params.poster ?? '',
        prefillExternalId: params.externalId ?? '',
        prefillMediaType: resolvedMediaType ?? '',
      },
    });
  }
  const typeConfig = TypeColors[resolvedType ?? 'watch'];
  const whereConfig = getWhereToFindConfig(resolvedType ?? 'watch', params.title ?? '', params.externalId);
  const usingRealProviders =
    !!details && (resolvedType === 'watch' || resolvedType === 'play') && (details.watchProviders?.length ?? 0) > 0;
  // For watch/play, if TMDB loaded but returned no providers (e.g. theatrical release,
  // not yet on streaming), only show JustWatch so users can check current availability
  // themselves — don't show platforms the content isn't actually on.
  const noStreamingYet = !!details && resolvedType === 'watch' && (details.watchProviders?.length ?? 0) === 0;
  const q = encodeURIComponent(params.title ?? '');
  const justWatchOnly = [{
    name: 'JustWatch',
    logo: '🎬',
    logoUrl: 'https://www.google.com/s2/favicons?domain=justwatch.com&sz=64',
    price: 'Check current availability & showtimes',
    cta: 'Find on JustWatch',
    color: '#0E0E10',
    url: `https://www.justwatch.com/us/search?q=${q}`,
  }];
  const stores = usingRealProviders ? details!.watchProviders : noStreamingYet ? justWatchOnly : whereConfig.stores;
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
      <View style={[styles.sheet, styles.body]} collapsable={false}>
        <View style={styles.modalHeader} collapsable={false}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 16, right: 8 }} activeOpacity={0.6}>
            <Text style={styles.modalDoneBtn}>Done</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.scrollContainer} collapsable={false}>
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 88 }}>
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
              ) : details?.rating || details?.year || details?.genre || details?.runtime || podcastHost ? (
                <View style={styles.metaRow}>
                  {(() => {
                    // Books already show year in the sub line — skip it in meta row
                    const yearInSub = resolvedType === 'read' && params.sub?.includes(details?.year ?? '---');
                    const items = [
                      details?.rating ? { key: 'rating', isPill: true, value: `★ ${details.rating}` } : null,
                      podcastHost ? { key: 'host', isPill: false, value: podcastHost } : null,
                      details?.year && !yearInSub ? { key: 'year', isPill: false, value: details.year } : null,
                      details?.genre ? { key: 'genre', isPill: false, value: details.genre } : null,
                      details?.runtime ? { key: 'runtime', isPill: false, value: details.runtime } : null,
                    ].filter(Boolean) as { key: string; isPill: boolean; value: string }[];
                    return items.map((item, i) => (
                      <React.Fragment key={item.key}>
                        {i > 0 && <Text style={styles.metaDot}>·</Text>}
                        {item.isPill ? (
                          <View style={styles.ratingPill}>
                            <Text style={styles.ratingPillText}>{item.value}</Text>
                          </View>
                        ) : (
                          <Text style={styles.metaText}>{item.value}</Text>
                        )}
                      </React.Fragment>
                    ));
                  })()}
                </View>
              ) : null}
              {!isLoading && resolvedType === 'read' && (details?.awards?.length ?? 0) > 0 ? (
                <View style={styles.awardsRow}>
                  {details!.awards.map((award) => (
                    <View key={award} style={styles.awardBadge}>
                      <Text style={styles.awardBadgeText}>{award}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>

          {/* Synopsis / About */}
          {!isLoading && details?.overview ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{resolvedType === 'podcast' || resolvedType === 'read' ? 'About' : resolvedType === 'listen' ? 'About the Artist' : 'Synopsis'}</Text>
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

          {/* Hosted by (podcasts) */}
          {!isLoading && resolvedType === 'podcast' && details?.hosts && details.hosts.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Hosted by</Text>
              <View style={styles.castRow}>
                {details.hosts.map((host) => (
                  <View key={host.name} style={styles.actorItem}>
                    {host.photoUrl ? (
                      <Image source={{ uri: host.photoUrl }} style={styles.actorCircle} />
                    ) : (
                      <View style={[styles.actorCircle, styles.actorFallback]}>
                        <Text style={styles.actorFallbackEmoji}>🎙</Text>
                      </View>
                    )}
                    <Text style={styles.actorName} numberOfLines={2}>{host.name}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Author (books) */}
          {!isLoading && resolvedType === 'read' && details?.author ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Author</Text>
              <View style={styles.authorRow}>
                {details.author.photoUrl ? (
                  <Image source={{ uri: details.author.photoUrl }} style={styles.authorPhoto} />
                ) : (
                  <View style={[styles.authorPhoto, styles.actorFallback]}>
                    <Text style={styles.actorFallbackEmoji}>✍️</Text>
                  </View>
                )}
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{details.author.name}</Text>
                  {details.author.bio ? (
                    <>
                      <Text
                        style={[styles.authorBio, styles.synopsisMeasure]}
                        onTextLayout={(e) => setAuthorBioTruncated(e.nativeEvent.lines.length > 3)}>
                        {details.author.bio}
                      </Text>
                      <Text
                        style={styles.authorBio}
                        numberOfLines={authorBioExpanded ? undefined : 3}>
                        {details.author.bio}
                      </Text>
                      {authorBioTruncated ? (
                        <Text
                          style={styles.synopsisToggle}
                          onPress={() => setAuthorBioExpanded((v) => !v)}>
                          {authorBioExpanded ? 'See less...' : 'See more...'}
                        </Text>
                      ) : null}
                    </>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Developer (games) */}
          {!isLoading && resolvedType === 'play' && details?.developer ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Developer</Text>
              <View style={styles.authorRow}>
                {details.developer.logoUrl ? (
                  <Image source={{ uri: details.developer.logoUrl }} style={styles.developerLogo} resizeMode="contain" />
                ) : (
                  <View style={[styles.developerLogo, styles.actorFallback]}>
                    <Text style={styles.actorFallbackEmoji}>🎮</Text>
                  </View>
                )}
                <View style={styles.authorInfo}>
                  <Text style={styles.authorName}>{details.developer.name}</Text>
                </View>
              </View>
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
                  <SymbolView name="play.fill" size={20} tintColor="#fff" type="monochrome" />
                </View>
              </Pressable>
            </View>
          ) : null}

          {/* Cast / Key Staff */}
          {!isLoading && details?.cast && details.cast.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{resolvedType === 'play' ? 'Key Staff' : resolvedType === 'listen' ? 'Top Tracks' : resolvedType === 'podcast' ? 'Episodes' : 'Top Cast'}</Text>
              {resolvedType === 'podcast'
                ? <PodcastEpisodeRow cast={details.cast} styles={styles} />
                : <CastRow cast={details.cast} square={resolvedType === 'listen'} fit={resolvedType === 'listen'} />}
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
        <View style={[styles.actionBar, { position: 'absolute', bottom: 0, left: 0, right: 0, paddingBottom: (insets.bottom || 16) }]}>
          <Pressable style={styles.watchlistBtn} onPress={() => navigateToLog('watchlist')}>
            <Text style={styles.watchlistBtnText}>+ Watchlist</Text>
          </Pressable>
          <Pressable style={styles.logBtn} onPress={() => navigateToLog('log')}>
            <Text style={styles.logBtnText}>Log it</Text>
          </Pressable>
        </View>
        </View>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },

  // Done button strip
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 6,
    zIndex: 10,
  },
  modalDoneBtn: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 16,
    color: Brand.trust,
  },

  // Body
  body: { flex: 1 },
  scrollContainer: { flex: 1 },
  scrollArea: { flex: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 16 },

  // Action bar
  actionBar: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Brand.border,
    backgroundColor: Brand.paper,
  },
  watchlistBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  watchlistBtnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14.5,
    color: Brand.trust,
  },
  logBtn: {
    flex: 1,
    backgroundColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  logBtnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14.5,
    color: '#fff',
  },

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

  // Rating + meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  awardsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  awardBadge: {
    backgroundColor: 'rgba(184,154,0,0.12)',
    borderWidth: 1,
    borderColor: '#B89A00',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  awardBadgeText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 10,
    color: '#8B7500',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
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
  metaDot: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.8,
    color: Brand.border,
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
  actorSquare: { borderRadius: 8 },
  episodeList: { gap: 12 },
  episodeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  episodeThumbWrap: { position: 'relative' },
  episodeThumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: Brand.border },
  episodeInfo: { flex: 1 },
  episodeName: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.ink, lineHeight: 18 },
  episodeDate: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 2 },
  castRowFit: { flexDirection: 'row', justifyContent: 'space-between' },
  actorItemFit: { alignItems: 'center', flex: 1 },
  trackThumbWrap: { position: 'relative' },
  trackPlayOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 8,
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

  // Author (books)
  authorRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  authorPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Brand.border,
  },
  developerLogo: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: Brand.border,
  },
  authorInfo: { flex: 1, minWidth: 0 },
  authorName: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: Brand.ink,
    marginBottom: 4,
  },
  authorBio: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.5,
    color: Brand.muted,
    lineHeight: 18,
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
