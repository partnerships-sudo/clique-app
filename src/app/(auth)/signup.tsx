import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useSession } from '@/hooks/use-session';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isUnder13(day: number, month: number, year: number): boolean {
  const today = new Date();
  const thirteenth = new Date(today.getFullYear() - 13, today.getMonth(), today.getDate());
  const dob = new Date(year, month, day);
  return dob > thirteenth;
}

function AgeGate({ onPass }: { onPass: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState<number | null>(null);
  const [year, setYear] = useState('');
  const [blocked, setBlocked] = useState(false);

  function handleCheck() {
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (!d || month === null || !y || y < 1900 || y > new Date().getFullYear()) return;
    if (isUnder13(d, month, y)) {
      setBlocked(true);
    } else {
      onPass();
    }
  }

  const canCheck = day.length > 0 && month !== null && year.length === 4;

  if (blocked) {
    return (
      <View style={styles.container}>
        <View style={styles.logoBlock}>
          <Text style={styles.logo}><Text style={{ color: Brand.trust }}>Clique</Text></Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.ageGateTitle}>Sorry, you're not eligible</Text>
          <Text style={styles.ageGateSub}>
            You must be 13 or older to create a Clique account.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.logoBlock}>
        <Text style={styles.logo}><Text style={{ color: Brand.trust }}>Clique</Text></Text>
        <Text style={styles.tagline}>Skip the algorithm. Trust your people.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.ageGateTitle}>When's your birthday?</Text>
        <Text style={styles.ageGateSub}>We need to confirm you're old enough to use Clique.</Text>

        <View style={styles.ageRow}>
          <TextInput
            style={[styles.input, styles.ageInputDay]}
            placeholder="DD"
            placeholderTextColor={Brand.muted}
            value={day}
            onChangeText={(v) => setDay(v.replace(/\D/g, '').slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.monthScroll} contentContainerStyle={styles.monthScrollContent}>
            {MONTHS.map((m, i) => (
              <Pressable
                key={m}
                style={[styles.monthChip, month === i && styles.monthChipActive]}
                onPress={() => setMonth(i)}>
                <Text style={[styles.monthChipText, month === i && styles.monthChipTextActive]}>{m}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <TextInput
            style={[styles.input, styles.ageInputYear]}
            placeholder="YYYY"
            placeholderTextColor={Brand.muted}
            value={year}
            onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))}
            keyboardType="number-pad"
            maxLength={4}
          />
        </View>

        <Pressable
          style={[styles.submitBtn, !canCheck && styles.submitBtnDisabled]}
          onPress={handleCheck}
          disabled={!canCheck}>
          <Text style={styles.submitText}>Continue →</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SignupScreen() {
  const { signUp, session } = useSession();
  const router = useRouter();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [ageVerified, setAgeVerified] = useState(false);
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
      AsyncStorage.getItem(`clique:onboarding:${session.user.id}`).then((done) => {
        router.replace(done ? '/(tabs)' : '/onboarding');
      });
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

  if (!ageVerified) {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <AgeGate onPass={() => setAgeVerified(true)} />
      </KeyboardAvoidingView>
    );
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
  ageGateTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: Brand.ink,
    marginBottom: 8,
    textAlign: 'center',
  },
  ageGateSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.5,
    color: Brand.muted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  ageRow: { gap: 10, marginBottom: 16 },
  ageInputDay: { marginBottom: 0 },
  ageInputYear: { marginBottom: 0 },
  monthScroll: { flexGrow: 0 },
  monthScrollContent: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  monthChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.card,
  },
  monthChipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
  monthChipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  monthChipTextActive: { color: '#fff' },
  });
}
