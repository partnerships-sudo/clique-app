import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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
      {/* Avatar */}
      <View style={styles.avatarRow}>
        <Pressable style={styles.avatarPressable} onPress={handleChangePhoto} disabled={uploadAvatar.isPending}>
          <View style={styles.avatarWrap}>
            <Avatar name={fullName || 'You'} size={64} avatarUrl={profile?.avatar_url} />
            <View style={styles.cameraBadge}>
              {uploadAvatar.isPending
                ? <ActivityIndicator color="#fff" size="small" />
                : <SymbolView name="camera.fill" size={12} tintColor="#fff" type="monochrome" />}
            </View>
          </View>
          <View style={styles.avatarMeta}>
            <Text style={styles.avatarName}>{fullName || 'Your name'}</Text>
            {username ? <Text style={styles.avatarHandle}>@{username}</Text> : null}
            <Text style={styles.changePhotoText}>Change photo</Text>
          </View>
        </Pressable>
        <Pressable style={styles.cogBtn} onPress={() => router.push('/settings')}>
          <SymbolView name="gearshape" size={20} tintColor={Brand.muted} type="monochrome" />
        </Pressable>
      </View>

      {/* Basic info — grouped card */}
      <Text style={styles.secLbl}>Basic info</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Full name</Text>
          <TextInput style={styles.rowInput} value={fullName} onChangeText={setFullName} placeholder="Your name" placeholderTextColor="#999" />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Username</Text>
          <TextInput style={styles.rowInput} value={username} onChangeText={(t) => setUsername(t.toLowerCase())} autoCapitalize="none" placeholder="@handle" placeholderTextColor="#999" />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Location</Text>
          <TextInput style={styles.rowInput} value={location} onChangeText={setLocation} placeholder="City, Country" placeholderTextColor="#999" />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, { alignItems: 'flex-start' }]}>
          <Text style={[styles.rowLabel, { paddingTop: 2 }]}>Bio</Text>
          <View style={styles.bioWrap}>
            <TextInput
              style={styles.bioInput}
              value={bio}
              onChangeText={(t) => t.length <= 150 && setBio(t)}
              multiline
              placeholder="A little about you…"
              placeholderTextColor="#999"
            />
            <Text style={styles.bioCount}>{bio.length}/150</Text>
          </View>
        </View>
      </View>

      {/* Rating icon */}
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

      {/* Interests */}
      <Text style={styles.secLbl}>Interests</Text>
      <ChipRow
        chips={interests}
        onToggle={(i) =>
          onInterestsChange(interests.map((c, idx) => (idx === i ? { ...c, on: !c.on } : c)))
        }
      />

      {/* Genres */}
      <Text style={[styles.secLbl, { marginTop: 14 }]}>Favourite genres</Text>
      <ChipRow
        chips={genres}
        variant="dark"
        onToggle={(i) => setGenres((prev) => prev.map((c, idx) => (idx === i ? { ...c, on: !c.on } : c)))}
      />

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving}>
        {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>Save profile</Text>}
      </Pressable>

      <View style={styles.footerRow}>
        <Pressable style={styles.footerBtn} onPress={() => router.push('/watch-parties-modal')}>
          <SymbolView name="popcorn" size={15} tintColor={Brand.muted} type="monochrome" />
          <Text style={styles.footerText}>Watch parties</Text>
        </Pressable>
      </View>

      <Pressable style={styles.logoutBtn} onPress={() => signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

export { DEFAULT_INTERESTS };

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    // Avatar row
    avatarRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 16,
    },
    avatarPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      flex: 1,
    },
    cogBtn: { padding: 6 },
    avatarWrap: { position: 'relative' },
    cameraBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Brand.paper,
    },
    avatarMeta: { flex: 1, gap: 1 },
    avatarName: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    avatarHandle: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    changePhotoText: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.trust, marginTop: 4 },

    // Section label
    secLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 6,
      marginTop: 14,
    },

    // Grouped card
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 4,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 9,
      gap: 10,
    },
    rowLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: Brand.muted,
      width: 78,
    },
    rowInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      padding: 0,
    },
    divider: { height: 1, backgroundColor: Brand.border, marginLeft: 14 },
    bioWrap: { flex: 1 },
    bioInput: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      padding: 0,
      minHeight: 60,
      textAlignVertical: 'top',
    },
    bioCount: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
      textAlign: 'right',
      marginTop: 4,
    },

    // Rating icons
    ratingIconRow: { flexDirection: 'row', gap: 8, marginBottom: 2 },
    ratingIconBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 8,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    ratingIconBtnActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    ratingIconEmoji: { fontSize: 20 },
    ratingIconLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.muted },
    ratingIconLabelActive: { color: Brand.trust },

    // Save button
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 18,
      marginBottom: 4,
    },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },

    // Footer links
    footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 6 },
    footerBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
    footerText: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted },
    logoutBtn: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
    logoutText: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: '#E84F4F' },
  });
}
