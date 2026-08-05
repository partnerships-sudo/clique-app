import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
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

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { type DiscussionType, useCreateDiscussion, useCreateDiscussionPoll } from '@/features/discussions/api';
import { type SearchResult, useUniversalSearch } from '@/features/search/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

// Map mediaType → DiscussionType
function mediaTypeToDiscussionType(mediaType: string | null): DiscussionType {
  if (!mediaType) return 'general';
  if (mediaType === 'movie' || mediaType === 'tv') return 'watch';
  if (mediaType === 'book') return 'read';
  if (mediaType === 'game') return 'play';
  if (mediaType === 'album') return 'listen';
  if (mediaType === 'podcast') return 'podcast';
  return 'general';
}

interface LinkedContent {
  externalId: string;
  mediaType: string;
  title: string;
  poster: string | null;
}

// ── Content search step ───────────────────────────────────────────────────────

function ContentSearchStep({
  Brand,
  onPick,
  onSkip,
}: {
  Brand: BrandPalette;
  onPick: (content: LinkedContent) => void;
  onSkip: () => void;
}) {
  const [query, setQuery] = useState('');
  const TypeColors = useTypeColors();
  const { data: results = [], isLoading } = useUniversalSearch(query);

  return (
    <View style={{ flex: 1 }}>
      <Text style={[searchStyles.hint, { color: Brand.muted }]}>
        Search for a show, film, book, game or album to link your discussion to it — or skip to post without one.
      </Text>

      <View style={[searchStyles.inputWrap, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
        <TextInput
          style={[searchStyles.input, { color: Brand.ink }]}
          placeholder="Search titles…"
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 16 }} color={Brand.trust} />}

      {results.length > 0 && (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {results.map((r, i) => {
            const tcKey = r.entryType === 'watch' ? 'watch'
              : r.entryType === 'read' ? 'read'
              : r.entryType === 'play' ? 'play'
              : r.entryType === 'listen' ? 'listen'
              : 'podcast';
            const colors = (TypeColors as any)[tcKey] ?? { color: '#6B7280', bg: '#F3F4F6' };
            return (
              <Pressable
                key={`${r.externalId}-${i}`}
                style={[searchStyles.row, { borderBottomColor: Brand.border }]}
                onPress={() => {
                  if (!r.externalId || !r.mediaType) return;
                  onPick({ externalId: r.externalId, mediaType: r.mediaType, title: r.title, poster: r.img });
                }}>
                {r.img ? (
                  <Image source={{ uri: r.img }} style={searchStyles.thumb} resizeMode="cover" />
                ) : (
                  <View style={[searchStyles.thumb, { backgroundColor: colors.bg }]} />
                )}
                <View style={searchStyles.rowBody}>
                  <Text style={[searchStyles.rowType, { color: colors.color }]}>{colors.label?.toUpperCase()}</Text>
                  <Text style={[searchStyles.rowTitle, { color: Brand.ink }]} numberOfLines={1}>{r.title}</Text>
                  {r.sub ? <Text style={[searchStyles.rowSub, { color: Brand.muted }]} numberOfLines={1}>{r.sub}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {query.trim().length >= 2 && !isLoading && results.length === 0 && (
        <Text style={[searchStyles.noResults, { color: Brand.muted }]}>No results for "{query}"</Text>
      )}

      <Pressable style={searchStyles.skipBtn} onPress={onSkip}>
        <Text style={[searchStyles.skipText, { color: Brand.muted }]}>Skip — post without linking to a title</Text>
      </Pressable>
    </View>
  );
}

const searchStyles = StyleSheet.create({
  hint: { fontFamily: BrandFonts.interRegular, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  inputWrap: {
    borderWidth: 1, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 8,
  },
  input: { fontFamily: BrandFonts.interRegular, fontSize: 15 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumb: { width: 40, height: 56, borderRadius: 6, flexShrink: 0 },
  rowBody: { flex: 1, gap: 2 },
  rowType: { fontFamily: BrandFonts.interMedium, fontSize: 10, letterSpacing: 0.5 },
  rowTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
  rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
  noResults: { fontFamily: BrandFonts.interRegular, fontSize: 13, textAlign: 'center', marginTop: 20 },
  skipBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  skipText: { fontFamily: BrandFonts.interMedium, fontSize: 13 },
});

// ── Write step ────────────────────────────────────────────────────────────────

export default function CreateDiscussionModal() {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const createDiscussion = useCreateDiscussion();
  const createPoll = useCreateDiscussionPoll();

  // Prefill params from content-room "Start a discussion" button
  const params = useLocalSearchParams<{
    prefillExternalId?: string;
    prefillMediaType?: string;
    prefillTitle?: string;
    prefillPoster?: string;
  }>();

  const [step, setStep] = useState<'search' | 'write'>(
    params.prefillExternalId ? 'write' : 'search'
  );
  const [linked, setLinked] = useState<LinkedContent | null>(
    params.prefillExternalId
      ? {
          externalId: params.prefillExternalId,
          mediaType: params.prefillMediaType ?? '',
          title: params.prefillTitle ?? '',
          poster: params.prefillPoster || null,
        }
      : null
  );

  const discussionType = mediaTypeToDiscussionType(linked?.mediaType ?? null);
  const typeColors = linked ? ((TypeColors as any)[discussionType] ?? { color: '#6B7280', bg: '#F3F4F6' }) : null;

  const scrollRef = useRef<ScrollView>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  // Poll (optional)
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  const pollValid = !pollEnabled || (
    pollQuestion.trim().length >= 3 &&
    pollOptions.filter((o) => o.trim().length > 0).length >= 2
  );
  const canPost = title.trim().length >= 3 && pollValid && !createDiscussion.isPending;

  async function handlePost() {
    if (!canPost) return;
    try {
      const id = await createDiscussion.mutateAsync({
        title,
        body,
        type: discussionType,
        contentTitle: linked?.title,
        contentPoster: linked?.poster ?? undefined,
        contentExternalId: linked?.externalId,
        contentMediaType: linked?.mediaType,
      });
      // Attach poll if enabled
      if (pollEnabled && pollQuestion.trim()) {
        const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (filledOptions.length >= 2) {
          await createPoll.mutateAsync({ discussionId: id, question: pollQuestion.trim(), options: filledOptions });
        }
      }
      router.back();
      router.push({ pathname: '/discussion-detail-modal', params: { id } });
    } catch {
      Alert.alert('Error', 'Could not post discussion. Please try again.');
    }
  }

  function handlePick(content: LinkedContent) {
    setLinked(content);
    setStep('write');
  }

  function handleSkip() {
    setLinked(null);
    setStep('write');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 'write' && !params.prefillExternalId) {
                setStep('search');
              } else {
                router.back();
              }
            }}
            hitSlop={12}>
            <Text style={styles.cancel}>{step === 'write' && !params.prefillExternalId ? 'Back' : 'Cancel'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{step === 'search' ? 'Link a title' : 'New Discussion'}</Text>
          {step === 'write' ? (
            <Pressable onPress={handlePost} disabled={!canPost} hitSlop={12}>
              {createDiscussion.isPending
                ? <ActivityIndicator color={Brand.trust} />
                : <Text style={[styles.post, !canPost && styles.postDisabled]}>Post</Text>}
            </Pressable>
          ) : (
            <View style={{ width: 44 }} />
          )}
        </View>

        {step === 'search' ? (
          <View style={styles.stepContent}>
            <ContentSearchStep Brand={Brand} onPick={handlePick} onSkip={handleSkip} />
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}>

            {/* Linked content card */}
            {linked ? (
              <View style={[styles.linkedCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                {linked.poster ? (
                  <Image source={{ uri: linked.poster }} style={styles.linkedPoster} resizeMode="cover" />
                ) : (
                  <View style={[styles.linkedPoster, { backgroundColor: typeColors?.bg ?? Brand.tlight }]} />
                )}
                <View style={styles.linkedInfo}>
                  {typeColors && (
                    <View style={[styles.linkedPill, { backgroundColor: typeColors.bg }]}>
                      <Text style={[styles.linkedPillText, { color: typeColors.color }]}>
                        {discussionType === 'watch' ? 'TV & FILM' : discussionType === 'read' ? 'BOOKS' : discussionType === 'play' ? 'GAMES' : discussionType === 'listen' ? 'MUSIC' : 'PODCASTS'}
                      </Text>
                    </View>
                  )}
                  <Text style={[styles.linkedTitle, { color: Brand.ink }]} numberOfLines={2}>{linked.title}</Text>
                </View>
                {!params.prefillExternalId && (
                  <Pressable onPress={() => setStep('search')} hitSlop={8}>
                    <Text style={[styles.changeLink, { color: Brand.trust }]}>Change</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable
                style={[styles.addLinkBtn, { borderColor: Brand.border }]}
                onPress={() => setStep('search')}>
                <Text style={[styles.addLinkText, { color: Brand.muted }]}>+ Link to a title (optional)</Text>
              </Pressable>
            )}

            {/* Title */}
            <Text style={styles.sectionLabel}>Title <Text style={styles.required}>*</Text></Text>
            <View style={[styles.inputWrap, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
              <TextInput
                style={[styles.titleInput, { color: Brand.ink }]}
                placeholder="What do you want to discuss?"
                placeholderTextColor={Brand.muted}
                value={title}
                onChangeText={setTitle}
                multiline
                scrollEnabled={false}
                maxLength={300}
                returnKeyType="next"
                autoFocus={step === 'write'}
              />
            </View>
            <Text style={[styles.charCount, { color: Brand.muted }]}>{title.length}/300</Text>

            {/* Body */}
            <Text style={styles.sectionLabel}>Body <Text style={styles.optional}>(optional)</Text></Text>
            <View style={[styles.inputWrap, styles.bodyWrap, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
              <TextInput
                style={[styles.bodyInput, { color: Brand.ink }]}
                placeholder="Share more context, a hot take, a question…"
                placeholderTextColor={Brand.muted}
                value={body}
                onChangeText={setBody}
                multiline
                scrollEnabled={false}
                maxLength={10000}
                textAlignVertical="top"
              />
            </View>
            <Text style={[styles.charCount, { color: Brand.muted }]}>{body.length}/10000</Text>

            {/* Poll toggle */}
            <Pressable
              style={[styles.pollToggleRow, { borderColor: pollEnabled ? Brand.trust : Brand.border, backgroundColor: pollEnabled ? Brand.tlight : Brand.card }]}
              onPress={() => {
                setPollEnabled((v) => !v);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
              }}>
              <Text style={[styles.pollToggleIcon, { color: pollEnabled ? Brand.trust : Brand.muted }]}>📊</Text>
              <Text style={[styles.pollToggleLabel, { color: pollEnabled ? Brand.trust : Brand.ink }]}>
                {pollEnabled ? 'Poll added' : 'Add a poll'}
              </Text>
              <Text style={[styles.pollToggleSub, { color: Brand.muted }]}>optional</Text>
            </Pressable>

            {pollEnabled && (
              <View style={[styles.pollCard, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
                {/* Question */}
                <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Poll question</Text>
                <View style={[styles.inputWrap, { borderColor: Brand.border, backgroundColor: Brand.paper }]}>
                  <TextInput
                    style={[styles.titleInput, { color: Brand.ink, fontSize: 14 }]}
                    placeholder="e.g. Which ending did you prefer?"
                    placeholderTextColor={Brand.muted}
                    value={pollQuestion}
                    onChangeText={setPollQuestion}
                    scrollEnabled={false}
                    maxLength={200}
                  />
                </View>

                {/* Options */}
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Options</Text>
                {pollOptions.map((opt, i) => (
                  <View key={i} style={[styles.pollOptionRow, i > 0 && { marginTop: 8 }]}>
                    <View style={[styles.inputWrap, { flex: 1, borderColor: Brand.border, backgroundColor: Brand.paper, paddingVertical: 8 }]}>
                      <TextInput
                        style={[styles.bodyInput, { color: Brand.ink, minHeight: 0, fontSize: 14 }]}
                        placeholder={`Option ${i + 1}${i < 2 ? ' *' : ' (optional)'}`}
                        placeholderTextColor={Brand.muted}
                        value={opt}
                        onChangeText={(text) => {
                          const next = [...pollOptions];
                          next[i] = text;
                          setPollOptions(next);
                        }}
                        maxLength={120}
                      />
                    </View>
                    {pollOptions.length > 2 && (
                      <Pressable
                        hitSlop={8}
                        onPress={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}
                        style={styles.pollRemoveBtn}>
                        <Text style={{ color: Brand.muted, fontSize: 18, lineHeight: 22 }}>×</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {pollOptions.length < 4 && (
                  <Pressable
                    style={[styles.pollAddOptionBtn, { borderColor: Brand.border }]}
                    onPress={() => setPollOptions([...pollOptions, ''])}>
                    <Text style={[styles.addLinkText, { color: Brand.muted }]}>+ Add option</Text>
                  </Pressable>
                )}
              </View>
            )}
          </ScrollView>
        )}
      </View>
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
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Brand.border,
    },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    cancel: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.muted },
    post: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    postDisabled: { opacity: 0.35 },
    stepContent: { flex: 1, padding: 16 },
    scroll: { flex: 1 },
    content: { padding: 16, gap: 8, paddingBottom: 120 },

    linkedCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      marginBottom: 4,
    },
    linkedPoster: { width: 40, height: 56, borderRadius: 6, flexShrink: 0 },
    linkedInfo: { flex: 1, gap: 4 },
    linkedPill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2 },
    linkedPillText: { fontFamily: BrandFonts.interMedium, fontSize: 9, letterSpacing: 0.5 },
    linkedTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
    changeLink: { fontFamily: BrandFonts.interMedium, fontSize: 13 },

    addLinkBtn: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 12,
      paddingVertical: 10,
      alignItems: 'center',
      marginBottom: 4,
    },
    addLinkText: { fontFamily: BrandFonts.interMedium, fontSize: 13 },

    sectionLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginTop: 8,
      marginBottom: 4,
    },
    required: { color: '#EF4444' },
    optional: { color: Brand.muted, textTransform: 'none', letterSpacing: 0 },
    inputWrap: {
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    titleInput: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 16,
      lineHeight: 22,
    },
    bodyWrap: { minHeight: 120 },
    bodyInput: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      lineHeight: 20,
      minHeight: 96,
    },
    charCount: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      textAlign: 'right',
      marginTop: 2,
    },

    // Poll
    pollToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginTop: 8,
    },
    pollToggleIcon: { fontSize: 16 },
    pollToggleLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14, flex: 1 },
    pollToggleSub: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    pollCard: {
      borderWidth: 1,
      borderRadius: 14,
      padding: 14,
      marginTop: 8,
      gap: 4,
    },
    pollOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    pollRemoveBtn: { paddingHorizontal: 4 },
    pollAddOptionBtn: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 10,
      paddingVertical: 9,
      alignItems: 'center',
      marginTop: 10,
    },
  });
}
