import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile, useUpdatePresenceSettings, useUpdatePrivacy } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export default function PrivacySettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const updatePrivacy = useUpdatePrivacy();
  const updatePresence = useUpdatePresenceSettings();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Privacy</Text>
        <Text style={styles.intro}>
          Control who can see your content and how others interact with you.
        </Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <SymbolView name="lock" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Private account</Text>
              <Text style={styles.rowSub}>
                {profile?.is_private
                  ? 'Only approved followers can see your posts'
                  : 'Anyone can see your posts and follow you instantly'}
              </Text>
            </View>
            <Switch
              value={profile?.is_private ?? false}
              onValueChange={(v) => updatePrivacy.mutate(v)}
              disabled={updatePrivacy.isPending}
              trackColor={{ false: Brand.tlight, true: Brand.trust }}
            />
          </View>

          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowIcon}>
              <SymbolView name="eye" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Online status</Text>
              <Text style={styles.rowSub}>Let others see when you're active in the app</Text>
            </View>
            <Switch
              value={profile?.show_online_status ?? true}
              onValueChange={(v) => updatePresence.mutate({ show_online_status: v })}
              disabled={updatePresence.isPending}
              trackColor={{ false: Brand.tlight, true: Brand.trust }}
            />
          </View>

          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowIcon}>
              <SymbolView name="checkmark.message" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Read receipts</Text>
              <Text style={styles.rowSub}>Let others see when you've read their messages</Text>
            </View>
            <Switch
              value={profile?.show_read_receipts ?? true}
              onValueChange={(v) => updatePresence.mutate({ show_read_receipts: v })}
              disabled={updatePresence.isPending}
              trackColor={{ false: Brand.tlight, true: Brand.trust }}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    backRow: { paddingTop: Spacing.three, marginBottom: Spacing.two },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink, marginBottom: 8 },
    intro: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.5,
      color: Brand.muted,
      lineHeight: 20,
      marginBottom: Spacing.four,
    },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: Spacing.three,
      gap: 12,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    rowIcon: { width: 24, alignItems: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 1 },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
  });
}
