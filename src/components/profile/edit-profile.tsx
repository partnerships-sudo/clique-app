import * as ImagePicker from 'expo-image-picker';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ChipRow, type Chip } from '@/components/profile/chip-row';
import { RATING_ICON_OPTIONS, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import type { Profile } from '@/features/profile/api';
import { useUploadAvatar } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const DEFAULT_INTERESTS: Chip[] = [
  { label: '🎬 Film', on: true },
  { label: '📺 TV', on: true },
  { label: '📖 Books', on: true },
  { label: '🎮 Gaming', on: true },
  { label: '🎵 Music', on: true },
  { label: '🎙 Podcasts', on: false },
  { label: '🍿 Anime', on: false },
  { label: '📚 Non-fiction', on: true },
  { label: '🌍 Documentaries', on: true },
  { label: '🎭 Theatre', on: false },
  { label: '🎲 Board Games', on: false },
  { label: '🎧 Audiobooks', on: false },
];

const DEFAULT_GENRES: Chip[] = [
  { label: 'Sci-Fi', on: true },
  { label: 'Drama', on: true },
  { label: 'Comedy', on: true },
  { label: 'Thriller', on: false },
  { label: 'Horror', on: false },
  { label: 'Fantasy', on: true },
  { label: 'Action', on: false },
  { label: 'Indie', on: true },
  { label: 'Mystery', on: true },
  { label: 'Hip-Hop', on: true },
  { label: 'Pop', on: false },
  { label: 'Rock', on: true },
  { label: 'RPG', on: true },
];

export function EditProfile({
  profile,
  interests,
  onInterestsChange,
  onSaved,
}: {
  profile: Profile | null | undefined;
  interests: Chip[];
  onInterestsChange: (chips: Chip[]) => void;
  onSaved: (input: {
    full_name: string;
    username: string;
    location: string;
    bio: string;
    rating_icon: string;
  }) => Promise<void>;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { signOut, user } = useSession();
  const uploadAvatar = useUploadAvatar();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [ratingIcon, setRatingIcon] = useState<RatingIconStyle>('stars');
  const [genres, setGenres] = useState<Chip[]>(DEFAULT_GENRES);
  const [isSaving, setIsSaving] = useState(false);

  async function handleChangePhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      await uploadAvatar.mutateAsync(result.assets[0].uri);
    } catch {
      Alert.alert('Upload failed', 'Could not upload your photo. Please try again.');
    }
  }

  useEffect(() => {
    setFullName(profile?.full_name ?? (user?.user_metadata?.full_name as string) ?? '');
    setUsername(profile?.username ?? '');
    setLocation(profile?.location ?? '');
    setBio(profile?.bio ?? '');
    setRatingIcon((profile?.rating_icon as RatingIconStyle) ?? 'stars');
  }, [profile, user]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await onSaved({ full_name: fullName, username, location, bio, rating_icon: ratingIcon });
    } catch {
      Alert.alert('Could not save', 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View>
      <View style={styles.avatarRow}>
        <Avatar name={fullName || 'You'} size={58} avatarUrl={profile?.avatar_url} />
        <Pressable
          style={styles.changePhotoBtn}
          onPress={handleChangePhoto}
          disabled={uploadAvatar.isPending}>
          {uploadAvatar.isPending ? (
            <ActivityIndicator color={Brand.trust} />
          ) : (
            <Text style={styles.changePhotoText}>Change photo</Text>
          )}
        </Pressable>
      </View>

      <Text style={styles.secLbl}>Basic info</Text>
      <View style={styles.field}>
        <Text style={styles.label}>Full name</Text>
        <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Username</Text>
        <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Location</Text>
        <TextInput style={styles.input} value={location} onChangeText={setLocation} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          multiline
        />
      </View>

      <Text style={styles.secLbl}>Rating icon</Text>
      <View style={styles.ratingIconRow}>
        {RATING_ICON_OPTIONS.map((option) => {
          const active = ratingIcon === option.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.ratingIconBtn, active && styles.ratingIconBtnActive]}
              onPress={() => setRatingIcon(option.value)}>
              <Text style={styles.ratingIconEmoji}>{option.emoji}</Text>
              <Text style={[styles.ratingIconLabel, active && styles.ratingIconLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.secLbl}>Interests</Text>
      <ChipRow
        chips={interests}
        onToggle={(i) =>
          onInterestsChange(interests.map((c, idx) => (idx === i ? { ...c, on: !c.on } : c)))
        }
      />

      <Text style={[styles.secLbl, { marginTop: 18 }]}>Favourite genres</Text>
      <ChipRow
        chips={genres}
        variant="dark"
        onToggle={(i) => setGenres((prev) => prev.map((c, idx) => (idx === i ? { ...c, on: !c.on } : c)))}
      />

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save profile</Text>}
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={() => signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

export { DEFAULT_INTERESTS };

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: Spacing.three,
    },
    changePhotoBtn: { backgroundColor: Brand.tlight, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
    changePhotoText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },
    secLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 10,
      marginTop: 4,
    },
    ratingIconRow: { flexDirection: 'row', gap: 10, marginBottom: 18 },
    ratingIconBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    ratingIconBtnActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    ratingIconEmoji: { fontSize: 22 },
    ratingIconLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11.5, color: Brand.muted },
    ratingIconLabelActive: { color: Brand.trust, fontFamily: BrandFonts.syneBold },
    field: { marginBottom: 12 },
    label: { fontFamily: BrandFonts.interMedium, fontSize: 12.5, color: Brand.ink, marginBottom: 5 },
    input: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.card,
    },
    bioInput: { minHeight: 72, textAlignVertical: 'top' },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 24,
      marginBottom: 10,
    },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    logoutBtn: { alignItems: 'center', paddingVertical: 10 },
    logoutText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#E84F4F' },
  });
}
