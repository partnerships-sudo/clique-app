import { useEffect, useRef, useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import type { Ad } from '@/features/ads/api';
import { handleAdTap, useLogAdEvent } from '@/features/ads/api';

export function SponsoredCard({ ad }: { ad: Ad }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const logEvent = useLogAdEvent();
  const impressionLogged = useRef(false);

  useEffect(() => {
    if (!impressionLogged.current) {
      impressionLogged.current = true;
      logEvent(ad.id, 'impression');
    }
  }, [ad.id]);

  return (
    <Pressable
      style={styles.card}
      onPress={() => handleAdTap(ad, logEvent)}
      accessibilityLabel={`Sponsored post from ${ad.brand_name}: ${ad.headline}`}
      accessibilityRole="link"
      accessibilityHint="Opens advertiser's page">
      {ad.image_url ? (
        <Image source={{ uri: ad.image_url }} style={styles.image} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
        <View style={styles.brandRow}>
          {ad.brand_logo_url ? (
            <Image source={{ uri: ad.brand_logo_url }} style={styles.logo} />
          ) : null}
          <Text style={styles.brandName}>{ad.brand_name}</Text>
          <View style={styles.sponsoredBadge}>
            <Text style={styles.sponsoredText}>Sponsored</Text>
          </View>
        </View>
        <Text style={styles.headline}>{ad.headline}</Text>
        {ad.body ? <Text style={styles.bodyText} numberOfLines={2}>{ad.body}</Text> : null}
        <View style={styles.cta}>
          <Text style={styles.ctaText}>{ad.cta_label}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginHorizontal: 14,
    },
    image: {
      width: '100%',
      aspectRatio: 16 / 9,
      backgroundColor: Brand.border,
    },
    body: {
      padding: 14,
      gap: 8,
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    logo: {
      width: 22,
      height: 22,
      borderRadius: 4,
      backgroundColor: Brand.border,
    },
    brandName: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.muted,
      flex: 1,
    },
    sponsoredBadge: {
      backgroundColor: Brand.trust,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    sponsoredText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 10,
      color: '#fff',
      letterSpacing: 0.5,
    },
    headline: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.ink,
      lineHeight: 20,
    },
    bodyText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      lineHeight: 18,
    },
    cta: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.trust,
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 7,
      marginTop: 2,
    },
    ctaText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#fff',
    },
  });
}
