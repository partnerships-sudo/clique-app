import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '@/hooks/use-session';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

export default function SignupScreen() {
  const { signUp, session } = useSession();
  const router = useRouter();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (session && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/(tabs)');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setMessage({ text: 'Please fill in all fields', isError: true });
      return;
    }
    if (password.length < 6) {
      setMessage({ text: 'Password must be at least 6 characters', isError: true });
      return;
    }
    if (!name.trim()) {
      setMessage({ text: 'Please enter your name', isError: true });
      return;
    }
    setIsSubmitting(true);
    setMessage(null);
    const { error } = await signUp({
      email: email.trim(),
      password,
      fullName: name.trim(),
      username: username.trim().replace('@', '') || email.split('@')[0],
    });
    setIsSubmitting(false);
    if (error) {
      setMessage({ text: error, isError: true });
      return;
    }
    setMessage({ text: 'Welcome to Clique!', isError: false });
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}>
            <Text style={{ color: Brand.trust }}>Clique</Text>
          </Text>
          <Text style={styles.tagline}>Skip the algorithm. Trust your people.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.tabRow}>
            <Link href="/(auth)" asChild replace>
              <Pressable style={styles.tab}>
                <Text style={styles.tabText}>Log in</Text>
              </Pressable>
            </Link>
            <View style={[styles.tab, styles.tabActive]}>
              <Text style={styles.tabTextActive}>Sign up</Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={Brand.muted}
            value={name}
            onChangeText={setName}
            autoComplete="name"
          />
          <TextInput
            style={styles.input}
            placeholder="Username e.g. @alexj"
            placeholderTextColor={Brand.muted}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Email address"
            placeholderTextColor={Brand.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={Brand.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Pressable
            style={[styles.submitBtn, isSubmitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>Create account →</Text>
            )}
          </Pressable>

          {message ? (
            <Text style={[styles.message, { color: message.isError ? '#E84F4F' : '#4FE87B' }]}>
              {message.text}
            </Text>
          ) : null}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  flex: { flex: 1 },
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
  tagline: {
    fontFamily: BrandFonts.interRegular,
    color: Brand.muted,
    fontSize: 14,
    marginTop: 6,
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
  tabRow: {
    flexDirection: 'row',
    backgroundColor: Brand.tlight,
    borderRadius: 12,
    padding: 4,
    marginBottom: Spacing.three,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: Brand.trust,
  },
  tabText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13.6,
    color: Brand.muted,
  },
  tabTextActive: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13.6,
    color: '#fff',
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
  submitBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 6,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  submitText: {
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
