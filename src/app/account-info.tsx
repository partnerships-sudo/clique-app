import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';

export default function AccountInfoScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user, signOut } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState(user?.email ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  async function handleSaveEmail() {
    if (!email.trim() || email === user?.email) return;
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      Alert.alert('Check your inbox', 'A confirmation link has been sent to your new email address. Click it to confirm the change.');
    } catch (e: any) {
      Alert.alert('Could not update email', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveUsername() {
    const clean = username.replace('@', '').trim();
    if (!clean || clean === profile?.username) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ username: clean }).eq('id', user!.id);
      if (error) throw error;
      Alert.alert('Username updated', `Your username is now @${clean}.`);
    } catch (e: any) {
      Alert.alert('Could not update username', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword || !confirmPassword) return;
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", 'Make sure both fields are the same.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Too short', 'Password must be at least 8 characters.');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Password updated', 'Your password has been changed.');
    } catch (e: any) {
      Alert.alert('Could not change password', e.message ?? 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      'Delete account',
      'This permanently deletes your profile, posts, and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setShowDeleteConfirm(true);
          },
        },
      ],
    );
  }

  async function confirmDelete() {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('delete-account', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) throw res.error;
      queryClient.clear();
      await signOut({ forgetDevice: true });
    } catch (e: any) {
      Alert.alert('Could not delete account', e.message ?? 'Please try again or contact support.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Account info</Text>

        {/* Email */}
        <Text style={styles.sectionLabel}>Email address</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your@email.com"
            placeholderTextColor={Brand.muted}
          />
          <Pressable
            style={[styles.saveBtn, (email === user?.email || saving) && styles.saveBtnDisabled]}
            onPress={handleSaveEmail}
            disabled={email === user?.email || saving}>
            <Text style={styles.saveBtnText}>Update email</Text>
          </Pressable>
          <Text style={styles.hint}>You'll receive a confirmation link at your new address.</Text>
        </View>

        {/* Username */}
        <Text style={styles.sectionLabel}>Username</Text>
        <View style={styles.card}>
          <View style={styles.usernameRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="yourhandle"
              placeholderTextColor={Brand.muted}
            />
          </View>
          <Pressable
            style={[styles.saveBtn, (username.replace('@','') === profile?.username || saving) && styles.saveBtnDisabled]}
            onPress={handleSaveUsername}
            disabled={username.replace('@','') === profile?.username || saving}>
            <Text style={styles.saveBtnText}>Update username</Text>
          </Pressable>
        </View>

        {/* Password */}
        <Text style={styles.sectionLabel}>Change password</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>New password</Text>
          <TextInput
            style={[styles.input, styles.fieldInput]}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={Brand.muted}
          />
          <Text style={styles.fieldLabel}>Confirm new password</Text>
          <TextInput
            style={[styles.input, styles.fieldInput]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Repeat new password"
            placeholderTextColor={Brand.muted}
          />
          <Pressable
            style={[styles.saveBtn, (!newPassword || !confirmPassword || saving) && styles.saveBtnDisabled]}
            onPress={handleChangePassword}
            disabled={!newPassword || !confirmPassword || saving}>
            <Text style={styles.saveBtnText}>Change password</Text>
          </Pressable>
        </View>
        {/* Danger zone */}
        <Text style={styles.sectionLabel}>Danger zone</Text>
        <View style={styles.card}>
          <Text style={styles.deleteNote}>
            Deleting your account is permanent and cannot be reversed. All your posts, ratings, and connections will be removed.
          </Text>
          <Pressable
            style={[styles.saveBtn, styles.deleteBtnStyle, saving && styles.saveBtnDisabled]}
            onPress={handleDeleteAccount}
            disabled={saving}>
            <Text style={styles.deleteBtnText}>Delete my account</Text>
          </Pressable>

          {showDeleteConfirm && (
            <View style={styles.deleteConfirmBox}>
              <Text style={styles.deleteConfirmTitle}>Confirm deletion</Text>
              <Text style={styles.deleteConfirmBody}>
                Type <Text style={styles.deleteConfirmUsername}>@{profile?.username}</Text> to permanently delete your account.
              </Text>
              <TextInput
                style={styles.deleteConfirmInput}
                placeholder={`@${profile?.username ?? 'username'}`}
                placeholderTextColor={Brand.muted}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.deleteConfirmActions}>
                <Pressable
                  style={styles.deleteConfirmCancel}
                  onPress={() => setShowDeleteConfirm(false)}>
                  <Text style={styles.deleteConfirmCancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.deleteConfirmConfirm,
                    deleteConfirmText !== `@${profile?.username}` && styles.deleteConfirmConfirmDisabled,
                  ]}
                  disabled={deleteConfirmText !== `@${profile?.username}` || saving}
                  onPress={confirmDelete}>
                  <Text style={styles.deleteConfirmConfirmText}>
                    {saving ? 'Deleting…' : 'Delete forever'}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, marginBottom: Spacing.two },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { paddingHorizontal: Spacing.three, paddingBottom: 40 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 26, color: Brand.ink, marginBottom: Spacing.four },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 4,
    },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: 16,
      marginBottom: 20,
    },
    fieldLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.5,
      color: Brand.ink,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.paper,
    },
    usernameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    atSign: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.muted },
    usernameInput: { flex: 1, marginBottom: 0 },
    fieldInput: { marginBottom: 4 },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: 12,
    },
    saveBtnDisabled: { opacity: 0.4 },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    hint: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginTop: 8,
    },
    deleteNote: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      lineHeight: 19,
      marginBottom: 4,
    },
    deleteBtnStyle: { backgroundColor: '#E84F4F' },
    deleteBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    deleteConfirmBox: {
      marginTop: 16,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: '#E84F4F',
      borderRadius: 16,
      padding: 16,
    },
    deleteConfirmTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15,
      color: '#E84F4F',
      marginBottom: 6,
    },
    deleteConfirmBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.5,
      color: Brand.ink,
      lineHeight: 19,
      marginBottom: 12,
    },
    deleteConfirmUsername: {
      fontFamily: BrandFonts.syneBold,
      color: Brand.ink,
    },
    deleteConfirmInput: {
      backgroundColor: Brand.paper,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      marginBottom: 12,
    },
    deleteConfirmActions: {
      flexDirection: 'row',
      gap: 10,
    },
    deleteConfirmCancel: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Brand.border,
      alignItems: 'center',
    },
    deleteConfirmCancelText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13.5,
      color: Brand.muted,
    },
    deleteConfirmConfirm: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: 12,
      backgroundColor: '#E84F4F',
      alignItems: 'center',
    },
    deleteConfirmConfirmDisabled: {
      opacity: 0.4,
    },
    deleteConfirmConfirmText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13.5,
      color: '#fff',
    },
  });
}
