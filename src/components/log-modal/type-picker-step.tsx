import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { type SearchResult, useUniversalSearch } from '@/features/search/api';
import { useBrand } from '@/hooks/use-brand';

const TYPES: { value: EntryType; label: string; symbol: string }[] = [
  { value: 'watch', label: 'TV & Film', symbol: 'tv' },
  { value: 'read', label: 'Books', symbol: 'book' },
  { value: 'play', label: 'Games', symbol: 'gamecontroller' },
  { value: 'listen', label: 'Music', symbol: 'headphones' },
  { value: 'podcast', label: 'Podcasts', symbol: 'mic' },
];

const CIRCLE = 90;

export function TypePickerStep({
  value,
  onSelect,
  onUniversalPick,
}: {
  value: EntryType | null;
  onSelect: (type: EntryType) => void;
  onUniversalPick: (type: EntryType, result: SearchResult) => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const { data: universalResults, isFetching } = useUniversalSearch(debouncedQuery);
  const hasQuery = query.trim().length >= 2;

  const row1 = TYPES.slice(0, 3);
  const row2 = TYPES.slice(3);

  function renderTypeItem(t: typeof TYPES[number]) {
    const selected = t.value === value;
    return (
      <Pressable key={t.value} style={styles.item} onPress={() => { setQuery(''); onSelect(t.value); }}>
        <View style={[styles.circle, selected && styles.circleSelected]}>
          <SymbolView
            name={t.symbol as any}
            size={32}
            tintColor={selected ? Brand.trust : Brand.muted}
            type="monochrome"
          />
        </View>
        <Text style={[styles.label, selected && styles.labelSelected]}>{t.label}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* Universal search bar */}
      <View style={styles.searchRow}>
        <SymbolView name="magnifyingglass" size={14} tintColor={Brand.muted} style={{ width: 16, height: 16 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search everything…"
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {isFetching ? <ActivityIndicator size="small" color={Brand.trust} /> : null}
      </View>

      {/* Universal results */}
      {hasQuery ? (
        <View style={styles.results}>
          {!isFetching && (universalResults?.length ?? 0) === 0 ? (
            <Text style={styles.emptyText}>No results found.</Text>
          ) : (universalResults ?? []).map((result, i) => {
            const typeConfig = TYPES.find((t) => t.value === result.entryType);
            return (
              <Pressable
                key={`${result.entryType}-${i}`}
                style={styles.resultRow}
                onPress={() => { setQuery(''); onUniversalPick(result.entryType, result); }}>
                {result.img ? (
                  <Image
                    source={{ uri: result.img }}
                    style={[styles.resultImg, result.square && styles.resultImgSquare]}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.resultImg, result.square && styles.resultImgSquare, styles.resultImgFallback]}>
                    {typeConfig ? (
                      <SymbolView name={typeConfig.symbol as any} size={18} tintColor={Brand.muted} type="monochrome" />
                    ) : null}
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>{result.title}</Text>
                  <Text style={styles.resultSub} numberOfLines={1}>{result.sub}</Text>
                </View>
                {typeConfig ? (
                  <View style={styles.typeBadge}>
                    <SymbolView name={typeConfig.symbol as any} size={11} tintColor={Brand.trust} type="monochrome" style={{ width: 12, height: 12 }} />
                    <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : (
        /* Type icons — browse by category */
        <>
          <View style={styles.row}>{row1.map(renderTypeItem)}</View>
          <View style={[styles.row, styles.rowCenter]}>{row2.map(renderTypeItem)}</View>
        </>
      )}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    wrap: { gap: 20 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      backgroundColor: Brand.paper,
    },
    searchInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.ink,
    },
    results: { gap: 8 },
    emptyText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      textAlign: 'center',
      paddingVertical: 12,
    },
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
    resultImg: { width: 40, height: 56, borderRadius: 6, backgroundColor: Brand.border },
    resultImgSquare: { width: 48, height: 48 },
    resultImgFallback: { alignItems: 'center', justifyContent: 'center' },
    resultInfo: { flex: 1, minWidth: 0 },
    resultTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
    resultSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
    typeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 4,
      paddingHorizontal: 8,
    },
    typeBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.trust },
    row: { flexDirection: 'row', justifyContent: 'space-around' },
    rowCenter: { justifyContent: 'center', gap: 40 },
    item: { alignItems: 'center', gap: 6, width: CIRCLE },
    circle: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      backgroundColor: Brand.card,
      borderWidth: 2,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleSelected: {
      backgroundColor: Brand.tlight,
      borderColor: Brand.trust,
    },
    label: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.muted,
      textAlign: 'center',
    },
    labelSelected: {
      color: Brand.trust,
    },
  });
}
