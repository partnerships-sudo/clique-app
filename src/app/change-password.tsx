import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { supabase } from '@/lib/supabase';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function ChangePasswordScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { session } = useSession();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  async function handleChange() {
    if (!current || !next || !confirm) {
      setMessage({ text: 'Please fill in all fields', isError: true });
      return;
    }
    if (next.length < 6) {
      setMessage({ text: 'New password must be at least 6 characters', isError: true });
      return;
    }
    if (next !== confirm) {
      setMessage({ text: "New passwords don't match", isError: true });
      return;
    }
    if (next === current) {
      setMessage({ text: 'New password must be different from your current one', isError: true });
      return;
    }

    setIsSubmitting(true);
    setMessage(null);

    // Re-authenticate with current password first
    const email = session?.user?.email;
    if (!email) {
      setMessage({ text: 'Could not verify your account. Please sign in again.', isError: true });
      setIsSubmitting(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (signInError) {
      setMessage({ text: 'Current password is incorrect', isError: true });
      setIsSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: next });
    setIsSubmitting(false);

    if (error) {
      setMessage({ text: error.message, isError: true });
      return;
    }

    setMessage({ text: 'Password updated successfully', isError: false });
    setCurrent('');
    setNext('');
    setConfirm('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backRow}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Change password</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Current password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter current password"
            placeholderTextColor={Brand.muted}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoFocus
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>New password</Text>
          <TextInput
            style={styles.input}
            placeholder="At least 6 characters"
            placeholderTextColor={Brand.muted}
            value={next}
            onChangeText={setNext}
            secureTextEntry
          />

          <Text style={[styles.fieldLabel, { marginTop: 16 }]}>Confirm new password</Text>
          <TextInput
            style={styles.input}
            placeholder="Repeat new password"
            placeholderTextColor={Brand.muted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            onSubmitEditing={handleChange}
            returnKeyType="done"
          />

          {message && (
            <Text style={[styles.message, { color: message.isError ? '#E84F4F' : '#22C55E' }]}>
              {message.text}
            </Text>
          )}

          <Pressable
            style={[styles.btn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleChange}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Update password</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    scroll: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    backRow: { paddingTop: 12, marginBottom: Spacing.two },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink, marginBottom: Spacing.four },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: Spacing.three,
    },
    fieldLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    input: {
      backgroundColor: Brand.paper,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14.4,
      color: Brand.ink,
      fontFamily: BrandFonts.interRegular,
    },
    message: {
      marginTop: 14,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      textAlign: 'center',
    },
    btn: {
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 24,
    },
    btnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
