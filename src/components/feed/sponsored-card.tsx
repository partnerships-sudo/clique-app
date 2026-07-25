import { useEffect, useRef, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import type { Ad } from '@/features/ads/api';
import { handleAdTap, useAdPoster, useLogAdEvent } from '@/features/ads/api';

const POSTER_W = 90;
const POSTER_H = Math.round(POSTER_W * 1.5);

export function SponsoredCard({ ad, onDismiss }: { ad: Ad; onDismiss?: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const logEvent = useLogAdEvent();
  const impressionLogged = useRef(false);

  // Fetch real TMDB poster when available; fall back to ad.image_url
  const { data: tmdbPoster } = useAdPoster(ad.tmdb_id, ad.media_type, ad.content_title);
  const posterUri = tmdbPoster ?? ad.image_url;

  useEffect(() => {
    if (!impressionLogged.current) {
      impressionLogged.current = true;
      logEvent(ad.id, 'impression');
    }
  }, [ad.id]);

  function handlePress() {
    logEvent(ad.id, 'tap');
    if (ad.content_title) {
      router.push({
        pathname: '/content-detail-modal',
        params: {
          title: ad.content_title,
          sub: ad.content_sub ?? undefined,
          type: ad.content_type ?? 'watch',
          poster: posterUri ?? undefined,
          externalId: ad.tmdb_id ?? undefined,
          mediaType: ad.media_type ?? undefined,
          adBrandName: ad.brand_name,
          adCompanyId: ad.tmdb_company_id ?? undefined,
        },
      });
    } else {
      handleAdTap(ad, logEvent);
    }
  }

  return (
    <View style={styles.card}>
      {onDismiss ? (
        <Pressable style={styles.dismissBtn} onPress={onDismiss} hitSlop={8} accessibilityLabel="Dismiss ad">
          <Text style={styles.dismissX}>✕</Text>
        </Pressable>
      ) : null}
      <Pressable
        style={styles.inner}
        onPress={handlePress}
        accessibilityLabel={`Sponsored: ${ad.headline}`}
        accessibilityRole="link">

        {/* Poster */}
        <View style={styles.posterWrap}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterFallbackText} numberOfLines={3}>{ad.brand_name}</Text>
            </View>
          )}
        </View>

        {/* Right: content */}
        <View style={styles.body}>
          {/* Top row: brand logo · brand name · Ad badge */}
          <View style={styles.metaRow}>
            {ad.brand_logo_url ? (
              <Image source={{ uri: ad.brand_logo_url }} style={styles.logo} />
            ) : null}
            <Text style={styles.brandName} numberOfLines={1}>{ad.brand_name}</Text>
            <View style={styles.adPill}>
              <Text style={styles.adPillText}>AD</Text>
            </View>
          </View>

          {/* Title */}
          <Text style={styles.title} numberOfLines={2}>{ad.headline}</Text>

          {/* Body */}
          {ad.body ? (
            <Text style={styles.sub} numberOfLines={2}>{ad.body}</Text>
          ) : null}

          {/* CTA */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.cta} onPress={handlePress}>
              <Text style={styles.ctaText}>{ad.cta_label}</Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: '#E8A84F',
      borderStyle: 'dashed',
      borderRadius: 16,
      minHeight: POSTER_H,
    },
    dismissBtn: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      zIndex: 10,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    dismissX: {
      fontSize: 11,
      color: '#fff',
      lineHeight: 13,
    },
    inner: {
      flexDirection: 'row',
      alignItems: 'stretch',
      borderRadius: 14,
      overflow: 'hidden',
      minHeight: POSTER_H,
    },
    posterWrap: {
      width: POSTER_W,
      minHeight: POSTER_H,
    },
    poster: {
      width: POSTER_W,
      height: POSTER_H,
    },
    posterFallback: {
      backgroundColor: '#E8A84F22',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
    },
    posterFallbackText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#E8A84F',
      textAlign: 'center',
    },
    body: {
      flex: 1,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 4,
    },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 2,
    },
    logo: {
      width: 18,
      height: 18,
      borderRadius: 4,
      backgroundColor: Brand.border,
    },
    brandName: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.muted,
      flex: 1,
    },
    adPill: {
      backgroundColor: '#E8A84F22',
      borderWidth: 1,
      borderColor: '#E8A84F',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    adPillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: '#E8A84F',
      letterSpacing: 0.8,
    },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.ink,
      lineHeight: 20,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      lineHeight: 17,
    },
    actionsRow: {
      marginTop: 6,
    },
    cta: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.trust,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    ctaText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#fff',
    },
  });
}
