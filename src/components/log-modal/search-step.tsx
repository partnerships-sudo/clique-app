import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useCloseFriendIds } from '@/features/close-friends/api';
import { useTVSeasons } from '@/features/content/api';
import { useProfile } from '@/features/profile/api';
import { useTitleSearch, type SearchResult } from '@/features/search/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

function isFutureEpisode(airDate: string | null): boolean {
  if (!airDate) return false;
  return new Date(airDate) > TODAY;
}

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
  prefill,
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
  prefill?: { title: string; sub: string; poster: string | null; externalId: string | null; mediaType: string | null };
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selected, setSelected] = useState<SelectedTitle | null>(
    prefill ? { title: prefill.title, sub: prefill.sub, poster: prefill.poster, extRating: null, externalId: prefill.externalId, mediaType: prefill.mediaType, square: false } : null,
  );
  const [manualMode, setManualMode] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [closeFriendsOnly, setCloseFriendsOnly] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<{ number: number; name: string } | null>(null);
  const { data: closeFriendIds } = useCloseFriendIds();
  const hasCloseFriends = (closeFriendIds?.size ?? 0) > 0;

  const isTVSelected = selected?.mediaType === 'tv';
  const { data: tvSeasons = [], isFetching: seasonsFetching } = useTVSeasons(
    isTVSelected ? selected?.externalId : null,
  );
  const currentSeason = tvSeasons.find((s) => s.seasonNumber === selectedSeason) ?? null;


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
    setSelectedSeason(null);
    setSelectedEpisode(null);
  }

  const finalTitle = selected?.title ?? manualTitle.trim();
  const canSubmit = finalTitle.length > 0 && !isSubmitting;

  function handleSubmit() {
    let sub = selected?.sub;
    if (isTVSelected && selectedSeason !== null && selectedEpisode !== null) {
      sub = `${selected?.sub ?? ''} · S${selectedSeason} E${selectedEpisode.number} ${selectedEpisode.name}`.trim();
    } else if (isTVSelected && selectedSeason !== null) {
      sub = `${selected?.sub ?? ''} · Season ${selectedSeason}`.trim();
    }
    onSubmit({
      title: finalTitle,
      sub,
      poster: selected?.poster ?? undefined,
      note: note.trim() || undefined,
      rating: rating ?? undefined,
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

      {/* TV episode picker */}
      {isTVSelected && selected ? (
        <View style={styles.episodeSection}>
          <Text style={styles.episodeSectionLabel}>PICK AN EPISODE</Text>
          {seasonsFetching ? (
            <ActivityIndicator color={Brand.trust} style={{ marginVertical: 10 }} />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasonScroll} contentContainerStyle={styles.seasonScrollContent}>
                {tvSeasons.map((s) => (
                  <Pressable
                    key={s.seasonNumber}
                    style={[styles.seasonChip, selectedSeason === s.seasonNumber && styles.seasonChipActive]}
                    onPress={() => {
                      setSelectedSeason(s.seasonNumber === selectedSeason ? null : s.seasonNumber);
                      setSelectedEpisode(null);
                    }}>
                    <Text style={[styles.seasonChipText, selectedSeason === s.seasonNumber && styles.seasonChipTextActive]}>
                      S{s.seasonNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              {currentSeason ? (
                <View style={styles.episodeList}>
                  {currentSeason.episodes.map((ep) => {
                    const future = isFutureEpisode(ep.airDate);
                    const isSelected = selectedEpisode?.number === ep.episodeNumber;
                    return (
                      <Pressable
                        key={ep.episodeNumber}
                        style={[styles.episodeRow, isSelected && styles.episodeRowActive]}
                        onPress={() => setSelectedEpisode(isSelected ? null : { number: ep.episodeNumber, name: ep.name })}>
                        <View style={styles.episodeRowBody}>
                          <Text style={[styles.episodeTitle, isSelected && styles.episodeTitleActive]}>
                            E{ep.episodeNumber}{'  '}{ep.name}
                          </Text>
                          {ep.airDate ? (
                            <Text style={[styles.episodeDate, future && styles.episodeDateFuture]}>
                              {future ? `Airs ${ep.airDate}` : ep.airDate}
                            </Text>
                          ) : null}
                        </View>
                        {isSelected ? <Text style={styles.episodeCheck}>✓</Text> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
              {selectedEpisode && currentSeason && isFutureEpisode(
                currentSeason.episodes.find((e) => e.episodeNumber === selectedEpisode.number)?.airDate ?? null
              ) ? (
                <Pressable
                  style={styles.watchPartyBtn}
                  onPress={() => {
                    const ep = currentSeason!.episodes.find((e) => e.episodeNumber === selectedEpisode!.number);
                    router.push({
                      pathname: '/premiere-modal',
                      params: {
                        showTitle: selected!.title,
                        showPoster: selected!.poster ?? undefined,
                        externalId: selected!.externalId ?? undefined,
                        seasonNumber: String(selectedSeason),
                        episodeNumber: String(selectedEpisode!.number),
                        episodeName: selectedEpisode!.name,
                        airDate: ep?.airDate ?? undefined,
                      },
                    });
                  }}>
                  <Text style={styles.watchPartyBtnText}>Premiere — Watch Party</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </View>
      ) : null}

      {finalTitle ? (
        <View style={styles.afterSelect}>
          {intent === 'log' ? (
            <View style={styles.ratingCard}>
              <Text style={styles.ratingLabel}>Your rating</Text>
              <RatingPicker
                value={rating ?? 0}
                iconStyle={ratingIcon}
                onChange={(v) => setRating(v === 0 ? null : v)}
                size={36}
              />
            </View>
          ) : null}
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
  episodeSection: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  episodeSectionLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 10.5,
    color: Brand.muted,
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  seasonScroll: { flexGrow: 0 },
  seasonScrollContent: { flexDirection: 'row', gap: 8, paddingBottom: 10 },
  seasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Brand.border,
    backgroundColor: Brand.paper,
  },
  seasonChipActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
  seasonChipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  seasonChipTextActive: { color: Brand.trust },
  episodeList: { borderTopWidth: 1, borderTopColor: Brand.border, marginTop: 2 },
  episodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Brand.border,
  },
  episodeRowActive: { backgroundColor: Brand.tlight },
  episodeRowBody: { flex: 1 },
  episodeTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
  episodeTitleActive: { color: Brand.trust },
  episodeDate: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
  episodeDateFuture: { color: '#F4A340' },
  episodeCheck: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, paddingLeft: 8 },
  watchPartyBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  watchPartyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  afterSelect: { marginTop: 6 },
  ratingCard: {
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  ratingLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
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
