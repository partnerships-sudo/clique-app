import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { endPasswordRecovery } from '@/lib/auth-routing';
import { supabase } from '@/lib/supabase';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export default function ResetPasswordScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (!password || !confirm) {
      setMessage({ text: 'Please fill in both fields', isError: true });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', isError: true });
      return;
    }
    if (password !== confirm) {
      setMessage({ text: 'Passwords don\'t match', isError: true });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setIsSubmitting(false);
      setMessage({ text: error.message, isError: true });
      return;
    }
    // The recovery link left us holding a session. Drop it so the user signs in
    // with the new password, which is what the confirmation copy promises.
    endPasswordRecovery();
    await supabase.auth.signOut();
    setIsSubmitting(false);
    setDone(true);
  }

  if (done) {
    return (
      <KeyboardAvoidingWrapper>
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>Password updated ✓</Text>
            <Text style={styles.sub}>You're all set. Log in with your new password.</Text>
            <Pressable style={styles.btn} onPress={() => router.replace('/(auth)')}>
              <Text style={styles.btnText}>Go to login →</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingWrapper>
    );
  }

  return (
    <KeyboardAvoidingWrapper>
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}><Text style={{ color: Brand.trust }}>Clique</Text></Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.sub}>Choose something you haven't used before.</Text>

          <TextInput
            style={styles.input}
            placeholder="New password"
            placeholderTextColor={Brand.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoFocus
          />
          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor={Brand.muted}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
            onSubmitEditing={handleReset}
            returnKeyType="done"
          />

          <Pressable
            style={[styles.btn, isSubmitting && { opacity: 0.7 }]}
            onPress={handleReset}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Update password →</Text>
            )}
          </Pressable>

          {message && (
            <Text style={[styles.message, { color: message.isError ? '#E84F4F' : '#4FE87B' }]}>
              {message.text}
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingWrapper>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Brand.paper,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    logoBlock: {
      alignItems: 'center',
      marginBottom: Spacing.five,
    },
    logo: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 32,
      color: Brand.ink,
      letterSpacing: -1,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 20,
      padding: Spacing.four,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 20,
      color: Brand.ink,
      marginBottom: 6,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.5,
      color: Brand.muted,
      marginBottom: 20,
      lineHeight: 20,
    },
    input: {
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14.4,
      color: Brand.ink,
      fontFamily: BrandFonts.interRegular,
      marginBottom: 10,
    },
    btn: {
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    btnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: '#fff',
    },
    message: {
      marginTop: 12,
      textAlign: 'center',
      fontSize: 12.8,
      fontFamily: BrandFonts.interRegular,
    },
  });
}
