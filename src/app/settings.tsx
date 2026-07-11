import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile, useUpdatePrivacy } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function SettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { signOut } = useSession();
  const { data: profile } = useProfile();
  const updatePrivacy = useUpdatePrivacy();

  function handleSignOut() {
    Alert.alert('Sign Out', 'You can switch to a different account, or sign out completely.', [
      { text: 'Sign in with another account', onPress: () => signOut() },
      { text: 'Full sign out', style: 'destructive', onPress: () => signOut({ forgetDevice: true }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          <Pressable
            style={styles.navRow}
            onPress={() => router.push('/push-notifications-settings')}>
            <View style={styles.navRowBody}>
              <Text style={styles.navRowLabel}>Push Notifications</Text>
              <Text style={styles.navRowSub}>Messages, friend requests, reactions, and more</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, styles.navRowDivider]}
            onPress={() => router.push('/collection-sharing-settings')}>
            <View style={styles.navRowBody}>
              <Text style={styles.navRowLabel}>📦 My Collection</Text>
              <Text style={styles.navRowSub}>Choose what friends can see on your profile</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, styles.navRowDivider]}
            onPress={() => router.push('/close-friends-settings')}>
            <View style={styles.navRowBody}>
              <Text style={styles.navRowLabel}>💚 Close Friends</Text>
              <Text style={styles.navRowSub}>Tag your closest friends — private, just for you</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={[styles.navRow, styles.navRowDivider]}
            onPress={() => router.push('/blocked-muted-accounts')}>
            <View style={styles.navRowBody}>
              <Text style={styles.navRowLabel}>Blocked & Muted Accounts</Text>
              <Text style={styles.navRowSub}>Manage who can&rsquo;t reach you or show up in your feed</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <View style={[styles.navRow, styles.navRowDivider]}>
            <View style={styles.navRowBody}>
              <Text style={styles.navRowLabel}>Private Account</Text>
              <Text style={styles.navRowSub}>
                {profile?.is_private
                  ? 'Only approved followers can see your posts'
                  : 'Anyone can see your posts and follow you instantly'}
              </Text>
            </View>
            <Switch
              value={profile?.is_private ?? false}
              onValueChange={(value) => updatePrivacy.mutate(value)}
              disabled={updatePrivacy.isPending}
              trackColor={{ false: Brand.tlight, true: Brand.trust }}
            />
          </View>
        </View>

        <View style={styles.signOutSection}>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
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
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: Spacing.three,
      gap: 12,
    },
    navRowDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    navRowBody: { flex: 1, minWidth: 0 },
    navRowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 2 },
    navRowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    chevron: { fontSize: 22, color: Brand.muted },
    signOutSection: { marginTop: 'auto', marginBottom: Spacing.four },
    signOutBtn: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      paddingVertical: 15,
      alignItems: 'center',
    },
    signOutText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: '#E84F4F' },
  });
}
