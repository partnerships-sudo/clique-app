import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function NowBanner({
  label,
  title,
  poster,
  onPressLog,
}: {
  label: string;
  title: string;
  poster?: string | null;
  onPressLog: () => void;
}) {
  const Brand = useBrand();
  const isDark = useColorScheme() === 'dark';
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const gradientColors = isDark ? (['#332C66', '#1C1A33'] as const) : (['#DCD5FF', '#F5F3FF'] as const);

  return (
    <View style={styles.banner}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.left}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Pressable style={styles.btn} onPress={onPressLog}>
          <Text style={styles.btnText}>+ Log something</Text>
        </Pressable>
      </View>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.poster} />
      ) : (
        <View style={[styles.poster, styles.posterFallback]}>
          <Text style={styles.posterFallbackText}>🎬</Text>
        </View>
      )}
    </View>
  );
}

const POSTER_WIDTH = 150;

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    banner: {
      borderRadius: 20,
      minHeight: 150,
      marginBottom: 22,
      position: 'relative',
      overflow: 'hidden',
    },
    left: {
      paddingVertical: 18,
      paddingLeft: 18,
      paddingRight: POSTER_WIDTH + 14,
      justifyContent: 'center',
      minHeight: 150,
    },
    label: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.trust,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 6,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 21,
      color: Brand.ink,
      lineHeight: 25,
      marginBottom: 14,
    },
    btn: {
      backgroundColor: Brand.trust,
      borderRadius: 24,
      paddingVertical: 11,
      paddingHorizontal: 18,
      alignSelf: 'flex-start',
    },
    btnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: '#fff',
    },
    poster: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      width: POSTER_WIDTH,
      borderTopLeftRadius: 56,
    },
    posterFallback: {
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterFallbackText: { fontSize: 32 },
  });
}
