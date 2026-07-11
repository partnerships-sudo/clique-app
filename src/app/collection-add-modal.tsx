import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RatingPicker } from '@/components/rating-icons';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useAddToCollection, type CollectionFormat, type CollectionType } from '@/features/collection/api';
import { useTitleSearch, type SearchResult } from '@/features/search/api';
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

export default function CollectionAddModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const addToCollection = useAddToCollection();

  const [collectionType, setCollectionType] = useState<CollectionType>('watch');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [format, setFormat] = useState<CollectionFormat>('dvd');
  const [rating, setRating] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching } = useTitleSearch(collectionType, debouncedQuery);

  function switchType(next: CollectionType) {
    setCollectionType(next);
    setQuery('');
    setDebouncedQuery('');
    setSelected(null);
    setRating(0);
    setFormat(next === 'listen' ? 'cd' : next === 'play' ? 'game' : 'dvd');
  }

  const formatOptions =
    collectionType === 'watch' || collectionType === 'tv'
      ? WATCH_FORMAT_OPTIONS
      : collectionType === 'listen'
        ? MUSIC_FORMAT_OPTIONS
        : null;

  async function handleAdd() {
    if (!selected) return;
    await addToCollection.mutateAsync({
      type: collectionType,
      format: formatOptions ? format : collectionType === 'play' ? 'game' : collectionType === 'podcast' || collectionType === 'tv' ? null : 'book',
      title: selected.title,
      sub: selected.sub,
      poster: selected.img,
      externalId: selected.externalId,
      mediaType: selected.mediaType,
      extRating: selected.rating,
      userRating: rating || null,
    });
    router.back();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtn}>‹ Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add to Collection</Text>
        <View style={{ width: 66 }} />
      </View>

      <View style={styles.content}>
        <View style={styles.typeGrid}>
          {([
            { value: 'watch',   label: '🎬 Movies'  },
            { value: 'tv',      label: '📺 TV Shows' },
            { value: 'read',    label: '📖 Books'    },
            { value: 'listen',  label: '🎵 Music'    },
            { value: 'play',    label: '🎮 Games'    },
            { value: 'podcast', label: '🎙 Podcasts' },
          ] as const).map(({ value, label }) => (
            <Pressable
              key={value}
              style={[styles.typeBtn, collectionType === value && styles.typeBtnActive]}
              onPress={() => switchType(value)}>
              <Text style={[styles.typeBtnText, collectionType === value && styles.typeBtnTextActive]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {selected ? (
          <View style={styles.selectedCard}>
            {selected.img ? (
              <Image source={{ uri: selected.img }} style={styles.selectedImg} />
            ) : (
              <View style={[styles.selectedImg, styles.selectedImgFallback]} />
            )}
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedTitle} numberOfLines={2}>
                {selected.title}
              </Text>
              <Text style={styles.selectedSub} numberOfLines={1}>
                {selected.sub}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setSelected(null);
                setRating(0);
              }}
              hitSlop={8}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <TextInput
              style={styles.input}
              placeholder={
                collectionType === 'watch'
                  ? 'Search for a movie…'
                  : collectionType === 'tv'
                    ? 'Search for a TV show…'
                    : collectionType === 'listen'
                      ? 'Search for an album…'
                      : collectionType === 'play'
                        ? 'Search for a game…'
                        : collectionType === 'podcast'
                          ? 'Search for a podcast…'
                          : 'Search for a book…'
              }
              placeholderTextColor={Brand.muted}
              value={query}
              onChangeText={setQuery}
              autoFocus
            />
            {isFetching ? <ActivityIndicator color={Brand.trust} style={styles.spinner} /> : null}
            {!isFetching && debouncedQuery.length >= 2 && results?.length === 0 ? (
              <Text style={styles.emptyText}>No results found. Try a different spelling.</Text>
            ) : null}
            {results?.length ? (
              <View style={styles.results}>
                {results.map((result, i) => (
                  <Pressable key={i} style={styles.resultRow} onPress={() => setSelected(result)}>
                    {result.img ? (
                      <Image source={{ uri: result.img }} style={styles.resultImg} />
                    ) : (
                      <View style={[styles.resultImg, styles.resultImgFallback]} />
                    )}
                    <View style={styles.resultInfo}>
                      <Text style={styles.resultTitle} numberOfLines={1}>
                        {result.title}
                      </Text>
                      <Text style={styles.resultSub} numberOfLines={1}>
                        {result.sub}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {selected && formatOptions ? (
          <View style={styles.formatSection}>
            <Text style={styles.formatLabel}>Format</Text>
            <View style={styles.formatRow}>
              {formatOptions.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.formatBtn, format === opt.value && styles.formatBtnActive]}
                  onPress={() => setFormat(opt.value)}>
                  <Text style={[styles.formatBtnText, format === opt.value && styles.formatBtnTextActive]}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {selected ? (
          <View style={styles.ratingSection}>
            <Text style={styles.formatLabel}>Your rating</Text>
            <RatingPicker value={rating} iconStyle="stars" onChange={setRating} size={30} />
          </View>
        ) : null}

        {selected ? (
          <Pressable
            style={[styles.submit, addToCollection.isPending && styles.submitDisabled]}
            disabled={addToCollection.isPending}
            onPress={handleAdd}>
            {addToCollection.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>+ Add to Collection</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    content: { flex: 1, paddingHorizontal: Spacing.three },
    typeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 16,
    },
    typeBtn: {
      width: '31%',
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    typeBtnActive: { backgroundColor: Brand.ink, borderColor: Brand.ink },
    typeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    typeBtnTextActive: { color: '#fff' },
    input: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.card,
      marginBottom: 10,
    },
    spinner: { marginVertical: 10 },
    emptyText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.8,
      color: Brand.muted,
      paddingVertical: 8,
    },
    results: { gap: 8 },
    resultRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 12,
      padding: 9,
    },
    resultImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: Brand.border },
    resultImgFallback: {},
    resultInfo: { flex: 1, minWidth: 0 },
    resultTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
    resultSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
    selectedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 12,
      marginBottom: 16,
    },
    selectedImg: { width: 52, height: 52, borderRadius: 10, backgroundColor: Brand.border },
    selectedImgFallback: {},
    selectedInfo: { flex: 1, minWidth: 0 },
    selectedTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    selectedSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    changeText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.trust },
    formatSection: { marginBottom: 16 },
    formatLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    formatRow: { flexDirection: 'row', gap: 8 },
    formatBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
      alignItems: 'center',
    },
    formatBtnActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    formatBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    formatBtnTextActive: { color: Brand.trust },
    ratingSection: { marginBottom: 16 },
    submit: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 6,
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
