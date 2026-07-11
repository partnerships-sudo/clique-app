import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingPicker } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useAddToCollection, type CollectionFormat, type CollectionType } from '@/features/collection/api';
import { searchBookByIsbn, searchCollectionByUpc, type SearchResult } from '@/features/search/api';
import { useBrand } from '@/hooks/use-brand';

const WATCH_FORMAT_OPTIONS: { value: CollectionFormat; label: string }[] = [
  { value: 'dvd', label: 'DVD' },
  { value: 'bluray', label: 'Blu-ray' },
  { value: '4k', label: '4K' },
];
const MUSIC_FORMAT_OPTIONS: { value: CollectionFormat; label: string }[] = [
  { value: 'cd', label: 'CD' },
  { value: 'vinyl', label: 'Vinyl' },
];

type ScanState =
  | { kind: 'scanning' }
  | { kind: 'looking-up' }
  | { kind: 'not-found' }
  | { kind: 'matched'; type: CollectionType; result: SearchResult; format: CollectionFormat; rating: number };

export default function CollectionScanModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [permission, requestPermission] = useCameraPermissions();
  const [state, setState] = useState<ScanState>({ kind: 'scanning' });
  const addToCollection = useAddToCollection();
  const lockedRef = useRef(false);

  async function handleBarcodeScanned(scan: BarcodeScanningResult) {
    if (lockedRef.current) return;
    lockedRef.current = true;
    setState({ kind: 'looking-up' });

    const code = scan.data;
    const isIsbn = /^97[89]\d{10}$/.test(code);

    try {
      if (isIsbn) {
        const result = await searchBookByIsbn(code);
        if (result) {
          setState({ kind: 'matched', type: 'read', result, format: 'book', rating: 0 });
        } else {
          setState({ kind: 'not-found' });
        }
      } else {
        const match = await searchCollectionByUpc(code);
        if (match) {
          setState({
            kind: 'matched',
            type: match.type,
            result: match.result,
            format: match.detectedFormat,
            rating: 0,
          });
        } else {
          setState({ kind: 'not-found' });
        }
      }
    } catch {
      setState({ kind: 'not-found' });
    }
  }

  function resumeScanning() {
    lockedRef.current = false;
    setState({ kind: 'scanning' });
  }

  async function handleAdd() {
    if (state.kind !== 'matched') return;
    await addToCollection.mutateAsync({
      type: state.type,
      format: state.format,
      title: state.result.title,
      sub: state.result.sub,
      poster: state.result.img,
      externalId: state.result.externalId,
      mediaType: state.result.mediaType,
      extRating: state.result.rating,
      userRating: state.rating || null,
    });
    router.back();
  }

  if (!permission) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.permissionWrap}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            Allow camera access to scan the barcode on the back of a book, DVD/Blu-ray case, or CD/vinyl sleeve.
          </Text>
          <Pressable style={styles.permissionBtn} onPress={requestPermission}>
            <Text style={styles.permissionBtnText}>Allow Camera</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} hitSlop={8} style={{ marginTop: 14 }}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.cameraRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={state.kind === 'scanning' ? handleBarcodeScanned : undefined}
      />

      <SafeAreaView style={styles.overlaySafeArea} edges={['top']}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </Pressable>

        {state.kind === 'scanning' ? (
          <View style={styles.scanFrame}>
            <View style={styles.scanBox} />
            <Text style={styles.scanHint}>
              Point at the barcode on the back of a book, DVD/Blu-ray case, or CD/vinyl sleeve
            </Text>
          </View>
        ) : null}
      </SafeAreaView>

      {state.kind === 'looking-up' ? (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <ActivityIndicator color={Brand.trust} />
            <Text style={styles.lookingUpText}>Looking it up…</Text>
          </View>
        </View>
      ) : null}

      {state.kind === 'not-found' ? (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <Text style={styles.notFoundEmoji}>🔍</Text>
            <Text style={styles.notFoundTitle}>Couldn&apos;t find a match</Text>
            <Text style={styles.notFoundBody}>Try scanning again, or add it manually instead.</Text>
            <Pressable style={styles.primaryBtn} onPress={resumeScanning}>
              <Text style={styles.primaryBtnText}>Scan again</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => router.replace('/collection-add-modal')}>
              <Text style={styles.secondaryBtnText}>Enter manually</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {state.kind === 'matched' ? (
        <View style={styles.resultOverlay}>
          <View style={styles.resultCard}>
            <View style={styles.matchRow}>
              {state.result.img ? (
                <Image source={{ uri: state.result.img }} style={styles.matchImg} />
              ) : (
                <View style={[styles.matchImg, styles.matchImgFallback]} />
              )}
              <View style={styles.matchInfo}>
                <Text style={styles.matchTitle} numberOfLines={2}>
                  {state.result.title}
                </Text>
                <Text style={styles.matchSub} numberOfLines={1}>
                  {state.result.sub}
                </Text>
              </View>
            </View>

            {state.type === 'watch' || state.type === 'listen' ? (
              <View style={styles.formatRow}>
                {(state.type === 'watch' ? WATCH_FORMAT_OPTIONS : MUSIC_FORMAT_OPTIONS).map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.formatBtn, state.format === opt.value && styles.formatBtnActive]}
                    onPress={() => setState({ ...state, format: opt.value })}>
                    <Text
                      style={[
                        styles.formatBtnText,
                        state.format === opt.value && styles.formatBtnTextActive,
                      ]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.ratingSection}>
              <Text style={styles.formatBtnText}>Your rating</Text>
              <RatingPicker
                value={state.rating}
                iconStyle="stars"
                onChange={(rating) => setState({ ...state, rating })}
                size={26}
              />
            </View>

            <Pressable
              style={[styles.primaryBtn, addToCollection.isPending && styles.primaryBtnDisabled]}
              disabled={addToCollection.isPending}
              onPress={handleAdd}>
              {addToCollection.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>+ Add to Collection</Text>
              )}
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={resumeScanning}>
              <Text style={styles.secondaryBtnText}>Not right? Scan again</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    cameraRoot: { flex: 1, backgroundColor: '#000' },
    overlaySafeArea: { flex: 1, justifyContent: 'space-between' },
    closeBtn: {
      alignSelf: 'flex-end',
      marginRight: Spacing.three,
      marginTop: Spacing.three,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeBtnText: { color: '#fff', fontSize: 16 },
    scanFrame: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 18 },
    scanBox: {
      width: 260,
      height: 150,
      borderRadius: 16,
      borderWidth: 2.5,
      borderColor: '#fff',
    },
    scanHint: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13.5,
      color: '#fff',
      textAlign: 'center',
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowRadius: 4,
    },
    permissionWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
    permissionTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 19, color: Brand.ink, marginBottom: 10 },
    permissionBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 22,
    },
    permissionBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 28,
    },
    permissionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: '#fff' },
    cancelText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    resultOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: Spacing.three,
    },
    resultCard: {
      backgroundColor: Brand.paper,
      borderRadius: 20,
      padding: 18,
      alignItems: 'center',
      gap: 10,
    },
    lookingUpText: { fontFamily: BrandFonts.interMedium, fontSize: 13.5, color: Brand.muted },
    notFoundEmoji: { fontSize: 30 },
    notFoundTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    notFoundBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.8,
      color: Brand.muted,
      textAlign: 'center',
      marginBottom: 4,
    },
    matchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' },
    matchImg: { width: 56, height: 56, borderRadius: 10, backgroundColor: Brand.border },
    matchImgFallback: {},
    matchInfo: { flex: 1, minWidth: 0 },
    matchTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15.5, color: Brand.ink },
    matchSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    formatRow: { flexDirection: 'row', gap: 8, alignSelf: 'stretch' },
    formatBtn: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
    },
    formatBtnActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    formatBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
    formatBtnTextActive: { color: Brand.trust },
    ratingSection: { alignSelf: 'stretch', gap: 4 },
    primaryBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: '#fff' },
    secondaryBtn: { paddingVertical: 6 },
    secondaryBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
  });
}
