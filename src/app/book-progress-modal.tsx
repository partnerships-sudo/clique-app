import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { BrandFonts } from '@/constants/theme';
import { useContentDetails } from '@/features/content/api';
import { useUpdateBookProgress } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';

export default function BookProgressModal() {
  const Brand = useBrand();
  const params = useLocalSearchParams<{
    itemId: string;
    title: string;
    poster?: string;
    currentPage?: string;
    externalId?: string;
  }>();

  const { data: details } = useContentDetails(params.title, 'read', params.externalId);
  // Parse page count from runtime field e.g. "412 pages"
  const totalPages = details?.runtime
    ? parseInt(details.runtime, 10) || null
    : null;
  const [page, setPage] = useState(params.currentPage ? Number(params.currentPage) : 1);
  const inputRef = useRef<TextInput>(null);
  const updateProgress = useUpdateBookProgress();

  useEffect(() => {
    // Auto-focus the input after the sheet finishes animating in
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  function step(delta: number) {
    setPage((p) => {
      const next = p + delta;
      if (next < 1) return 1;
      if (totalPages && next > totalPages) return totalPages;
      return next;
    });
  }

  function handleInputChange(text: string) {
    const n = parseInt(text, 10);
    if (isNaN(n)) return;
    if (totalPages && n > totalPages) {
      setPage(totalPages);
    } else {
      setPage(Math.max(1, n));
    }
  }

  async function handleSave() {
    Keyboard.dismiss();
    await updateProgress.mutateAsync({ id: params.itemId, page });
    router.back();
  }

  const percent = totalPages ? Math.round((page / totalPages) * 100) : null;
  const styles = createStyles(Brand);

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        {params.poster ? (
          <Image source={{ uri: params.poster }} style={styles.poster} resizeMode="cover" />
        ) : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.title} numberOfLines={2}>{params.title}</Text>
          <Text style={styles.sub}>Update your reading progress</Text>
        </View>
      </View>

      <Text style={styles.label}>
        Current page{totalPages ? ` (of ${totalPages})` : ''}
      </Text>

      <View style={styles.stepper}>
        <Pressable style={styles.stepBtn} onPress={() => step(-10)} hitSlop={16}>
          <Text style={styles.stepBtnText}>−10</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={() => step(-1)} hitSlop={16}>
          <Text style={styles.stepBtnText}>−</Text>
        </Pressable>
        <TextInput
          ref={inputRef}
          style={styles.pageInput}
          value={String(page)}
          onChangeText={handleInputChange}
          keyboardType="number-pad"
          selectTextOnFocus
        />
        <Pressable style={styles.stepBtn} onPress={() => step(1)} hitSlop={16}>
          <Text style={styles.stepBtnText}>+</Text>
        </Pressable>
        <Pressable style={styles.stepBtn} onPress={() => step(10)} hitSlop={16}>
          <Text style={styles.stepBtnText}>+10</Text>
        </Pressable>
      </View>

      {percent !== null ? (
        <View style={styles.progressBarWrap}>
          <View style={[styles.progressBarFill, { width: `${percent}%` as any }]} />
          <Text style={styles.progressLabel}>{percent}% complete</Text>
        </View>
      ) : null}

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
      marginBottom: 32,
      alignSelf: 'stretch',
    },
    poster: {
      width: 48,
      height: 68,
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
    label: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 16,
      alignSelf: 'flex-start',
    },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 24,
    },
    stepBtn: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 40,
    },
    stepBtnText: {
      fontSize: 13,
      color: Brand.ink,
      fontFamily: BrandFonts.syneBold,
    },
    pageInput: {
      fontSize: 28,
      fontFamily: BrandFonts.syneExtraBold,
      color: Brand.ink,
      minWidth: 72,
      textAlign: 'center',
      borderBottomWidth: 2,
      borderBottomColor: Brand.trust,
      paddingBottom: 4,
    },
    progressBarWrap: {
      alignSelf: 'stretch',
      height: 6,
      backgroundColor: Brand.border,
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 10,
    },
    progressBarFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: Brand.trust,
      borderRadius: 3,
    },
    progressLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 14,
    },
    saveBtn: {
      marginTop: 32,
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 40,
      alignItems: 'center',
    },
    saveBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: '#fff',
    },
  });
}
