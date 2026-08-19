import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { type DiscussionType, useCreateDiscussion, useCreateDiscussionPoll } from '@/features/discussions/api';
import { track, Events } from '@/features/analytics/api';
import { type SearchResult, useUniversalSearch } from '@/features/search/api';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { QueryErrorState } from '@/components/query-error-state';
import { supabase } from '@/lib/supabase';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

async function uploadDiscussionImage(userId: string, uri: string, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/gif' ? 'gif' : 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;

  // Read from filesystem as base64, then decode to ArrayBuffer — the proven Expo+Supabase pattern
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const arrayBuffer = decode(base64);

  const { error } = await supabase.storage
    .from('discussion-images')
    .upload(path, arrayBuffer, { contentType: mimeType, upsert: false });
  if (error) throw error;

  // Use a 10-year signed URL — bypasses all RLS/public-bucket complexity
  const { data: signed, error: signErr } = await supabase.storage
    .from('discussion-images')
    .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (signErr || !signed?.signedUrl) throw signErr ?? new Error('No signed URL');
  return signed.signedUrl;
}

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
  const { data: results = [], isLoading, isError, refetch } = useUniversalSearch(query);

  return (
    <View style={{ flex: 1 }}>
      <Text style={[searchStyles.hint, { color: Brand.muted }]}>
        Search for a show, film, book, game or album to link your discussion to it, or skip to post without one.
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
                  <Image source={{ uri: r.img }} style={searchStyles.thumb} contentFit="cover" cachePolicy="memory-disk" recyclingKey={r.img} />
                ) : (
                  <View style={[searchStyles.thumb, { backgroundColor: colors.bg }]} />
                )}
                <View style={searchStyles.rowBody}>
                  <Text style={[searchStyles.rowType, { color: colors.color }]}>{r.mediaType === 'tv' ? 'TV SERIES' : r.mediaType === 'movie' ? 'FILM' : r.entryType?.toUpperCase()}</Text>
                  <Text style={[searchStyles.rowTitle, { color: Brand.ink }]} numberOfLines={1}>{r.title}</Text>
                  {r.sub ? <Text style={[searchStyles.rowSub, { color: Brand.muted }]} numberOfLines={1}>{r.sub}</Text> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {query.trim().length >= 2 && !isLoading && isError && (
        // "No results" would suggest the title does not exist, rather than
        // that the search itself failed.
        <QueryErrorState title="Search didn't load" onRetry={refetch} />
      )}

      {query.trim().length >= 2 && !isLoading && !isError && results.length === 0 && (
        <Text style={[searchStyles.noResults, { color: Brand.muted }]}>No results for "{query}"</Text>
      )}

      <Pressable style={searchStyles.skipBtn} onPress={onSkip} accessibilityRole="button" accessibilityLabel="Skip, post without linking to a title">
        <Text style={[searchStyles.skipText, { color: Brand.muted }]}>Skip, post without linking to a title</Text>
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

// ── Type picker step ─────────────────────────────────────────────────────────

type DiscussionFormat = 'discussion' | 'poll' | 'hot_take';

const FORMAT_OPTIONS: {
  value: DiscussionFormat;
  label: string;
  emoji: string;
  description: string;
  cardBg: string;
  labelColor: string;
}[] = [
  { value: 'discussion', label: 'Discussion', emoji: '💬', description: 'Start an open conversation and see what others think.', cardBg: '#EDE9FE', labelColor: '#6D28D9' },
  { value: 'poll',       label: 'Poll',       emoji: '📊', description: 'Ask a question and let the community vote.',            cardBg: '#FEF9C3', labelColor: '#92400E' },
  { value: 'hot_take',   label: 'Hot Take',   emoji: '🔥', description: 'Share a bold take and see who agrees (or disagrees).', cardBg: '#FEE2E2', labelColor: '#DC2626' },
];

function TypePickerStep({
  onPick,
}: {
  onPick: (format: DiscussionFormat) => void;
}) {
  return (
    <View style={typeStyles.wrap}>
      <Text style={typeStyles.heading}>What do you want to create?</Text>
      {FORMAT_OPTIONS.map((opt) => (
        <Pressable
          key={opt.value}
          style={[typeStyles.card, { backgroundColor: opt.cardBg }]}
          onPress={() => onPick(opt.value)}
          accessibilityRole="button"
          accessibilityLabel={opt.label}>
          <Text style={typeStyles.cardEmoji}>{opt.emoji}</Text>
          <View style={typeStyles.cardBody}>
            <Text style={[typeStyles.cardLabel, { color: opt.labelColor }]}>{opt.label.toUpperCase()}</Text>
            <Text style={typeStyles.cardDesc}>{opt.description}</Text>
          </View>
          <Text style={typeStyles.cardChevron}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

const typeStyles = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 12 },
  heading: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: '#111827', marginBottom: 8, lineHeight: 30 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 20,
    padding: 18,
  },
  cardEmoji: { fontSize: 32, width: 44, textAlign: 'center' },
  cardBody: { flex: 1, gap: 3 },
  cardLabel: { fontFamily: BrandFonts.syneBold, fontSize: 13, letterSpacing: 0.8 },
  cardDesc: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: '#374151', lineHeight: 19 },
  cardChevron: { fontSize: 22, color: '#9CA3AF' },
});

// ── Write step ────────────────────────────────────────────────────────────────

export default function CreateDiscussionModal() {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const createDiscussion = useCreateDiscussion();
  const createPoll = useCreateDiscussionPoll();

  // Prefill params from content-room "Start a discussion" button
  const params = useLocalSearchParams<{
    prefillExternalId?: string;
    prefillMediaType?: string;
    prefillTitle?: string;
    prefillPoster?: string;
  }>();

  const [format, setFormat] = useState<DiscussionFormat>('discussion');
  const [step, setStep] = useState<'search' | 'type' | 'write'>(
    params.prefillExternalId ? 'type' : 'search'
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


  const [title, setTitle] = useState(params.prefillTitle ?? '');
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>('image/jpeg');
  const [imageUploading, setImageUploading] = useState(false);

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo access to attach an image.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      const mime = asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg');
      setImageMime(mime);
    }
  }

  // Poll (optional)
  const [pollEnabled, setPollEnabled] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Quiz: array of questions, each with their own options and a correct answer
  const BLANK_QUIZ_Q = () => ({ question: '', options: ['', ''], correctIndex: null as number | null });
  const [quizQuestions, setQuizQuestions] = useState([BLANK_QUIZ_Q()]);

  const isPoll = format === 'poll';
  const isQuiz = false;

  const pollValid = !isPoll || (isQuiz
    ? quizQuestions.every((q) => q.question.trim().length >= 3 && q.options.filter((o) => o.trim()).length >= 2)
    : pollQuestion.trim().length >= 3 && pollOptions.filter((o) => o.trim().length > 0).length >= 2
  );
  const canPost = title.trim().length >= 3 && pollValid && !createDiscussion.isPending && !imageUploading;

  function updateQuizQuestion(qi: number, text: string) {
    setQuizQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, question: text } : q));
  }
  function updateQuizOption(qi: number, oi: number, text: string) {
    setQuizQuestions((prev) => prev.map((q, i) => {
      if (i !== qi) return q;
      const opts = [...q.options]; opts[oi] = text;
      return { ...q, options: opts };
    }));
  }
  function addQuizOption(qi: number) {
    setQuizQuestions((prev) => prev.map((q, i) => i === qi && q.options.length < 6 ? { ...q, options: [...q.options, ''] } : q));
  }
  function removeQuizOption(qi: number, oi: number) {
    setQuizQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, options: q.options.filter((_, j) => j !== oi) } : q));
  }
  function addQuizQuestion() {
    if (quizQuestions.length < 8) {
      setQuizQuestions((prev) => [...prev, BLANK_QUIZ_Q()]);
    }
  }
  function removeQuizQuestion(qi: number) {
    if (quizQuestions.length > 1) setQuizQuestions((prev) => prev.filter((_, i) => i !== qi));
  }
  function setCorrectIndex(qi: number, oi: number) {
    setQuizQuestions((prev) => prev.map((q, i) => i === qi ? { ...q, correctIndex: q.correctIndex === oi ? null : oi } : q));
  }

  async function handlePost() {
    if (!canPost) return;
    try {
      let uploadedImageUrl: string | undefined;
      if (imageUri && user) {
        setImageUploading(true);
        try {
          uploadedImageUrl = await uploadDiscussionImage(user.id, imageUri!, imageMime);
        } catch (err) {
          console.error('Image upload error:', err);
          Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
        } finally {
          setImageUploading(false);
        }
      }
      const id = await createDiscussion.mutateAsync({
        title,
        body,
        type: discussionType,
        format: isPoll ? 'poll' : format === 'hot_take' ? 'hot_take' : 'discussion',
        contentTitle: linked?.title,
        contentPoster: linked?.poster ?? undefined,
        contentExternalId: linked?.externalId,
        contentMediaType: linked?.mediaType,
        imageUrl: uploadedImageUrl,
      });
      if (isQuiz) {
        const validQs = quizQuestions
          .map((q) => ({ question: q.question.trim(), options: q.options.map((o) => o.trim()).filter(Boolean), correct_index: q.correctIndex ?? null }))
          .filter((q) => q.question.length >= 3 && q.options.length >= 2);
        if (validQs.length > 0) {
          await createPoll.mutateAsync({
            discussionId: id,
            question: validQs[0].question,
            options: validQs[0].options,
            questions: validQs,
          });
        }
      } else if (isPoll && pollQuestion.trim()) {
        const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
        if (filledOptions.length >= 2) {
          await createPoll.mutateAsync({ discussionId: id, question: pollQuestion.trim(), options: filledOptions });
        }
      }
      track(user?.id, Events.DISCUSSION_CREATED, {
        discussion_id: id,
        format: isQuiz ? 'quiz' : isPoll ? 'poll' : 'discussion',
        type: discussionType,
        has_content: !!linked,
        has_body: !!body.trim(),
      });
      router.back();
      router.push({ pathname: '/discussion-detail-modal', params: { id } });
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not post. Please try again.');
    }
  }

  function handlePick(content: LinkedContent) {
    setLinked(content);
    setStep('type');
  }

  function handleSkip() {
    setLinked(null);
    setStep('type');
  }

  function handleFormatPick(f: DiscussionFormat) {
    setFormat(f);
    setPollEnabled(f === 'poll');
    setStep('write');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              if (step === 'write') setStep('type');
              else if (step === 'type' && !params.prefillExternalId) setStep('search');
              else router.back();
            }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={step === 'search' ? 'Cancel' : 'Go back'}>
            <Text style={styles.cancel}>{step === 'search' ? 'Cancel' : 'Back'}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>
            {step === 'search' ? 'Search a title' : step === 'type' ? 'Start a conversation' : FORMAT_OPTIONS.find(f => f.value === format)?.label ?? 'New Discussion'}
          </Text>
          {step === 'write' ? (
            <Pressable onPress={handlePost} disabled={!canPost} hitSlop={12} accessibilityRole="button" accessibilityLabel="Post discussion">
              {createDiscussion.isPending || imageUploading
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
        ) : step === 'type' ? (
          <TypePickerStep onPick={handleFormatPick} />
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets={true}
>

            {/* Linked content card */}
            {linked ? (
              <View style={[styles.linkedCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                {linked.poster ? (
                  <Image source={{ uri: linked.poster }} style={styles.linkedPoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={linked.poster} />
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

            {/* Photo attachment */}
            {imageUri ? (
              <View style={styles.imagePreviewWrap}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" cachePolicy="memory-disk" recyclingKey={imageUri} />
                <Pressable
                  style={styles.imageRemoveBtn}
                  hitSlop={8}
                  onPress={() => setImageUri(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Remove image">
                  <View style={styles.imageRemoveCircle}>
                    <SymbolView name="xmark" size={12} tintColor="#fff" type="monochrome" style={{ width: 12, height: 12 }} />
                  </View>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.addPhotoBtn, { borderColor: Brand.border }]}
                onPress={pickImage}
                accessibilityRole="button"
                accessibilityLabel="Add a photo">
                <SymbolView name="photo.badge.plus" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16 }} />
                <Text style={[styles.addPhotoText, { color: Brand.muted }]}>Add a photo</Text>
                <Text style={[styles.addPhotoOptional, { color: Brand.muted }]}>optional</Text>
              </Pressable>
            )}

            {/* Poll toggle — always visible for poll/quiz, optional for others */}
            {!isPoll && (
              <Pressable
                style={[styles.pollToggleRow, { borderColor: pollEnabled ? Brand.trust : Brand.border, backgroundColor: pollEnabled ? Brand.tlight : Brand.card }]}
                accessibilityRole="button"
                accessibilityLabel={pollEnabled ? 'Remove poll' : 'Add a poll'}
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
            )}

            {(pollEnabled || isPoll) && !isQuiz && (
              <View style={[styles.pollCard, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
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
                <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Options</Text>
                {pollOptions.map((opt, i) => (
                  <View key={i} style={[styles.pollOptionRow, i > 0 && { marginTop: 8 }]}>
                    <View style={[styles.inputWrap, { flex: 1, borderColor: Brand.border, backgroundColor: Brand.paper, paddingVertical: 8 }]}>
                      <TextInput
                        style={[styles.bodyInput, { color: Brand.ink, minHeight: 0, fontSize: 14 }]}
                        placeholder={`Option ${i + 1}${i < 2 ? ' *' : ' (optional)'}`}
                        placeholderTextColor={Brand.muted}
                        value={opt}
                        onChangeText={(text) => { const next = [...pollOptions]; next[i] = text; setPollOptions(next); }}
                        maxLength={120}
                      />
                    </View>
                    {pollOptions.length > 2 && (
                      <Pressable hitSlop={8} onPress={() => setPollOptions(pollOptions.filter((_, j) => j !== i))} style={styles.pollRemoveBtn}>
                        <Text style={{ color: Brand.muted, fontSize: 18, lineHeight: 22 }}>×</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {pollOptions.length < 4 && (
                  <Pressable style={[styles.pollAddOptionBtn, { borderColor: Brand.border }]} onPress={() => setPollOptions([...pollOptions, ''])}>
                    <Text style={[styles.addLinkText, { color: Brand.muted }]}>+ Add option</Text>
                  </Pressable>
                )}
              </View>
            )}

            {isQuiz && (
              <ScrollView

                nestedScrollEnabled
                scrollEnabled
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ gap: 12, paddingBottom: 8 }}
                style={{ maxHeight: 1200 }}>
                {quizQuestions.map((q, qi) => (
                  <View key={qi} style={[styles.pollCard, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
                    {/* Question header */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <Text style={[styles.sectionLabel, { marginTop: 0 }]}>Question {qi + 1}</Text>
                      {quizQuestions.length > 1 && (
                        <Pressable hitSlop={10} onPress={() => removeQuizQuestion(qi)}>
                          <Text style={{ color: Brand.muted, fontSize: 18 }}>×</Text>
                        </Pressable>
                      )}
                    </View>
                    <View style={[styles.inputWrap, { borderColor: Brand.border, backgroundColor: Brand.paper }]}>
                      <TextInput
                        style={[styles.titleInput, { color: Brand.ink, fontSize: 14 }]}
                        placeholder="e.g. Who said this line?"
                        placeholderTextColor={Brand.muted}
                        value={q.question}
                        onChangeText={(t) => updateQuizQuestion(qi, t)}
                        scrollEnabled={false}
                        maxLength={200}
                      />
                    </View>
                    <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Options <Text style={{ color: Brand.muted, fontWeight: '400' }}>— tap ✓ to mark correct answer</Text></Text>
                    {q.options.map((opt, oi) => {
                      const isCorrect = q.correctIndex === oi;
                      return (
                        <View key={oi} style={[styles.pollOptionRow, oi > 0 && { marginTop: 8 }]}>
                          <Pressable
                            hitSlop={4}
                            onPress={() => setCorrectIndex(qi, oi)}
                            style={{
                              width: 28, height: 28, borderRadius: 14, borderWidth: 1.5,
                              borderColor: isCorrect ? '#22C55E' : Brand.border,
                              backgroundColor: isCorrect ? '#22C55E' : 'transparent',
                              alignItems: 'center', justifyContent: 'center', marginRight: 8,
                            }}>
                            {isCorrect && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>✓</Text>}
                          </Pressable>
                          <View style={[styles.inputWrap, { flex: 1, borderColor: isCorrect ? '#22C55E' : Brand.border, backgroundColor: Brand.paper, paddingVertical: 8 }]}>
                            <TextInput
                              style={[styles.bodyInput, { color: Brand.ink, minHeight: 0, fontSize: 14 }]}
                              placeholder={`Option ${oi + 1}${oi < 2 ? ' *' : ' (optional)'}`}
                              placeholderTextColor={Brand.muted}
                              value={opt}
                              onChangeText={(t) => updateQuizOption(qi, oi, t)}
                              maxLength={120}
                            />
                          </View>
                          {q.options.length > 2 && (
                            <Pressable hitSlop={8} onPress={() => removeQuizOption(qi, oi)} style={styles.pollRemoveBtn}>
                              <Text style={{ color: Brand.muted, fontSize: 18, lineHeight: 22 }}>×</Text>
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                    {q.options.length < 6 && (
                      <Pressable style={[styles.pollAddOptionBtn, { borderColor: Brand.border }]} onPress={() => addQuizOption(qi)}>
                        <Text style={[styles.addLinkText, { color: Brand.muted }]}>+ Add option</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
                {quizQuestions.length < 8 && (
                  <Pressable
                    style={[styles.pollAddOptionBtn, { borderColor: Brand.trust, marginTop: 0 }]}
                    onPress={addQuizQuestion}>
                    <Text style={[styles.addLinkText, { color: Brand.trust }]}>+ Add question ({quizQuestions.length}/8)</Text>
                  </Pressable>
                )}
              </ScrollView>
            )}
          </ScrollView>
        )}
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
    content: { padding: 16, gap: 8, paddingBottom: 200 },

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

    // Photo
    addPhotoBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginTop: 4,
    },
    addPhotoText: { fontFamily: BrandFonts.syneBold, fontSize: 14, flex: 1 },
    addPhotoOptional: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    imagePreviewWrap: {
      marginTop: 4,
      borderRadius: 14,
      overflow: 'hidden',
      position: 'relative',
    },
    imagePreview: {
      width: '100%',
      height: 200,
      borderRadius: 14,
    },
    imageRemoveBtn: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
    imageRemoveCircle: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
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
