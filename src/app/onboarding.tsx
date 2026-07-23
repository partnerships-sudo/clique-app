import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TourScreen } from '@/components/onboarding/tour-screen';

import { Avatar } from '@/components/avatar';
import { RATING_ICON_OPTIONS, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useDiscoverPeople, useFollow, useSearchUsers, type Profile } from '@/features/follows/api';
import { useUpdateContentTypes, useUpdateRatingIcon, useUploadAvatar } from '@/features/profile/api';
import { registerForPushNotificationsAsync } from '@/lib/push-notifications';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const TOTAL_STEPS = 8; // 0 = welcome … 8 = all set

const CONTENT_TYPES = [
  { value: 'watch',   label: 'Movies'   },
  { value: 'tv',      label: 'TV Shows'  },
  { value: 'read',    label: 'Books'     },
  { value: 'listen',  label: 'Music'     },
  { value: 'play',    label: 'Games'     },
  { value: 'podcast', label: 'Podcasts'  },
] as const;
type ContentValue = typeof CONTENT_TYPES[number]['value'];


export default function OnboardingScreen() {
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { debugStep } = useLocalSearchParams<{ debugStep?: string }>();

  const [step, setStep] = useState(debugStep ? parseInt(debugStep, 10) : 0);
  const [selectedTypes, setSelectedTypes] = useState<Set<ContentValue>>(new Set());
  const [friendQuery, setFriendQuery] = useState('');
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [notifDone, setNotifDone] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const [selectedRatingIcon, setSelectedRatingIcon] = useState<RatingIconStyle>('stars');
  const uploadAvatar = useUploadAvatar();
  const updateRatingIcon = useUpdateRatingIcon();
  const updateContentTypes = useUpdateContentTypes();
  const follow = useFollow();
  const { data: suggested = [] } = useDiscoverPeople('mutual', '');
  const { data: searchResults = [] } = useSearchUsers(friendQuery);

  const friendList: Profile[] = friendQuery.length >= 2 ? searchResults : suggested.slice(0, 10);

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      await uploadAvatar.mutateAsync(result.assets[0].uri);
    }
  }

  function toggleType(value: ContentValue) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(value) ? next.delete(value) : next.add(value);
      return next;
    });
  }

  async function handleFollow(profile: Profile) {
    setFollowedIds((prev) => new Set([...prev, profile.id]));
    follow.mutate({ targetUserId: profile.id, isTargetPrivate: profile.is_private ?? false });
  }

  async function handleNotifications() {
    await registerForPushNotificationsAsync();
    setNotifDone(true);
  }

  async function complete() {
    if (user) {
      await AsyncStorage.setItem(`clique:onboarding:${user.id}`, 'done');
    }
    // Normalize onboarding picks to valid EntryType slugs ('tv' → 'watch')
    // and persist to the profile so the feed can seed hidden categories.
    const normalizedTypes = [...new Set(
      [...selectedTypes].map((t) => (t === 'tv' ? 'watch' : t))
    )];
    await Promise.all([
      updateRatingIcon.mutateAsync(selectedRatingIcon),
      selectedTypes.size > 0
        ? updateContentTypes.mutateAsync(normalizedTypes)
        : Promise.resolve(),
    ]);
    router.replace('/(tabs)');
  }

  const progress = step / TOTAL_STEPS;

  // Step 7: full-screen interactive tour — render outside SafeAreaView so the
  // spotlight overlay can cover the entire screen including safe areas.
  if (step === 7) {
    return (
      <View style={{ flex: 1 }}>
        <TourScreen onComplete={next} onSkip={next} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Progress bar */}
      {step > 0 && step < TOTAL_STEPS && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {/* Back button */}
      {step > 0 && step < TOTAL_STEPS && (
        <Pressable style={styles.backBtn} onPress={back} hitSlop={12}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.muted} type="monochrome" />
        </Pressable>
      )}

      {/* ── Step 0: Welcome ── */}
      {step === 0 && (
        <View style={styles.centered}>
          <Text style={styles.welcomeLogo}>Clique</Text>
          <Text style={styles.welcomeTagline}>Skip the algorithm.{'\n'}Trust your people.</Text>
          <Text style={styles.welcomeSub}>
            Log what you're into. Share with the people who get you. Get recs from people whose taste you actually trust.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>Let's get started</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 1: Profile photo ── */}
      {step === 1 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>Add a photo</Text>
          <Text style={styles.stepSub}>Help your friends find you.</Text>
          <Pressable style={styles.avatarPicker} onPress={pickPhoto} disabled={uploadAvatar.isPending}>
            {uploadAvatar.isPending ? (
              <ActivityIndicator color={Brand.trust} />
            ) : (
              <>
                <Avatar name={user?.email ?? 'You'} size={96} />
                <View style={styles.avatarEditBadge}>
                  <SymbolView name="camera.fill" size={14} tintColor="#fff" type="monochrome" />
                </View>
              </>
            )}
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>
              {uploadAvatar.isSuccess ? 'Looking good →' : 'Continue'}
            </Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={next} hitSlop={8}>
            <Text style={styles.skipBtnText}>Skip for now</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 2: Taste picker ── */}
      {step === 2 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>What are you into?</Text>
          <Text style={styles.stepSub}>We'll tune your Feed and Library to match.</Text>
          <View style={styles.chipGrid}>
            {CONTENT_TYPES.map(({ value, label }) => {
              const active = selectedTypes.has(value);
              return (
                <Pressable
                  key={value}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleType(value)}>
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={[styles.primaryBtn, selectedTypes.size === 0 && styles.primaryBtnMuted]}
            onPress={next}>
            <Text style={styles.primaryBtnText}>
              {selectedTypes.size === 0 ? 'Skip' : 'Continue'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 3: Rating style ── */}
      {step === 3 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>How do you rate?</Text>
          <Text style={styles.stepSub}>Pick your rating icon — it shows up on all your posts and logs.</Text>
          <View style={styles.ratingPickerGrid}>
            {RATING_ICON_OPTIONS.map((opt) => {
              const active = selectedRatingIcon === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  style={[styles.ratingOption, active && styles.ratingOptionActive]}
                  onPress={() => setSelectedRatingIcon(opt.value)}>
                  <Text style={styles.ratingOptionEmoji}>{opt.emoji}</Text>
                  <Text style={[styles.ratingOptionLabel, active && styles.ratingOptionLabelActive]}>{opt.label}</Text>
                  <View style={styles.ratingPreview}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Text key={i} style={[styles.ratingPreviewIcon, { opacity: i <= 3 ? 1 : 0.25 }]}>
                        {opt.emoji}
                      </Text>
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>Continue</Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 4: Find friends ── */}
      {step === 4 && (
        <View style={styles.stepWrap}>
          <Text style={styles.stepTitle}>Find your people</Text>
          <Text style={styles.stepSub}>Follow friends to see their taste.</Text>

          {/* Quick-connect buttons */}
          <Pressable
            style={styles.connectBtn}
            onPress={() => Alert.alert('Connect Facebook', 'Coming soon — find friends already on Clique through your Facebook account.')}>
            <View style={[styles.connectIcon, { backgroundColor: '#1877F2' }]}>
              <Text style={styles.connectIconLetter}>f</Text>
            </View>
            <Text style={styles.connectLabel}>Connect Facebook</Text>
          </Pressable>
          <Pressable
            style={[styles.connectBtn, { marginBottom: 20 }]}
            onPress={() => Alert.alert('Sync Contacts', 'Coming soon — match your phone contacts against people already on Clique.')}>
            <View style={[styles.connectIcon, { backgroundColor: '#8E44AD' }]}>
              <Text style={styles.connectIconGlyph}>👥</Text>
            </View>
            <Text style={styles.connectLabel}>Sync Contacts</Text>
          </Pressable>

          <View style={styles.searchRow}>
            <SymbolView name="magnifyingglass" size={15} tintColor={Brand.muted} type="monochrome" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by username…"
              placeholderTextColor={Brand.muted}
              value={friendQuery}
              onChangeText={setFriendQuery}
              autoCapitalize="none"
            />
          </View>
          {friendQuery.length === 0 && (
            <Text style={styles.sectionLabel}>Suggested</Text>
          )}
          <ScrollView style={styles.friendList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {friendList.map((profile) => {
              const name = profile.full_name || profile.username || 'Someone';
              const followed = followedIds.has(profile.id);
              return (
                <View key={profile.id} style={styles.friendRow}>
                  <Avatar name={name} size={40} avatarUrl={profile.avatar_url} />
                  <View style={styles.friendInfo}>
                    <Text style={styles.friendName}>{name}</Text>
                    {profile.username ? (
                      <Text style={styles.friendHandle}>@{profile.username}</Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={[styles.followBtn, followed && styles.followBtnDone]}
                    onPress={() => !followed && handleFollow(profile)}
                    disabled={followed}>
                    <Text style={[styles.followBtnText, followed && styles.followBtnTextDone]}>
                      {followed ? 'Following' : '+ Follow'}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
            {/* Spacer so the last friend row isn't hidden under the button */}
            <View style={{ height: 80 }} />
          </ScrollView>
          <Pressable style={styles.primaryBtn} onPress={next}>
            <Text style={styles.primaryBtnText}>
              {followedIds.size > 0 ? `Continue (${followedIds.size} followed)` : 'Skip'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Step 5: Notifications ── */}
      {step === 5 && (
        <View style={styles.centered}>
          <View style={styles.notifIconWrap}>
            <SymbolView name="bell.badge.fill" size={48} tintColor={Brand.trust} type="monochrome" />
          </View>
          <Text style={styles.stepTitle}>Stay in the loop</Text>
          <Text style={styles.stepSub}>
            Get notified when friends share recs, react to your posts, or follow you — plus gentle reminders to keep your library up to date.
          </Text>
          <Pressable
            style={[styles.primaryBtn, notifDone && styles.primaryBtnDone]}
            onPress={notifDone ? next : handleNotifications}>
            <Text style={styles.primaryBtnText}>
              {notifDone ? 'Continue →' : 'Enable notifications'}
            </Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={next} hitSlop={8}>
            <Text style={styles.skipBtnText}>Not now</Text>
          </Pressable>
          <Text style={styles.settingsNote}>You can adjust these anytime in Settings.</Text>
        </View>
      )}

      {/* ── Step 6: Import library ── */}
      {step === 6 && (
        <View style={styles.centered}>
          <View style={styles.importIconWrap}>
            <SymbolView name="square.and.arrow.down.fill" size={40} tintColor={Brand.trust} type="monochrome" />
          </View>
          <Text style={styles.stepTitle}>Bring your history</Text>
          <Text style={[styles.stepSub, { textAlign: 'center' }]}>
            Already logging on Letterboxd or Goodreads? Import your library and keep everything in one place.
          </Text>
          <View style={styles.importSources}>
            <View style={styles.importSource}>
              <Text style={styles.importSourceEmoji}>🎬</Text>
              <Text style={styles.importSourceLabel}>Letterboxd</Text>
            </View>
            <View style={styles.importSourceDivider} />
            <View style={styles.importSource}>
              <Text style={styles.importSourceEmoji}>📚</Text>
              <Text style={styles.importSourceLabel}>Goodreads</Text>
            </View>
          </View>
          <Pressable
            style={[styles.primaryBtn, importDone && styles.primaryBtnDone]}
            onPress={importDone ? next : () => { setImportDone(true); router.push('/import-library-modal'); }}>
            <Text style={styles.primaryBtnText}>{importDone ? 'Continue →' : 'Import library'}</Text>
          </Pressable>
          <Pressable style={styles.skipBtn} onPress={next} hitSlop={8}>
            <Text style={styles.skipBtnText}>I'll do it later</Text>
          </Pressable>
        </View>
      )}

      {/* Step 7 is the interactive tour — rendered above the SafeAreaView */}

      {/* ── Step 8: All set ── */}
      {step === TOTAL_STEPS && (
        <View style={styles.centered}>
          <SymbolView name="checkmark.circle.fill" size={64} tintColor="#34D399" type="monochrome" />
          <Text style={[styles.welcomeLogo, { marginTop: 24 }]}>You're all set</Text>
          <Text style={styles.welcomeSub}>
            Log something, find your people, and start seeing taste you actually trust.
          </Text>
          <Pressable style={styles.primaryBtn} onPress={complete}>
            <Text style={styles.primaryBtnText}>Let's go →</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    progressTrack: {
      height: 3,
      backgroundColor: Brand.border,
      marginHorizontal: Spacing.four,
      borderRadius: 2,
      marginTop: 12,
    },
    progressFill: {
      height: '100%',
      backgroundColor: Brand.trust,
      borderRadius: 2,
    },
    backBtn: {
      position: 'absolute',
      top: 56,
      left: Spacing.four,
      zIndex: 10,
      padding: 4,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.five,
    },
    stepWrap: {
      flex: 1,
      paddingHorizontal: Spacing.four,
      paddingTop: 56,
    },
    welcomeLogo: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 38,
      color: Brand.trust,
      letterSpacing: -1,
      textAlign: 'center',
    },
    welcomeTagline: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.ink,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 30,
    },
    welcomeSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 22,
      marginTop: 14,
      marginBottom: 36,
    },
    stepTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 26,
      color: Brand.ink,
      letterSpacing: -0.5,
      marginBottom: 8,
      marginTop: 20,
    },
    stepSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.muted,
      lineHeight: 22,
      marginBottom: 28,
    },
    primaryBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 32,
      alignItems: 'center',
      marginTop: 8,
      alignSelf: 'stretch',
    },
    primaryBtnMuted: { backgroundColor: Brand.tlight },
    primaryBtnDone: { backgroundColor: '#34D399' },
    primaryBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      color: '#fff',
    },
    skipBtn: { alignItems: 'center', paddingVertical: 14 },
    skipBtnText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
    },
    // Photo step
    avatarPicker: {
      alignSelf: 'center',
      marginBottom: 36,
      marginTop: 12,
      position: 'relative',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Brand.paper,
    },
    // Taste picker
    chipGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 32,
    },
    chip: {
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    chipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    chipText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
    },
    chipTextActive: { color: '#fff' },
    // Rating style step
    ratingPickerGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 32,
    },
    ratingOption: {
      flex: 1,
      minWidth: '45%',
      alignItems: 'center',
      paddingVertical: 18,
      paddingHorizontal: 12,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
      gap: 6,
    },
    ratingOptionActive: {
      borderColor: Brand.trust,
      backgroundColor: Brand.tlight,
    },
    ratingOptionEmoji: { fontSize: 32 },
    ratingOptionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
    },
    ratingOptionLabelActive: { color: Brand.trust },
    ratingPreview: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 2,
    },
    ratingPreviewIcon: { fontSize: 11 },
    // Friends step — connect buttons
    connectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 14,
      marginBottom: 10,
    },
    connectIcon: {
      width: 38,
      height: 38,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectIconLetter: {
      fontSize: 20,
      color: '#fff',
      fontFamily: BrandFonts.syneExtraBold,
    },
    connectIconGlyph: { fontSize: 18 },
    connectLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginBottom: 16,
    },
    searchInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14.5,
      color: Brand.ink,
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    friendList: { flex: 1, marginBottom: 12 },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    friendInfo: { flex: 1, minWidth: 0 },
    friendName: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    friendHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 1 },
    followBtn: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 10,
      backgroundColor: Brand.trust,
    },
    followBtnDone: { backgroundColor: Brand.tlight },
    followBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: '#fff' },
    followBtnTextDone: { color: Brand.muted },
    // Import library step
    importIconWrap: {
      width: 88,
      height: 88,
      borderRadius: 26,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    importSources: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      paddingVertical: 18,
      paddingHorizontal: 32,
      gap: 0,
      marginBottom: 28,
      alignSelf: 'stretch',
    },
    importSource: { flex: 1, alignItems: 'center', gap: 6 },
    importSourceEmoji: { fontSize: 32 },
    importSourceLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.ink,
    },
    importSourceDivider: { width: 1, height: 40, backgroundColor: Brand.border },
    // Notifications step
    notifIconWrap: {
      width: 96,
      height: 96,
      borderRadius: 28,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    settingsNote: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 12,
    },
  });
}
