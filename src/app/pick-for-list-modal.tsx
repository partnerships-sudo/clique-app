import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useAddToList, useListItems } from '@/features/lists/api';
import { useTitleSearch } from '@/features/search/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const TYPE_TABS: { key: EntryType; label: string; sf: string }[] = [
  { key: 'read',    label: 'Books',    sf: 'books.vertical' },
  { key: 'watch',   label: 'Film & TV', sf: 'film' },
  { key: 'listen',  label: 'Music',    sf: 'music.note' },
  { key: 'play',    label: 'Games',    sf: 'gamecontroller' },
  { key: 'podcast', label: 'Podcasts', sf: 'mic' },
];

export default function PickForListModal() {
  const { listId, listTitle } = useLocalSearchParams<{ listId: string; listTitle: string }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const [type, setType] = useState<EntryType>('read');
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const { data: existingItems = [] } = useListItems(listId);
  const addToList = useAddToList();

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results = [], isFetching, isError } = useTitleSearch(type, debouncedQuery);

  // IDs already in this list (by externalId stored in library_item_id field, or by title match)
  const alreadyInList = useMemo(
    () => new Set(existingItems.map((i) => i.title.toLowerCase())),
    [existingItems],
  );

  async function handleAdd(result: typeof results[number]) {
    const key = result.externalId ?? result.title;
    if (addedIds.has(key) || alreadyInList.has(result.title.toLowerCase())) return;
    try {
      await addToList.mutateAsync({
        list_id: listId,
        library_item_id: null,
        title: result.title,
        sub: result.sub ?? null,
        poster: result.img ?? null,
        type: type,
      });
      setAddedIds((prev) => new Set(prev).add(key));
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? JSON.stringify(e) ?? 'Could not add to list.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="xmark" size={18} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>Add to "{listTitle}"</Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Type tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.typeScroll}
        contentContainerStyle={styles.typeScrollContent}>
        {TYPE_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.typeTab, type === t.key && styles.typeTabActive]}
            onPress={() => { setType(t.key); setQuery(''); setDebouncedQuery(''); }}>
            <SymbolView
              name={t.sf as any}
              size={13}
              tintColor={type === t.key ? Brand.paper : Brand.muted}
              style={{ width: 15, height: 15 }}
            />
            <Text style={[styles.typeTabText, type === t.key && styles.typeTabTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <SymbolView name="magnifyingglass" size={14} tintColor={Brand.muted} style={{ width: 16, height: 16 }} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${TYPE_TABS.find((t) => t.key === type)?.label.toLowerCase()}…`}
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoFocus
        />
        {query.length > 0 && (
          <Pressable onPress={() => { setQuery(''); setDebouncedQuery(''); }} hitSlop={8}>
            <SymbolView name="xmark.circle.fill" size={15} tintColor={Brand.muted} style={{ width: 16, height: 16 }} />
          </Pressable>
        )}
      </View>

      {/* Results */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        {isFetching ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 32 }} />
        ) : isError ? (
          <Text style={styles.hint}>Search failed — check your connection.</Text>
        ) : debouncedQuery.length >= 2 && results.length === 0 ? (
          <Text style={styles.hint}>No results. Try a different spelling.</Text>
        ) : debouncedQuery.length < 2 ? (
          <Text style={styles.hint}>Start typing to search…</Text>
        ) : null}

        {results.map((result, i) => {
          const key = result.externalId ?? result.title;
          const added = addedIds.has(key) || alreadyInList.has(result.title.toLowerCase());
          const typeConfig = TypeColors[type] ?? TypeColors.watch;
          return (
            <Pressable
              key={i}
              style={[styles.row, added && styles.rowAdded]}
              onPress={() => handleAdd(result)}
              disabled={added}>
              {result.img ? (
                <Image
                  source={{ uri: result.img }}
                  style={[styles.poster, result.square && styles.posterSquare]}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.poster, styles.posterPlaceholder, { backgroundColor: typeConfig.bg }]}>
                  <Text style={{ fontSize: 18 }}>{typeConfig.icon}</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.resultTitle} numberOfLines={2}>{result.title}</Text>
                {result.sub ? <Text style={styles.resultSub} numberOfLines={1}>{result.sub}</Text> : null}
              </View>
              {added ? (
                <SymbolView name="checkmark.circle.fill" size={22} tintColor={Brand.trust} style={{ width: 22, height: 22 }} />
              ) : (
                <SymbolView name="plus.circle" size={22} tintColor={Brand.trust} style={{ width: 22, height: 22 }} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
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
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, flex: 1, textAlign: 'center', marginHorizontal: 8 },
    typeScroll: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: Brand.border },
    typeScrollContent: { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.three, paddingVertical: 10 },
    typeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    typeTabActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    typeTabText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    typeTabTextActive: { color: Brand.paper },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: Spacing.three,
      marginVertical: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: Brand.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    searchInput: { flex: 1, fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.ink },
    scroll: { flex: 1 },
    list: { paddingHorizontal: Spacing.three, paddingBottom: 40 },
    hint: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', marginTop: 40 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    rowAdded: { opacity: 0.45 },
    poster: { width: 44, height: 64, borderRadius: 6, backgroundColor: Brand.border },
    posterSquare: { width: 52, height: 52, borderRadius: 8 },
    posterPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1 },
    resultTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 2 },
    resultSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
  });
}
