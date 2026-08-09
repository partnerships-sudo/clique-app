import AsyncStorage from '@react-native-async-storage/async-storage';
import { Link, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { DrumPicker, daysInMonth, MONTH_LABELS, ITEM_H } from '@/components/drum-picker';

import { useSession } from '@/hooks/use-session';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

// ─── Birthday drum-roll picker ────────────────────────────────────────────────

const THIS_YEAR = new Date().getFullYear();
// Years oldest → newest so scrolling down = more recent
const YEAR_ITEMS = Array.from({ length: THIS_YEAR - 1919 }, (_, i) => String(1920 + i));
const DEFAULT_YEAR_IDX = YEAR_ITEMS.indexOf('2000'); // start at year 2000

function isUnder13(day: number, monthIdx: number, year: number): boolean {
  const thirteenth = new Date(THIS_YEAR - 13, new Date().getMonth(), new Date().getDate());
  return new Date(year, monthIdx, day) > thirteenth;
}

// ─── Age gate screen ──────────────────────────────────────────────────────────

function AgeGate({ onPass }: { onPass: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [dayIdx, setDayIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const [yearIdx, setYearIdx] = useState(DEFAULT_YEAR_IDX);
  const [blocked, setBlocked] = useState(false);
  const dayScrollRef = useRef<ScrollView>(null);

  const year = 1920 + yearIdx;
  const maxDays = daysInMonth(monthIdx, year);
  const dayItems = Array.from({ length: maxDays }, (_, i) => String(i + 1));

  // Clamp day when month/year changes shrinks the valid range
  function handleMonthChange(idx: number) {
    setMonthIdx(idx);
    const max = daysInMonth(idx, year) - 1;
    if (dayIdx > max) {
      setDayIdx(max);
      dayScrollRef.current?.scrollTo({ y: max * ITEM_H, animated: true });
    }
  }

  function handleYearChange(idx: number) {
    setYearIdx(idx);
    const max = daysInMonth(monthIdx, 1920 + idx) - 1;
    if (dayIdx > max) {
      setDayIdx(max);
      dayScrollRef.current?.scrollTo({ y: max * ITEM_H, animated: true });
    }
  }

  function handleCheck() {
    const day = dayIdx + 1;
    if (isUnder13(day, monthIdx, year)) {
      setBlocked(true);
    } else {
      onPass();
    }
  }

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

        {/* Column labels */}
        <View style={styles.drumLabels}>
          <Text style={styles.drumLabel}>Day</Text>
          <Text style={styles.drumLabel}>Month</Text>
          <Text style={styles.drumLabel}>Year</Text>
        </View>

        {/* Drum-roll pickers */}
        <View style={styles.drumRow}>
          <DrumPicker
            items={dayItems}
            selectedIndex={dayIdx}
            onSelect={setDayIdx}
            scrollRef={dayScrollRef}
          />
          <View style={styles.drumDivider} />
          <DrumPicker
            items={MONTH_LABELS}
            selectedIndex={monthIdx}
            onSelect={handleMonthChange}
          />
          <View style={styles.drumDivider} />
          <DrumPicker
            items={YEAR_ITEMS}
            selectedIndex={yearIdx}
            onSelect={handleYearChange}
          />
        </View>

        <Pressable style={styles.submitBtn} onPress={handleCheck}>
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
      username: (username.trim().replace('@', '') || email.split('@')[0]).toLowerCase(),
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
      <KeyboardAvoidingWrapper>
        <AgeGate onPass={() => setAgeVerified(true)} />
      </KeyboardAvoidingWrapper>
    );
  }

  return (
    <KeyboardAvoidingWrapper>
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
            onChangeText={(t) => setUsername(t.toLowerCase())}
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
    </KeyboardAvoidingWrapper>
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
    marginBottom: 16,
  },
  drumLabels: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  drumLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: BrandFonts.interMedium,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  drumRow: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 20,
    backgroundColor: Brand.card,
  },
  drumDivider: {
    width: 1,
    backgroundColor: Brand.border,
  },
  });
}
