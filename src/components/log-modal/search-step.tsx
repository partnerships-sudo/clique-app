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

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useCloseFriendIds } from '@/features/close-friends/api';
import { useTitleSearch, type SearchResult } from '@/features/search/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const PLACEHOLDERS: Record<EntryType, string> = {
  watch: 'Search for a show or film…',
  read: 'Search for a book…',
  play: 'Search for a game…',
  listen: 'Search for an album…',
  podcast: 'Search for a podcast…',
};

export type SelectedTitle = {
  title: string;
  sub: string;
  poster: string | null;
  extRating: string | null;
  externalId: string | null;
  mediaType: string | null;
  square: boolean;
};

export function SearchStep({
  type,
  intent,
  onSubmit,
  isSubmitting,
}: {
  type: EntryType;
  intent: 'log' | 'watchlist';
  onSubmit: (input: {
    title: string;
    sub?: string;
    poster?: string;
    note?: string;
    rating?: number;
    extRating?: string;
    externalId?: string;
    mediaType?: string;
    visibility?: 'everyone' | 'close_friends';
  }) => void;
  isSubmitting: boolean;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<SelectedTitle | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [note, setNote] = useState('');
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const { data: closeFriendIds } = useCloseFriendIds();
  const hasCloseFriends = (closeFriendIds?.size ?? 0) > 0;


  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results, isFetching, isError } = useTitleSearch(manualMode ? null : type, debouncedQuery);

  function pickResult(result: SearchResult) {
    setSelected({
      title: result.title,
      sub: result.sub,
      poster: result.img,
      extRating: result.rating,
      externalId: result.externalId,
      mediaType: result.mediaType,
      square: result.square,
    });
  }

  function clearSelection() {
    setSelected(null);
    setQuery('');
  }

  const finalTitle = selected?.title ?? manualTitle.trim();
  const canSubmit = finalTitle.length > 0 && !isSubmitting;

  function handleSubmit() {
    onSubmit({
      title: finalTitle,
      sub: selected?.sub,
      poster: selected?.poster ?? undefined,
      note: note.trim() || undefined,
      extRating: selected?.extRating ?? undefined,
      externalId: selected?.externalId ?? undefined,
      mediaType: selected?.mediaType ?? undefined,
      visibility: intent === 'log' && closeFriendsOnly ? 'close_friends' : 'everyone',
    });
  }

  return (
    <View>
      {selected ? (
        <View style={styles.selectedCard}>
          {selected.poster ? (
            <Image
              source={{ uri: selected.poster }}
              style={[styles.selectedImg, selected.square && styles.selectedImgSquare]}
            />
          ) : (
            <View style={[styles.selectedImg, selected.square && styles.selectedImgSquare, styles.selectedImgFallback]}>
              <Text style={styles.selectedImgIcon}>{TypeColors[type].icon}</Text>
            </View>
          )}
          <View style={styles.selectedInfo}>
            <Text style={styles.selectedTitle} numberOfLines={1}>
              {selected.title}
            </Text>
            <Text style={styles.selectedSub} numberOfLines={1}>
              {selected.sub}
            </Text>
          </View>
          <Pressable onPress={clearSelection} hitSlop={8}>
            <Text style={styles.changeText}>Change</Text>
          </Pressable>
        </View>
      ) : manualMode ? (
        <View>
          <TextInput
            style={styles.input}
            placeholder="Title"
            placeholderTextColor={Brand.muted}
            value={manualTitle}
            onChangeText={setManualTitle}
            autoFocus
          />
          <Pressable
            onPress={() => {
              setManualMode(false);
              setManualTitle('');
            }}
            hitSlop={8}>
            <Text style={styles.linkText}>Search instead</Text>
          </Pressable>
        </View>
      ) : (
        <View>
          <TextInput
            style={styles.input}
            placeholder={PLACEHOLDERS[type]}
            placeholderTextColor={Brand.muted}
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {isFetching ? <ActivityIndicator color={Brand.trust} style={styles.spinner} /> : null}
          {isError ? <Text style={styles.errorText}>Search failed — check your connection.</Text> : null}
          {!isFetching && debouncedQuery.length >= 2 && results?.length === 0 ? (
            <Text style={styles.emptyText}>No results found. Try a different spelling.</Text>
          ) : null}
          {results?.length ? (
            <View style={styles.results}>
              {results.map((result, i) => (
                <Pressable key={i} style={styles.resultRow} onPress={() => pickResult(result)}>
                  {result.img ? (
                    <Image
                      source={{ uri: result.img }}
                      style={[styles.resultImg, result.square && styles.resultImgSquare]}
                    />
                  ) : (
                    <View style={[styles.resultImg, result.square && styles.resultImgSquare, styles.resultImgFallback]}>
                      <Text style={styles.resultImgIcon}>{TypeColors[type].icon}</Text>
                    </View>
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
          <Pressable onPress={() => setManualMode(true)} hitSlop={8} style={styles.manualLink}>
            <Text style={styles.linkText}>Can&apos;t find it? Enter manually</Text>
          </Pressable>
        </View>
      )}

      {finalTitle ? (
        <View style={styles.afterSelect}>
          <TextInput
            style={[styles.input, styles.noteInput]}
            placeholder="Add a note (optional)"
            placeholderTextColor={Brand.muted}
            value={note}
            onChangeText={setNote}
            multiline
          />

          {intent === 'log' && hasCloseFriends ? (
            <Pressable
              style={styles.closeFriendsRow}
              onPress={() => setCloseFriendsOnly((prev) => !prev)}
              hitSlop={4}>
              <View style={styles.closeFriendsInfo}>
                <Text style={styles.closeFriendsLabel}>💚 Close Friends only</Text>
                <Text style={styles.closeFriendsSub}>Only people on your close friends list will see this</Text>
              </View>
              <View style={[styles.circle, closeFriendsOnly && styles.circleActive]}>
                {closeFriendsOnly ? <Text style={styles.checkmark}>✓</Text> : null}
              </View>
            </Pressable>
          ) : null}

          <Pressable
            style={[styles.submit, !canSubmit && styles.submitDisabled]}
            disabled={!canSubmit}
            onPress={handleSubmit}>
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>
                {intent === 'log'
                  ? closeFriendsOnly
                    ? 'Share with close friends →'
                    : 'Share with friends →'
                  : 'Add to watchlist →'}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  input: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: BrandFonts.interRegular,
    color: Brand.ink,
    backgroundColor: Brand.paper,
    marginBottom: 10,
  },
  noteInput: {
    minHeight: 56,
    textAlignVertical: 'top',
  },
  spinner: { marginVertical: 10 },
  errorText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.8,
    color: '#E84F4F',
    paddingVertical: 8,
  },
  emptyText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.8,
    color: Brand.muted,
    paddingVertical: 8,
  },
  results: { gap: 8, marginBottom: 6 },
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
  resultImgIcon: { fontSize: 16 },
  resultInfo: { flex: 1, minWidth: 0 },
  resultTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
  resultSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  manualLink: { paddingVertical: 6 },
  linkText: { fontFamily: BrandFonts.interMedium, fontSize: 12.5, color: Brand.trust },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  selectedImg: { width: 48, height: 66, borderRadius: 8, backgroundColor: Brand.border },
  selectedImgSquare: { width: 56, height: 56 },
  selectedImgFallback: { alignItems: 'center', justifyContent: 'center' },
  selectedImgIcon: { fontSize: 20 },
  selectedInfo: { flex: 1, minWidth: 0 },
  selectedTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
  selectedSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
  changeText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.trust },
  afterSelect: { marginTop: 6 },
  closeFriendsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  closeFriendsInfo: { flex: 1, minWidth: 0 },
  closeFriendsLabel: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
  closeFriendsSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Brand.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
  checkmark: { color: '#fff', fontSize: 13, fontFamily: BrandFonts.syneBold },
  submit: {
    backgroundColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  });
}
