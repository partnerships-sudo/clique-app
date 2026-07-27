import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useProfile } from '@/features/profile/api';
import { detectVideoType, useCreateScreeningRoom } from '@/features/screening-rooms/api';
import { useBrand } from '@/hooks/use-brand';

export default function CreateScreeningRoomModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const createRoom = useCreateScreeningRoom();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');

  // Tier gate — Taste Maker is tier 3
  const isTasteMaker = (profile?.verified_tier ?? 0) >= 3;

  async function handleCreate() {
    const t = title.trim();
    const url = videoUrl.trim();
    if (!t) { Alert.alert('Title required', 'Give your screening a name.'); return; }
    if (!url) { Alert.alert('Video URL required', 'Paste a YouTube link or direct video URL.'); return; }

    const videoType = detectVideoType(url);
    if (videoType === 'youtube' && !url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)[a-zA-Z0-9_-]{11}/)) {
      Alert.alert('Invalid YouTube URL', 'Please paste a full YouTube video link.');
      return;
    }

    try {
      const room = await createRoom.mutateAsync({ title: t, description: description.trim() || undefined, video_url: url, video_type: videoType });
      router.replace({ pathname: '/screening-room-live', params: { id: room.id } });
    } catch {
      Alert.alert('Error', 'Could not create screening room. Please try again.');
    }
  }

  if (!isTasteMaker) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.gateHeader}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <SymbolView name="xmark" size={18} tintColor={Brand.ink} type="monochrome" />
          </Pressable>
        </View>
        <View style={styles.gate}>
          <Text style={styles.gateEmoji}>🎬</Text>
          <Text style={styles.gateTitle}>Taste Maker exclusive</Text>
          <Text style={styles.gateSub}>
            Screening Rooms — live synchronized video with a real-time audience — are available on the Taste Maker plan.
          </Text>
          <Pressable style={styles.gateBtn} onPress={() => { router.back(); router.push('/get-verified-modal'); }}>
            <Text style={styles.gateBtnText}>View membership plans</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>New Screening Room</Text>
          <Pressable onPress={handleCreate} disabled={createRoom.isPending} hitSlop={12}>
            {createRoom.isPending
              ? <ActivityIndicator color={Brand.trust} />
              : <Text style={[styles.create, (!title.trim() || !videoUrl.trim()) && styles.createDisabled]}>
                  Start →
                </Text>}
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Video URL */}
          <Text style={styles.sectionLabel}>Video source</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <SymbolView name="play.rectangle" size={18} tintColor={Brand.muted} type="monochrome" />
              <TextInput
                style={styles.urlInput}
                value={videoUrl}
                onChangeText={setVideoUrl}
                placeholder="Paste a YouTube or video URL…"
                placeholderTextColor={Brand.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
          </View>

          {videoUrl.trim() !== '' && (
            <View style={styles.typeHint}>
              <SymbolView
                name={detectVideoType(videoUrl) === 'youtube' ? 'play.rectangle.fill' : 'film.fill'}
                size={13}
                tintColor={Brand.trust}
                type="monochrome"
              />
              <Text style={styles.typeHintText}>
                {detectVideoType(videoUrl) === 'youtube' ? 'YouTube detected' : 'Direct video detected'}
              </Text>
            </View>
          )}

          {/* Details */}
          <Text style={[styles.sectionLabel, { marginTop: 20 }]}>Details</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <TextInput
                style={styles.titleInput}
                value={title}
                onChangeText={setTitle}
                placeholder='Title, e.g. "Trailer Drop 🔥"'
                placeholderTextColor={Brand.muted}
                maxLength={80}
              />
            </View>
            <View style={styles.divider} />
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              <TextInput
                style={[styles.titleInput, styles.descInput]}
                value={description}
                onChangeText={(t) => t.length <= 200 && setDescription(t)}
                placeholder="Description (optional)"
                placeholderTextColor={Brand.muted}
                multiline
              />
            </View>
          </View>

          {/* How it works */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>How Screening Rooms work</Text>
            {[
              'You control playback — everyone watches in sync with you.',
              'Viewers join from their invite link and chat live alongside the video.',
              'Works with YouTube links or any direct MP4 / HLS video URL.',
              'Share the invite link from the live screen once you\'re ready to start.',
            ].map((line) => (
              <View key={line} style={styles.infoRow}>
                <Text style={styles.infoDot}>·</Text>
                <Text style={styles.infoText}>{line}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    cancel: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.muted },
    create: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    createDisabled: { opacity: 0.35 },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    content: { flexGrow: 1, padding: Spacing.three, paddingBottom: 40 },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 8,
    },
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    urlInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      padding: 0,
    },
    titleInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.ink,
      padding: 0,
    },
    descInput: { minHeight: 60, textAlignVertical: 'top', paddingTop: 2 },
    divider: { height: 1, backgroundColor: Brand.border, marginLeft: 14 },
    typeHint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      paddingHorizontal: 4,
    },
    typeHintText: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.trust },
    infoBox: {
      marginTop: 24,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 16,
      gap: 8,
    },
    infoTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, marginBottom: 4 },
    infoRow: { flexDirection: 'row', gap: 8 },
    infoDot: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.muted, lineHeight: 20 },
    infoText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, flex: 1, lineHeight: 19 },
    // Tier gate
    gateHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: Spacing.three },
    gate: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 12 },
    gateEmoji: { fontSize: 48, marginBottom: 8 },
    gateTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, textAlign: 'center' },
    gateSub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 21 },
    gateBtn: { marginTop: 12, backgroundColor: '#F59E0B', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28 },
    gateBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
