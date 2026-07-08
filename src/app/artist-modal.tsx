import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { formatFollowers, useArtistPanel } from '@/features/artist/api';
import { useBrand } from '@/hooks/use-brand';

const MAX_TRACKS_SHOWN = 5;

export default function ArtistModal() {
  const params = useLocalSearchParams<{ artist: string }>();
  const { data, isLoading } = useArtistPanel(params.artist ?? null);
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function openUrl(url: string) {
    if (url) Linking.openURL(url).catch(() => {});
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
        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Brand.trust} />
          </View>
        ) : !data ? (
          <View style={styles.loading}>
            <Text style={styles.notFoundEmoji}>🔍</Text>
            <Text style={styles.notFoundTitle}>Couldn&apos;t find {params.artist} on Spotify</Text>
            <Pressable
              style={styles.fallbackBtn}
              onPress={() => openUrl(`https://open.spotify.com/search/${encodeURIComponent(params.artist ?? '')}`)}>
              <Text style={styles.fallbackBtnText}>Search on Spotify</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.body}>
            <View style={styles.hero}>
              {data.artist.image ? (
                <Image source={{ uri: data.artist.image }} style={styles.heroImg} />
              ) : (
                <View style={[styles.heroImg, styles.heroImgFallback]}>
                  <Text style={styles.heroImgEmoji}>🎤</Text>
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.heroOverlay} />
              <View style={styles.heroInfo}>
                <Text style={styles.artistName}>{data.artist.name}</Text>
                {data.artist.followers > 0 ? (
                  <Text style={styles.followers}>{formatFollowers(data.artist.followers)}</Text>
                ) : null}
                {data.artist.genres.length ? (
                  <View style={styles.genreRow}>
                    {data.artist.genres.slice(0, 3).map((g) => (
                      <View key={g} style={styles.genrePill}>
                        <Text style={styles.genreText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>

            <View style={styles.content}>
              <Pressable style={styles.spotifyBtn} onPress={() => openUrl(data.artist.spotifyUrl)}>
                <Text style={styles.spotifyBtnText}>🟢 Open in Spotify</Text>
              </Pressable>

              {data.topTracks.length ? <Text style={styles.secLbl}>Top tracks</Text> : null}

              {data.topTracks.slice(0, MAX_TRACKS_SHOWN).map((track, i) => (
                <Pressable
                  key={track.id}
                  style={[styles.trackRow, i > 0 ? styles.trackRowSpacing : undefined]}
                  onPress={() => openUrl(track.spotifyUrl)}>
                  <Text style={styles.trackNum}>{i + 1}</Text>
                  {track.image ? (
                    <Image source={{ uri: track.image }} style={styles.trackImg} />
                  ) : (
                    <View style={styles.trackImg} />
                  )}
                  <Text style={styles.trackName} numberOfLines={1}>
                    {track.name}
                  </Text>
                </Pressable>
              ))}

              <Text style={styles.note}>
                Tour dates, merch, and sometimes follower counts or top tracks aren&apos;t available here
                — Spotify&apos;s public API doesn&apos;t expose all of that for every artist. Open in
                Spotify for the full picture.
              </Text>
            </View>
          </View>
        )}

        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper },
  body: { flex: 1 },
  content: { padding: Spacing.three },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four, gap: 10 },
  notFoundEmoji: { fontSize: 32 },
  notFoundTitle: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
    color: Brand.ink,
    textAlign: 'center',
  },
  fallbackBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
    marginTop: 8,
  },
  fallbackBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
  hero: { height: 200, position: 'relative' },
  heroImg: { width: '100%', height: '100%' },
  heroImgFallback: { backgroundColor: Brand.ink, alignItems: 'center', justifyContent: 'center' },
  heroImgEmoji: { fontSize: 48 },
  heroOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '70%' },
  heroInfo: { position: 'absolute', left: Spacing.four, bottom: 16, right: Spacing.four },
  artistName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: '#fff' },
  followers: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: 'rgba(255,255,255,0.8)', marginTop: 3 },
  genreRow: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  genrePill: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10 },
  genreText: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: '#fff' },
  spotifyBtn: {
    backgroundColor: '#1DB954',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  spotifyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  secLbl: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingTop: Spacing.three,
    paddingBottom: 8,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 12,
    padding: 10,
  },
  trackRowSpacing: { marginTop: 6 },
  trackNum: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, width: 16, textAlign: 'right' },
  trackImg: { width: 36, height: 36, borderRadius: 6, backgroundColor: Brand.border },
  trackName: { flex: 1, fontFamily: BrandFonts.interMedium, fontSize: 13.5, color: Brand.ink },
  note: {
    fontFamily: BrandFonts.interRegular,
    fontStyle: 'italic',
    fontSize: 11.5,
    color: Brand.muted,
    paddingTop: Spacing.three,
    lineHeight: 16,
  },
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
