import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RATING_ICON_OPTIONS, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile, useUpdateRatingIcon } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { useAppearance, type AppearancePref } from '@/providers/appearance-provider';

const APPEARANCE_OPTIONS: { value: AppearancePref; label: string; sf: string }[] = [
  { value: 'system', label: 'System', sf: 'circle.lefthalf.filled' },
  { value: 'light', label: 'Light', sf: 'sun.min' },
  { value: 'dark', label: 'Dark', sf: 'moon' },
];

export default function SettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { signOut } = useSession();
  const { data: profile } = useProfile();
  const updateRatingIcon = useUpdateRatingIcon();
  const { pref: appearancePref, setPref: setAppearancePref } = useAppearance();
  const [ratingIcon, setRatingIcon] = useState<RatingIconStyle>(
    (profile?.rating_icon as RatingIconStyle) ?? 'stars',
  );

  function handleSignOut() {
    Alert.alert('Sign Out', 'You can switch to a different account, or sign out completely.', [
      { text: 'Sign in with another account', onPress: () => signOut() },
      { text: 'Full sign out', style: 'destructive', onPress: () => signOut({ forgetDevice: true }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function handleRatingIcon(value: RatingIconStyle) {
    setRatingIcon(value);
    updateRatingIcon.mutate(value);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>

        {/* ACCOUNT */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => router.push('/account-info')}>
            <View style={styles.rowIcon}>
              <SymbolView name="person" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Account info</Text>
              <Text style={styles.rowSub}>Email, username, and password</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/push-notifications-settings')}>
            <View style={styles.rowIcon}>
              <SymbolView name="bell" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Push notifications</Text>
              <Text style={styles.rowSub}>Messages, friend requests, reactions, and more</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/privacy-settings')}>
            <View style={styles.rowIcon}>
              <SymbolView name="lock.shield" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Privacy</Text>
              <Text style={styles.rowSub}>Account visibility, online status, and read receipts</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* SOCIAL */}
        <Text style={styles.sectionLabel}>Social</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => router.push('/collection-sharing-settings')}>
            <View style={styles.rowIcon}>
              <SymbolView name="books.vertical" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>My collection</Text>
              <Text style={styles.rowSub}>Choose what friends can see on your profile</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/close-friends-settings')}>
            <View style={styles.rowIcon}>
              <SymbolView name="heart" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Close friends</Text>
              <Text style={styles.rowSub}>Tag your closest friends — private, just for you</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable style={[styles.row, styles.rowDivider]} onPress={() => router.push('/blocked-muted-accounts')}>
            <View style={styles.rowIcon}>
              <SymbolView name="nosign" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Blocked & muted accounts</Text>
              <Text style={styles.rowSub}>Manage who can't reach you or show up in your feed</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* PREFERENCES */}
        <Text style={styles.sectionLabel}>Preferences</Text>
        <View style={styles.card}>
          {/* Rating style */}
          <View style={styles.prefBlock}>
            <Text style={styles.prefTitle}>Rating style</Text>
            <Text style={styles.prefSub}>Choose your rating icon across the app</Text>
            <View style={styles.pickerRow}>
              {RATING_ICON_OPTIONS.map((opt) => {
                const active = ratingIcon === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.pickerTile, active && styles.pickerTileActive]}
                    onPress={() => handleRatingIcon(opt.value)}>
                    <Text style={styles.pickerEmoji}>{opt.emoji}</Text>
                    <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Appearance */}
          <View style={[styles.prefBlock, styles.prefBlockDivider]}>
            <Text style={styles.prefTitle}>Appearance</Text>
            <Text style={styles.prefSub}>Override your system theme</Text>
            <View style={styles.pickerRow}>
              {APPEARANCE_OPTIONS.map((opt) => {
                const active = appearancePref === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.pickerTile, active && styles.pickerTileActive]}
                    onPress={() => setAppearancePref(opt.value)}>
                    <SymbolView
                      name={opt.sf as any}
                      size={24}
                      tintColor={active ? Brand.trust : Brand.muted}
                      type="monochrome"
                    />
                    <Text style={[styles.pickerLabel, active && styles.pickerLabelActive]}>{opt.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* DATA */}
        <Text style={styles.sectionLabel}>Data</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={() => router.push('/export-library-modal')}>
            <View style={styles.rowIcon}>
              <SymbolView name="square.and.arrow.up" size={18} tintColor={Brand.muted} type="monochrome" />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Export library</Text>
              <Text style={styles.rowSub}>Download your logged items as CSV, Letterboxd, or JSON</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        {/* DEV TOOLS */}
        {__DEV__ && (
          <>
            <Text style={styles.sectionLabel}>Dev Tools</Text>
            <View style={styles.card}>
              <Pressable style={styles.row} onPress={() => router.push('/onboarding')}>
                <View style={styles.rowBody}>
                  <Text style={styles.rowLabel}>🚀 Preview Onboarding</Text>
                  <Text style={styles.rowSub}>Walk through the full new user experience</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </View>
          </>
        )}

        {/* Sign out */}
        <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
          <SymbolView name="rectangle.portrait.and.arrow.right" size={16} tintColor="#E84F4F" type="monochrome" />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>

        {/* Privacy Policy */}
        <Pressable style={styles.privacyRow} onPress={() => router.push('/privacy-policy')}>
          <Text style={styles.privacyText}>Privacy Policy</Text>
        </Pressable>
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
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink, marginBottom: Spacing.four },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
      marginTop: Spacing.three,
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
    chevron: { fontSize: 22, color: Brand.muted },
    prefBlock: { padding: Spacing.three },
    prefBlockDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    prefTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink, marginBottom: 2 },
    prefSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginBottom: 14 },
    pickerRow: { flexDirection: 'row', gap: 10 },
    pickerTile: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.paper,
      gap: 6,
    },
    pickerTileActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    pickerEmoji: { fontSize: 26 },
    pickerLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted },
    pickerLabelActive: { color: Brand.trust },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      paddingVertical: 15,
      marginTop: Spacing.four,
    },
    signOutText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#E84F4F' },
    privacyRow: { alignItems: 'center', paddingVertical: Spacing.three },
    privacyText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
  });
}
