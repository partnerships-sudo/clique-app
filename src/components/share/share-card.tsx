import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, type EntryType, TypeColorsDark } from '@/constants/theme';

// A one-off dark/neon treatment matching ProfileCard — deliberately not the
// app's normal light Brand palette, since this card is meant to look good as
// a standalone image shared outside the app.
const Neon = {
  bg: '#0B0A14',
  card: '#15131F',
  border: '#3A2E63',
  accent: '#A855F7',
  accentDim: '#9B95AC',
  text: '#FFFFFF',
  muted: '#9B95AC',
} as const;

const CARD_W = 340;

export const ShareCard = forwardRef<View, {
  title: string;
  sub: string | null | undefined;
  poster: string | null | undefined;
  type: EntryType;
  rating: number | null | undefined;
  ratingIcon: RatingIconStyle | null | undefined;
  note: string | null | undefined;
  date: string | null | undefined;
  genre: string | null | undefined;
}>(function ShareCard({ title, sub, poster, type, rating, ratingIcon, note, date, genre }, ref) {
  const styles = useMemo(() => createStyles(), []);
  const typeConfig = TypeColorsDark[type];
  // Same aspect ratios used in content-detail-modal — the key art is never
  // stretched past what its source actually is.
  const isSquareCover = type === 'listen' || type === 'podcast';

  return (
    <View ref={ref} collapsable={false} style={styles.outer}>
      <LinearGradient
        colors={['#6D28D9', '#EC4899', '#F97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.borderGradient}>
        <View style={styles.card}>
          <View style={styles.tagRow}>
            <Image source={require('@/assets/images/logo-icon.png')} style={styles.tagIcon} resizeMode="contain" />
            <Text style={styles.tagText}>Just Logged</Text>
          </View>

          <View style={styles.posterRow}>
            <View
              style={[styles.posterBox, isSquareCover && styles.posterBoxSquare]}>
              {poster ? (
                <Image source={{ uri: poster }} style={styles.posterImg} resizeMode="cover" />
              ) : (
                <View style={[styles.posterImg, styles.posterFallback, { backgroundColor: typeConfig.bg }]}>
                  <Text style={styles.posterFallbackEmoji}>{typeConfig.icon}</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}

          {rating ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>My Rating</Text>
              <View style={styles.ratingBox}>
                <RatingIcons rating={rating} iconStyle={ratingIcon} textStyle={styles.ratingStars} />
                <Text style={styles.ratingNum}>{rating} / 5</Text>
              </View>
            </View>
          ) : null}

          {note ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>My Review</Text>
              <View style={styles.noteBox}>
                <Text style={styles.noteText} numberOfLines={4}>&ldquo;{note}&rdquo;</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.metaRow}>
            {genre ? (
              <View style={styles.metaCol}>
                <Text style={styles.sectionLabel}>Genre</Text>
                <Text style={styles.metaValue} numberOfLines={1}>{genre}</Text>
              </View>
            ) : null}
            {date ? (
              <View style={styles.metaCol}>
                <Text style={styles.sectionLabel}>Date Logged</Text>
                <Text style={styles.metaValue}>{date}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.footerDivider} />
          <View style={styles.footerRow}>
            <View style={styles.footerBrand}>
              <Image source={require('@/assets/images/logo-icon.png')} style={styles.footerIcon} resizeMode="contain" />
              <Text style={styles.footerTagline}>Track. Rate. Share.{'\n'}Join me on clique</Text>
            </View>
            <Text style={styles.footerWordmark}>clique</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
});

function createStyles() {
  return StyleSheet.create({
    outer: { width: CARD_W },
    borderGradient: { borderRadius: 26, padding: 1.5 },
    card: {
      backgroundColor: Neon.bg,
      borderRadius: 25,
      padding: 20,
    },
    tagRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
    tagIcon: { width: 20, height: 18 },
    tagText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Neon.accent,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    posterRow: { alignItems: 'center', marginBottom: 16 },
    posterBox: {
      width: 130,
      height: 195,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: Neon.card,
    },
    posterBoxSquare: { width: 150, height: 150 },
    posterImg: { width: '100%', height: '100%' },
    posterFallback: { alignItems: 'center', justifyContent: 'center' },
    posterFallbackEmoji: { fontSize: 42 },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 21,
      color: Neon.text,
      textAlign: 'center',
      lineHeight: 26,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Neon.muted,
      textAlign: 'center',
      marginTop: 3,
    },
    section: { marginTop: 16 },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      color: Neon.accentDim,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    ratingBox: {
      backgroundColor: Neon.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Neon.border,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    ratingStars: { color: '#F4A340', fontSize: 17 },
    ratingNum: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Neon.text },
    noteBox: {
      backgroundColor: Neon.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Neon.border,
      padding: 12,
    },
    noteText: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12.5,
      color: '#D8D4E8',
      lineHeight: 18,
    },
    metaRow: { flexDirection: 'row', marginTop: 18, gap: 16 },
    metaCol: { flex: 1, minWidth: 0 },
    metaValue: { fontFamily: BrandFonts.interMedium, fontSize: 12.5, color: Neon.text },
    footerDivider: { height: 1, backgroundColor: Neon.border, marginTop: 18, marginBottom: 14 },
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    footerBrand: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 },
    footerIcon: { width: 22, height: 20 },
    footerTagline: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 9.5,
      color: Neon.muted,
      lineHeight: 12.5,
    },
    footerWordmark: {
      fontFamily: BrandFonts.poppinsExtraBold,
      fontSize: 17,
      color: Neon.text,
      letterSpacing: -0.4,
    },
  });
}
