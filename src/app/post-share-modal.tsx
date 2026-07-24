import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const APP_ACTIONS = [
  { id: 'recommend', label: 'Recommend', sf: 'person.badge.plus' },
  { id: 'log', label: 'Log it', sf: 'checkmark.circle' },
  { id: 'watchlist', label: 'Watchlist', sf: 'bookmark' },
] as const;

const NATIVE_APPS = [
  { label: 'Messages', emoji: '💬', bg: '#34C759' },
  { label: 'Mail', emoji: '✉️', bg: '#1D9BF0' },
  { label: 'WhatsApp', emoji: '📱', bg: '#25D366' },
  { label: 'AirDrop', emoji: '📡', bg: '#6E6E73' },
] as const;

export default function PostShareModal() {
  const params = useLocalSearchParams<{
    title?: string;
    type?: string;
    sub?: string;
    poster?: string;
    extRating?: string;
    mediaType?: string;
  }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function handleAction(id: typeof APP_ACTIONS[number]['id']) {
    router.back();
    setTimeout(() => {
      if (id === 'recommend') {
        router.push({
          pathname: '/recommend-modal',
          params: {
            title: params.title,
            type: params.type,
            sub: params.sub,
            poster: params.poster,
            extRating: params.extRating,
            mediaType: params.mediaType,
          },
        });
      } else if (id === 'log') {
        router.push({ pathname: '/log-modal' });
      } else if (id === 'watchlist') {
        router.push({
          pathname: '/collection-add-modal',
          params: { title: params.title, type: params.type, poster: params.poster },
        });
      }
    }, 300);
  }

  async function handleNativeShare() {
    router.back();
    await Share.share({ message: `Check out ${params.title ?? 'this'} on Clique!` });
  }

  return (
    <View style={styles.container}>
      <View style={styles.handle} />
      <Text style={styles.title}>{params.title ?? 'Share'}</Text>

      {/* In-app actions */}
      <View style={styles.actionsRow}>
        {APP_ACTIONS.map((action) => (
          <Pressable key={action.id} style={styles.actionTile} onPress={() => handleAction(action.id)}>
            <View style={styles.actionIcon}>
              <SymbolView name={action.sf as any} size={26} tintColor={Brand.trust} type="monochrome" />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Native share app row */}
      <View style={styles.nativeRow}>
        {NATIVE_APPS.map((app) => (
          <Pressable key={app.label} style={styles.nativeTile} onPress={handleNativeShare}>
            <View style={[styles.nativeIcon, { backgroundColor: app.bg }]}>
              <Text style={styles.nativeEmoji}>{app.emoji}</Text>
            </View>
            <Text style={styles.nativeLabel}>{app.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
        <Text style={styles.cancelText}>Cancel</Text>
      </Pressable>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Brand.card,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.five,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center',
      marginTop: 10,
      marginBottom: Spacing.three,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
      textAlign: 'center',
      marginBottom: Spacing.four,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 16,
      marginBottom: Spacing.four,
    },
    actionTile: {
      alignItems: 'center',
      gap: 8,
      width: 80,
    },
    actionIcon: {
      width: 64,
      height: 64,
      borderRadius: 16,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.ink,
      textAlign: 'center',
    },
    divider: {
      height: 1,
      backgroundColor: Brand.border,
      marginBottom: Spacing.four,
    },
    nativeRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: Spacing.four,
    },
    nativeTile: {
      alignItems: 'center',
      gap: 6,
      width: 64,
    },
    nativeIcon: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    nativeEmoji: {
      fontSize: 24,
    },
    nativeLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.ink,
      textAlign: 'center',
    },
    cancelBtn: {
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: Brand.paper,
      borderRadius: 14,
    },
    cancelText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.trust,
    },
  });
}
