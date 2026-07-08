import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import type { TrendingLogger } from '@/features/feed/trending';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export default function TrendingUsersModal() {
  const params = useLocalSearchParams<{
    title: string;
    sub?: string;
    type: EntryType;
    poster?: string;
    loggers: string;
  }>();

  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const loggers: TrendingLogger[] = params.loggers ? JSON.parse(params.loggers) : [];
  const type = TypeColors[params.type] ?? TypeColors.watch;

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.55],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          {params.poster ? (
            <Image source={{ uri: params.poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback, { backgroundColor: type.bg }]}>
              <Text style={styles.posterEmoji}>{type.icon}</Text>
            </View>
          )}
          <View style={styles.headerInfo}>
            <Text style={styles.title} numberOfLines={2}>
              {params.title}
            </Text>
            {params.sub ? <Text style={styles.sub}>{params.sub}</Text> : null}
          </View>
        </View>

        <Text style={styles.secLbl}>
          {loggers.length} {loggers.length === 1 ? 'person' : 'people'} logged this
        </Text>
        <View style={styles.list}>
          {loggers.map((logger) => (
            <View key={logger.name} style={styles.row}>
              <Avatar name={logger.name} size={40} avatarUrl={logger.avatarUrl} />
              <Text style={styles.name}>{logger.name}</Text>
            </View>
          ))}
        </View>

        <Pressable style={styles.closeBtn} onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtnText}>Done</Text>
        </Pressable>
      </View>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  sheet: { flex: 1, backgroundColor: Brand.paper, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
  header: { flexDirection: 'row', gap: 14, marginBottom: 22 },
  poster: { width: 64, height: 90, borderRadius: 12, backgroundColor: Brand.border },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  posterEmoji: { fontSize: 26 },
  headerInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
  title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
  sub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 4 },
  secLbl: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
  closeBtn: {
    backgroundColor: Brand.ink,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 'auto',
    marginBottom: Spacing.three,
  },
  closeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
