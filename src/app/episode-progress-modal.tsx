import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts } from '@/constants/theme';
import { useContentDetails } from '@/features/content/api';
import { useUpdateEpisodeProgress } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';

export default function EpisodeProgressModal() {
  const Brand = useBrand();
  const params = useLocalSearchParams<{
    itemId: string;
    title: string;
    poster?: string;
    externalId?: string;
    currentSeason?: string;
    currentEpisode?: string;
  }>();

  const [season, setSeason] = useState(Number(params.currentSeason ?? 1));
  const [episode, setEpisode] = useState(Number(params.currentEpisode ?? 1));

  const { data: details } = useContentDetails(params.title, 'watch', params.externalId, 'tv');
  const seasons = details?.seasons ?? [];
  const maxSeason = seasons.length > 0 ? seasons[seasons.length - 1].seasonNumber : undefined;
  const maxEpisode = seasons.find((s) => s.seasonNumber === season)?.episodeCount;

  const updateProgress = useUpdateEpisodeProgress();

  function stepSeason(delta: number) {
    const next = Math.max(1, maxSeason ? Math.min(maxSeason, season + delta) : season + delta);
    setSeason(next);
    const cap = seasons.find((s) => s.seasonNumber === next)?.episodeCount;
    if (cap && episode > cap) setEpisode(cap);
  }

  function stepEpisode(delta: number) {
    const next = Math.max(1, maxEpisode ? Math.min(maxEpisode, episode + delta) : episode + delta);
    setEpisode(next);
  }

  async function handleSave() {
    await updateProgress.mutateAsync({ id: params.itemId, season, episode });
    router.back();
  }

  const styles = createStyles(Brand);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        {params.poster ? (
          <Image source={{ uri: params.poster }} style={styles.poster} resizeMode="cover" />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={2}>{params.title}</Text>
          <Text style={styles.sub}>Update your progress</Text>
        </View>
      </View>

      <View style={styles.stepperRow}>
        <View style={styles.stepperField}>
          <Text style={styles.stepperLabel}>Season{maxSeason ? ` (of ${maxSeason})` : ''}</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => stepSeason(-1)} hitSlop={8}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{season}</Text>
            <Pressable style={styles.stepBtn} onPress={() => stepSeason(1)} hitSlop={8}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.stepperField}>
          <Text style={styles.stepperLabel}>Episode{maxEpisode ? ` (of ${maxEpisode})` : ''}</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => stepEpisode(-1)} hitSlop={8}>
              <Text style={styles.stepBtnText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{episode}</Text>
            <Pressable style={styles.stepBtn} onPress={() => stepEpisode(1)} hitSlop={8}>
              <Text style={styles.stepBtnText}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <Pressable
        style={[styles.saveBtn, updateProgress.isPending && { opacity: 0.6 }]}
        onPress={handleSave}
        disabled={updateProgress.isPending}>
        {updateProgress.isPending ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnText}>Save progress</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(Brand: ReturnType<typeof useBrand>) {
  return StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: Brand.paper,
      paddingHorizontal: 24,
      paddingTop: 32,
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 36,
      alignSelf: 'stretch',
    },
    poster: {
      width: 52,
      height: 74,
      borderRadius: 8,
      backgroundColor: Brand.border,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.ink,
      marginBottom: 4,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
    },
    stepperRow: {
      flexDirection: 'row',
      gap: 40,
      marginBottom: 40,
    },
    stepperField: { alignItems: 'center' },
    stepperLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    stepBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { fontSize: 20, color: Brand.ink, fontFamily: BrandFonts.syneBold },
    stepValue: {
      fontSize: 22,
      fontFamily: BrandFonts.syneExtraBold,
      color: Brand.ink,
      minWidth: 32,
      textAlign: 'center',
    },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
