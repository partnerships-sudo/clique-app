import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useUpdatePost } from '@/features/feed/api';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export default function EditPostModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const params = useLocalSearchParams<{
    postId: string;
    postTitle: string;
    currentNote: string;
    currentRating: string;
    currentVisibility: string;
  }>();

  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const updatePost = useUpdatePost();

  const [note, setNote] = useState(params.currentNote ?? '');
  const [rating, setRating] = useState(Number(params.currentRating) || 0);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(params.currentVisibility === 'close_friends');

  async function handleSave() {
    await updatePost.mutateAsync({
      postId: params.postId,
      note: note.trim() || null,
      rating: rating || null,
      visibility: closeFriendsOnly ? 'close_friends' : 'everyone',
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>

        <Text style={styles.title} numberOfLines={2}>{params.postTitle}</Text>

        <Text style={styles.sectionLabel}>Your rating</Text>
        <View style={styles.ratingRow}>
          <RatingPicker
            value={rating}
            iconStyle={ratingIcon}
            onChange={(v) => setRating(v === 0 ? 0 : v)}
            size={36}
          />
        </View>

        <Text style={styles.sectionLabel}>Your note</Text>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note (optional)"
          placeholderTextColor={Brand.muted}
          value={note}
          onChangeText={setNote}
          multiline
          autoFocus={false}
        />

        <Pressable
          style={styles.visibilityRow}
          onPress={() => setCloseFriendsOnly((v) => !v)}
          hitSlop={4}>
          <View style={styles.visibilityInfo}>
            <Text style={styles.visibilityLabel}>💚 Close Friends only</Text>
            <Text style={styles.visibilitySub}>Only your close friends list will see this</Text>
          </View>
          <View style={[styles.circle, closeFriendsOnly && styles.circleActive]}>
            {closeFriendsOnly ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
        </Pressable>

        <Pressable
          style={[styles.saveBtn, updatePost.isPending && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={updatePost.isPending}>
          {updatePost.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save changes</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.card },
    scroll: { padding: Spacing.four, paddingBottom: Spacing.six },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 20,
      color: Brand.ink,
      marginBottom: Spacing.four,
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },
    ratingRow: {
      marginBottom: Spacing.four,
    },
    noteInput: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.paper,
      minHeight: 100,
      textAlignVertical: 'top',
      marginBottom: Spacing.three,
    },
    visibilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.paper,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: 14,
      marginBottom: Spacing.four,
      gap: 12,
    },
    visibilityInfo: { flex: 1 },
    visibilityLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 2 },
    visibilitySub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    circle: {
      width: 24, height: 24, borderRadius: 12,
      borderWidth: 2, borderColor: Brand.border,
      alignItems: 'center', justifyContent: 'center',
    },
    circleActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    checkmark: { color: '#fff', fontSize: 13, fontFamily: BrandFonts.syneBold },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    saveBtnDisabled: { opacity: 0.5 },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15.5, color: '#fff' },
  });
}
