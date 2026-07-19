import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, TypeColorsDark } from '@/constants/theme';
import type { ShareSheetPost } from './share-sheet';

const Neon = {
  bg: '#0B0A14',
  card: '#15131F',
  border: '#3A2E63',
  accent: '#A855F7',
  muted: '#9B95AC',
  text: '#FFFFFF',
} as const;

export const MiniShareCard = forwardRef<View, { post: ShareSheetPost }>(
  function MiniShareCard({ post }, ref) {
    const typeConfig = TypeColorsDark[post.type as keyof typeof TypeColorsDark] ?? TypeColorsDark.watch;
    const isSquare = post.type === 'listen' || post.type === 'podcast';

    return (
      <View ref={ref} collapsable={false} style={styles.outer}>
        <LinearGradient
          colors={['#6D28D9', '#EC4899', '#F97316']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.borderGradient}>
          <View style={styles.card}>
            {/* Poster */}
            <View style={styles.posterRow}>
              <View style={[styles.posterBox, isSquare && styles.posterBoxSquare]}>
                {post.poster ? (
                  <Image source={{ uri: post.poster }} style={styles.posterImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.posterImg, { backgroundColor: typeConfig.bg, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 36 }}>{typeConfig.icon}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Title + sub */}
            <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
            {post.sub ? <Text style={styles.sub} numberOfLines={1}>{post.sub}</Text> : null}

            {/* Footer */}
            <View style={styles.footerDivider} />
            <View style={styles.footerRow}>
              <Image source={require('@/assets/images/logo-icon.png')} style={styles.footerIcon} resizeMode="contain" />
              <Text style={styles.footerText}>Join me on <Text style={styles.footerBrand}>clique</Text></Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  outer: { width: 280 },
  borderGradient: { borderRadius: 24, padding: 1.5 },
  card: { backgroundColor: Neon.bg, borderRadius: 23, padding: 18 },
  posterRow: { alignItems: 'center', marginBottom: 14 },
  posterBox: { width: 110, height: 165, borderRadius: 12, overflow: 'hidden', backgroundColor: Neon.card },
  posterBoxSquare: { width: 130, height: 130 },
  posterImg: { width: '100%', height: '100%' },
  title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Neon.text, textAlign: 'center', lineHeight: 23 },
  sub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Neon.muted, textAlign: 'center', marginTop: 3 },
  footerDivider: { height: 1, backgroundColor: Neon.border, marginTop: 16, marginBottom: 12 },
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  footerIcon: { width: 18, height: 16 },
  footerText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Neon.muted },
  footerBrand: { fontFamily: BrandFonts.poppinsExtraBold, color: Neon.text },
});
