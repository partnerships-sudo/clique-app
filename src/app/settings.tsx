import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useNotificationSettings, type NotificationSettings } from '@/features/notifications/settings';
import { useBrand } from '@/hooks/use-brand';

const NOTIFICATION_ROWS: { key: keyof NotificationSettings; label: string; sub: string }[] = [
  { key: 'messages', label: 'Messages', sub: 'Direct messages, group chats, and content chats' },
  { key: 'friend_requests', label: 'Friend requests', sub: 'New requests and accepted requests' },
  { key: 'reactions', label: 'Reactions', sub: 'When someone reacts to your posts' },
  { key: 'recommendations', label: 'Recommendations', sub: 'When a friend sends you a rec' },
];

export default function SettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { settings, setCategory } = useNotificationSettings();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <Text style={styles.sectionLabel}>Notifications</Text>
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
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
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
  });
}
