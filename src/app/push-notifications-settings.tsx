import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useNotificationSettings, type NotificationSettings } from '@/features/notifications/settings';
import { useBrand } from '@/hooks/use-brand';

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; sub: string }[] = [
  { key: 'messages', label: 'Messages', sub: 'Direct messages, group chats, and content chats' },
  { key: 'friend_requests', label: 'Followers', sub: 'New followers and follow requests' },
  { key: 'reactions', label: 'Reactions', sub: 'When someone reacts to your posts' },
  { key: 'recommendations', label: 'Recommendations', sub: 'When a friend sends you a rec' },
  { key: 'daily_nudge', label: 'Daily reminder', sub: 'An evening nudge to log something' },
  { key: 'rating_reminders', label: 'Rating reminders', sub: 'Nudges to rate movies, shows, and games after you log them' },
  { key: 'discussions', label: 'Discussions', sub: 'Replies to your comments and new activity on discussions you joined' },
];

function useSystemNotificationStatus() {
  const [status, setStatus] = useState<'granted' | 'denied' | 'undetermined'>('granted');

  async function check() {
    const { status: s } = await Notifications.getPermissionsAsync();
    setStatus(s as 'granted' | 'denied' | 'undetermined');
  }

  useEffect(() => {
    check();
    // Re-check when the user comes back from iOS Settings
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => sub.remove();
  }, []);

  return status;
}

export default function PushNotificationsSettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { settings, setCategory } = useNotificationSettings();
  const systemStatus = useSystemNotificationStatus();
  const isBlocked = systemStatus === 'denied';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Push Notifications</Text>

        {isBlocked && (
          <View style={styles.banner}>
            <Text style={styles.bannerTitle}>Notifications are off in iOS Settings</Text>
            <Text style={styles.bannerBody}>
              Your in-app preferences below won't take effect until you enable notifications for Clique in iOS Settings.
            </Text>
            <Pressable style={styles.bannerBtn} onPress={() => Linking.openSettings()}>
              <Text style={styles.bannerBtnText}>Open Settings →</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.card}>
          {NOTIFICATION_ROWS.map((row, i) => (
            <View key={row.key} style={[styles.row, i > 0 && styles.rowDivider]}>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowSub}>{row.sub}</Text>
              </View>
              <Switch
                value={settings[row.key]}
                onValueChange={(value) => setCategory(row.key, value)}
                trackColor={{ false: Brand.border, true: Brand.trust }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, marginBottom: Spacing.three },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { flex: 1, paddingHorizontal: Spacing.three },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink, marginBottom: Spacing.four },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: Spacing.three,
      gap: 12,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 2 },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    banner: {
      backgroundColor: '#FFF3CD',
      borderWidth: 1,
      borderColor: '#F0C040',
      borderRadius: 14,
      padding: Spacing.three,
      marginBottom: Spacing.three,
    },
    bannerTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#7A5700',
      marginBottom: 4,
    },
    bannerBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: '#7A5700',
      lineHeight: 18,
      marginBottom: 12,
    },
    bannerBtn: {
      alignSelf: 'flex-start',
      backgroundColor: '#7A5700',
      borderRadius: 20,
      paddingVertical: 7,
      paddingHorizontal: 14,
    },
    bannerBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: '#fff',
    },
  });
}
