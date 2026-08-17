import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { SymbolView } from 'expo-symbols';
import { LinearGradient } from 'expo-linear-gradient';
import { Circle, Svg } from 'react-native-svg';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActionSheetIOS, ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import {
  DISCUSSION_EMOJI_OPTIONS,
  type Discussion,
  type DiscussionComment,
  type DiscussionPoll,
  timeAgo,
  useAddDiscussionComment,
  useDeleteDiscussion,
  useDeleteDiscussionComment,
  useDiscussion,
  useDiscussionComments,
  useDiscussionPoll,
  useDiscussionReactions,
  useDiscussionSaved,
  useToggleDiscussionReaction,
  useToggleDiscussionSave,
  useToggleDiscussionDisagree,
  useToggleDiscussionVote,
  useUpdateDiscussion,
  useVoteOnPoll,
} from '@/features/discussions/api';
import { track, Events } from '@/features/analytics/api';
import { supabase } from '@/lib/supabase';
import { tmdbFetch } from '@/lib/tmdb';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const TYPE_LABELS: Record<string, string> = {
  read: 'Books', watch: 'TV & Film', tv: 'TV & Film',
  play: 'Games', listen: 'Music', podcast: 'Podcasts', general: 'General',
};

type SortMode = 'popular' | 'recent' | 'oldest';

// ── Poll block (immersive style) ──────────────────────────────────────────────

function QuestionBlock({
  question,
  options,
  vote_counts,
  total_votes,
  my_vote,
  correct_index,
  onVote,
  Brand,
  label,
  isQuiz,
}: {
  question: string;
  options: string[];
  vote_counts: number[];
  total_votes: number;
  my_vote: number | null;
  correct_index?: number | null;
  onVote: (optionIndex: number) => void;
  Brand: BrandPalette;
  isQuiz?: boolean;
  label?: string;
}) {
  const voted = my_vote !== null;
  const total = total_votes;
  const hasAnswer = correct_index != null;

  return (
    <View style={{ gap: 8 }}>
      {label && <Text style={[pStyles.questionLabel, { color: Brand.muted }]}>{label}</Text>}
      <Text style={[pStyles.questionText, { color: Brand.ink }]}>{question}</Text>
      {options.map((opt, i) => {
        const count = vote_counts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMyVote = my_vote === i;
        const isCorrect = hasAnswer && i === correct_index;
        const isWrong = voted && hasAnswer && isMyVote && !isCorrect;

        // After voting: green for correct, red for my wrong pick, muted for others
        let bgColor = '#F5F0E8';
        let fillColor = '#EDE9FE';
        let labelColor = '#1F2937';
        if (voted) {
          if (isCorrect) { bgColor = '#DCFCE7'; fillColor = '#16A34A'; labelColor = '#15803D'; }
          else if (isWrong) { bgColor = '#FEE2E2'; fillColor = '#EF4444'; labelColor = '#B91C1C'; }
          else { bgColor = '#F3F4F6'; fillColor = '#E5E7EB'; labelColor = '#6B7280'; }
        }

        return (
          <Pressable
            key={i}
            disabled={voted}
            onPress={() => onVote(i)}
            style={[pStyles.option, { backgroundColor: bgColor }]}>
            {voted && (
              <View style={[pStyles.fill, { ...(pct >= 100 ? { right: 0 } : { width: `${pct}%` as any }), backgroundColor: fillColor, opacity: 0.25 }]} />
            )}
            <Text style={[pStyles.optLabel, { color: labelColor }]} numberOfLines={1}>{opt}</Text>
            {voted && isCorrect && (
              <View style={pStyles.checkWrap}>
                <SymbolView name="checkmark.circle.fill" size={18} tintColor="#16A34A" type="monochrome" style={{ width: 18, height: 18 }} />
              </View>
            )}
            {voted && isWrong && (
              <View style={pStyles.checkWrap}>
                <SymbolView name="xmark.circle.fill" size={18} tintColor="#EF4444" type="monochrome" style={{ width: 18, height: 18 }} />
              </View>
            )}
            {!hasAnswer && !isQuiz && isMyVote && voted && (
              <View style={pStyles.checkWrap}>
                <SymbolView name="checkmark.circle.fill" size={18} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
              </View>
            )}
            {voted && <Text style={[pStyles.optPct, { color: labelColor }]}>{pct}%</Text>}
          </Pressable>
        );
      })}
      <Text style={[pStyles.meta, { color: Brand.muted }]}>
        {total.toLocaleString()} {total === 1 ? 'vote' : 'votes'}{!voted ? ' · tap to vote' : ''}
      </Text>
      {voted && hasAnswer && (
        <View style={pStyles.votedRow}>
          <Text style={[pStyles.votedText, { color: my_vote === correct_index ? '#16A34A' : '#EF4444' }]}>
            {my_vote === correct_index ? '✓ Correct!' : '✗ Wrong answer'}
          </Text>
        </View>
      )}
      {voted && !hasAnswer && <View style={pStyles.votedRow}><Text style={[pStyles.votedText, { color: Brand.muted }]}>Voted by you</Text></View>}
    </View>
  );
}

function ProgressCircle({ current, total }: { current: number; total: number }) {
  const SIZE = 56;
  const STROKE = 3;
  const R = (SIZE - STROKE * 2) / 2;
  const CIRC = 2 * Math.PI * R;
  const progress = total > 1 ? ((current + 1) / total) : 1;
  const dash = CIRC * progress;
  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SIZE} height={SIZE} style={{ position: 'absolute' }}>
        <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={STROKE} />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none"
          stroke="#fff" strokeWidth={STROKE}
          strokeDasharray={`${dash} ${CIRC}`}
          strokeLinecap="round"
          rotation={-90}
          originX={SIZE / 2}
          originY={SIZE / 2}
        />
      </Svg>
      <Text style={{ color: '#fff', fontFamily: BrandFonts.syneExtraBold, fontSize: 18 }}>{current + 1}</Text>
    </View>
  );
}

function PollBlock({
  poll,
  onVote,
  Brand,
  currentQuestion,
  onQuestionChange,
}: {
  poll: DiscussionPoll;
  onVote: (optionIndex: number, questionIndex?: number) => void;
  Brand: BrandPalette;
  currentQuestion?: number;
  onQuestionChange?: (qi: number) => void;
}) {
  // Multi-question quiz — one question at a time
  if (poll.questions && poll.questions.length > 0) {
    const qi = currentQuestion ?? 0;
    const q = poll.questions[qi];
    const total = poll.questions.length;
    const voted = q.my_vote !== null;
    return (
      <View style={pStyles.outer}>
        <View style={[pStyles.card, { backgroundColor: Brand.card }]}>
          <QuestionBlock
            question={q.question}
            options={q.options}
            vote_counts={q.vote_counts}
            total_votes={q.total_votes}
            my_vote={q.my_vote}
            correct_index={q.correct_index}
            onVote={(oi) => onVote(oi, qi)}
            Brand={Brand}
            isQuiz
          />
          {/* Next / prev navigation */}
          {total > 1 && (
            <View style={pStyles.qNav}>
              <Pressable
                onPress={() => onQuestionChange?.(qi - 1)}
                disabled={qi === 0}
                style={[pStyles.qNavBtn, { opacity: qi === 0 ? 0.3 : 1 }]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Previous question">
                <Text style={[pStyles.qNavText, { color: Brand.trust }]}>‹ Prev</Text>
              </Pressable>
              <Text style={[pStyles.qNavCount, { color: Brand.muted }]}>{qi + 1} / {total}</Text>
              <Pressable
                onPress={() => onQuestionChange?.(qi + 1)}
                disabled={qi === total - 1 || !voted}
                style={[pStyles.qNavBtn, { opacity: (qi === total - 1 || !voted) ? 0.3 : 1 }]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Next question">
                <Text style={[pStyles.qNavText, { color: Brand.trust }]}>Next ›</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    );
  }

  // Single-question poll
  return (
    <View style={pStyles.outer}>
      <View style={pStyles.card}>
        <QuestionBlock
          question={poll.question}
          options={poll.options}
          vote_counts={poll.vote_counts}
          total_votes={poll.total_votes}
          my_vote={poll.my_vote}
          onVote={(oi) => onVote(oi)}
          Brand={Brand}
        />
      </View>
    </View>
  );
}

const pStyles = StyleSheet.create({
  outer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  option: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    minHeight: 54,
  },
  fill: { position: 'absolute', top: 0, left: 0, bottom: 0 },
  optLabel: { fontFamily: BrandFonts.syneBold, fontSize: 15, flex: 1, zIndex: 1 },
  checkWrap: { zIndex: 1, marginRight: 8 },
  optPct: { fontFamily: BrandFonts.syneBold, fontSize: 15, zIndex: 1 },
  meta: { fontFamily: BrandFonts.interRegular, fontSize: 13, marginTop: 2 },
  votedRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  votedText: { fontFamily: BrandFonts.interMedium, fontSize: 13 },
  questionLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  questionText: { fontFamily: BrandFonts.syneBold, fontSize: 15, lineHeight: 20, marginBottom: 4 },
  questionDivider: { height: 1, marginVertical: 16 },
  qNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB' },
  qNavBtn: { paddingHorizontal: 4 },
  qNavText: { fontFamily: BrandFonts.syneBold, fontSize: 15 },
  qNavCount: { fontFamily: BrandFonts.interMedium, fontSize: 13 },
});

// ── Comment row ───────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  isReply,
  onReply,
  onDelete,
  opUserId,
  Brand,
}: {
  comment: DiscussionComment;
  isReply: boolean;
  onReply: (comment: DiscussionComment) => void;
  onDelete: (comment: DiscussionComment) => void;
  opUserId: string;
  Brand: BrandPalette;
}) {
  const { user } = useSession();
  const isOwn = user?.id === comment.user_id;
  const isOp = comment.user_id === opUserId;
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const showBlur = comment.is_spoiler && !spoilerRevealed;

  function showOptions() {
    if (!isOwn) return;
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Delete comment'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
      (i) => { if (i === 1) onDelete(comment); },
    );
  }

  return (
    <View style={[cStyles.wrap, isReply && cStyles.wrapReply, { borderTopColor: Brand.border }]}>
      {isReply && <View style={[cStyles.replyLine, { backgroundColor: Brand.border }]} />}
      <Avatar avatarUrl={comment.author_avatar} name={comment.author_name} size={isReply ? 24 : 30} />
      <View style={{ flex: 1, gap: 5 }}>
        <View style={cStyles.header}>
          <Text style={[cStyles.author, { color: Brand.ink }]}>{comment.author_name}</Text>
          {!!comment.author_verified_tier && <VerifiedBadge tier={comment.author_verified_tier} size={12} />}
          {isOp && (
            <View style={[cStyles.opBadge, { backgroundColor: Brand.tlight }]}>
              <Text style={[cStyles.opText, { color: Brand.trust }]}>OP</Text>
            </View>
          )}
          {comment.is_spoiler && (
            <View style={[cStyles.spoilerBadge, { backgroundColor: Brand.tlight, borderColor: Brand.border, borderWidth: 1 }]}>
              <Text style={{ fontFamily: BrandFonts.interMedium, fontSize: 9, color: '#D97706' }}>🔒 SPOILER</Text>
            </View>
          )}
          <Text style={[cStyles.time, { color: Brand.muted }]}>{timeAgo(comment.created_at)}</Text>
        </View>

        {showBlur ? (
          <Pressable onPress={() => setSpoilerRevealed(true)} accessibilityRole="button" accessibilityLabel="Tap to reveal spoiler">
            <Text style={[cStyles.body, { color: 'transparent', textShadowColor: 'rgba(0,0,0,0.25)', textShadowRadius: 8 }]} numberOfLines={2}>{comment.body}</Text>
            <Text style={[cStyles.revealText, { color: Brand.muted }]}>Tap to reveal spoiler</Text>
          </Pressable>
        ) : (
          <Text style={[cStyles.body, { color: Brand.ink }]}>{comment.body}</Text>
        )}

        <View style={cStyles.actions}>
          <Pressable
            onPress={() => onReply(comment)}
            style={[cStyles.replyBtn, { backgroundColor: Brand.tlight }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${comment.author_name}`}>
            <Text style={[cStyles.replyBtnText, { color: Brand.trust }]}>Reply</Text>
          </Pressable>
          {isOwn && (
            <Pressable onPress={showOptions} hitSlop={8} style={cStyles.moreBtn} accessibilityRole="button" accessibilityLabel="Comment options">
              <Text style={[cStyles.moreDots, { color: Brand.muted }]}>···</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const cStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: 'flex-start',
    backgroundColor: '#fff',
  },
  wrapReply: { paddingLeft: 46 },
  replyLine: { position: 'absolute', left: 30, top: 0, bottom: 0, width: 1.5, opacity: 0.3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  author: { fontFamily: BrandFonts.syneBold, fontSize: 13.5 },
  opBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  opText: { fontFamily: BrandFonts.syneBold, fontSize: 10, letterSpacing: 0.3 },
  spoilerBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#FEF3C7' },
  time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5 },
  body: { fontFamily: BrandFonts.interRegular, fontSize: 14.5, lineHeight: 21 },
  revealText: { fontFamily: BrandFonts.interMedium, fontSize: 12, marginTop: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  replyBtn: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6 },
  replyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5 },
  moreBtn: { paddingHorizontal: 4 },
  moreDots: { fontFamily: BrandFonts.syneBold, fontSize: 16, letterSpacing: 2 },
});

// ── Main screen ───────────────────────────────────────────────────────────────

const HERO_HEIGHT = 360;

function useTmdbBackdrop(externalId: string | null | undefined, mediaType: string | null | undefined) {
  return useQuery({
    queryKey: ['tmdb-backdrop', externalId, mediaType],
    queryFn: async () => {
      const type = mediaType === 'movie' ? 'movie' : mediaType === 'tv' ? 'tv' : null;
      if (!type || !externalId) return null;
      const data = await tmdbFetch<any>(`${type}/${externalId}?language=en-US`);
      return data.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${data.backdrop_path}`
        : null;
    },
    enabled: !!externalId && (mediaType === 'movie' || mediaType === 'tv'),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export default function DiscussionDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles_ = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { top, bottom } = useSafeAreaInsets();

  const { data: discussion, isLoading: dLoading, refetch: refetchDiscussion } = useDiscussion(id);
  const { data: comments = [], isLoading: cLoading } = useDiscussionComments(id);
  const { data: poll } = useDiscussionPoll(id);
  const vote = useToggleDiscussionVote();
  const disagree = useToggleDiscussionDisagree();
  const voteOnPoll = useVoteOnPoll();
  const updateDiscussion = useUpdateDiscussion();
  const addComment = useAddDiscussionComment();
  const deleteDiscussion = useDeleteDiscussion();
  const deleteComment = useDeleteDiscussionComment();
  const { data: reactions } = useDiscussionReactions(id);
  const toggleReaction = useToggleDiscussionReaction();
  const { data: isSaved = false } = useDiscussionSaved(id);
  const toggleSave = useToggleDiscussionSave();
  const { data: backdropUrl } = useTmdbBackdrop(discussion?.content_external_id, discussion?.content_media_type);

  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [text, setText] = useState('');
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<{ id: string; username: string; full_name: string; avatar_url: string | null }[]>([]);
  const [sort, setSort] = useState<SortMode>('popular');
  const [kbHeight, setKbHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const [collapsedThreads, setCollapsedThreads] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editImageUri, setEditImageUri] = useState<string | null>(null);
  const [editImageMime, setEditImageMime] = useState<string>('image/jpeg');
  const [editImageUploading, setEditImageUploading] = useState(false);
  // null = keep existing, undefined = remove, string = new URL after upload
  const [editImageUrl, setEditImageUrl] = useState<string | null | undefined>(undefined);
  // Locally confirmed uploaded URL — avoids cache staleness
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);

  async function pickEditImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to attach an image.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.8, aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setEditImageUri(asset.uri);
      setEditImageMime(asset.mimeType ?? (asset.uri.endsWith('.png') ? 'image/png' : 'image/jpeg'));
      setEditImageUrl(null); // mark as "new image pending upload"
    }
  }
  const [showComments, setShowComments] = useState(false);

  // Track discussion_viewed once the discussion loads
  useEffect(() => {
    if (!discussion || !user?.id) return;
    track(user.id, Events.DISCUSSION_VIEWED, {
      discussion_id: discussion.id,
      format: discussion.is_quiz ? 'quiz' : discussion.has_poll ? 'poll' : 'discussion',
      type: discussion.type,
      has_content: !!discussion.content_external_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discussion?.id, user?.id]);

  // (comment hiding on keyboard dismiss removed — caused input bar to vanish on focus)

  const isOwner = user?.id === discussion?.user_id;
  const isPollDiscussion = !!poll;

  function handleToggleSave() {
    if (!discussion) return;
    track(user?.id, isSaved ? Events.DISCUSSION_UNSAVED : Events.DISCUSSION_SAVED, {
      discussion_id: discussion.id,
    });
    toggleSave.mutate({ discussionId: discussion.id, saved: isSaved });
  }

  function showEmojiPicker() {
    if (!discussion) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', ...DISCUSSION_EMOJI_OPTIONS],
        cancelButtonIndex: 0,
        title: 'React to this',
      },
      (i) => {
        if (i === 0) return;
        const emoji = DISCUSSION_EMOJI_OPTIONS[i - 1];
        const reacted = reactions?.mine.has(emoji) ?? false;
        toggleReaction.mutate({ discussionId: discussion.id, emoji, reacted });
      },
    );
  }

  async function handleShare() {
    if (!discussion) return;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Send in a DM', 'Share via…'],
        cancelButtonIndex: 0,
      },
      async (i) => {
        if (i === 1) {
          track(user?.id, Events.DISCUSSION_SHARED, { discussion_id: discussion.id, method: 'dm' });
          router.push({ pathname: '/chat-modal', params: { sharedDiscussionId: discussion.id, title: discussion.title } });
        } else if (i === 2) {
          track(user?.id, Events.DISCUSSION_SHARED, { discussion_id: discussion.id, method: 'native_share' });
          await Share.share({
            message: `Check out this discussion on Clique: "${discussion.title}"`,
          });
        }
      },
    );
  }

  function startEdit() {
    if (!discussion) return;
    setEditTitle(discussion.title);
    setEditBody(discussion.body ?? '');
    setEditImageUri(null);

    setEditImageUrl(undefined); // undefined = keep existing image
    setEditing(true);
  }

  async function saveEdit() {
    if (!discussion || editTitle.trim().length < 3) return;
    try {
      let finalImageUrl: string | null | undefined = undefined; // undefined = don't touch DB column

      if (editImageUri && user) {
        // Upload new image
        setEditImageUploading(true);
        try {
          const ext = editImageMime === 'image/png' ? 'png' : 'jpg';
          const path = `${user.id}/${Date.now()}.${ext}`;
          const base64 = await FileSystem.readAsStringAsync(editImageUri!, { encoding: 'base64' });
          const arrayBuffer = decode(base64);
          const { error: uploadErr } = await supabase.storage
            .from('discussion-images')
            .upload(path, arrayBuffer, { contentType: editImageMime, upsert: false });
          if (uploadErr) throw uploadErr;
          const { data: signed, error: signErr } = await supabase.storage
            .from('discussion-images')
            .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
          if (signErr || !signed?.signedUrl) throw signErr ?? new Error('No signed URL');
          finalImageUrl = signed.signedUrl;
          setLocalImageUrl(finalImageUrl);
        } catch (err) {
          console.error('Image upload error:', err);
          Alert.alert('Upload failed', err instanceof Error ? err.message : String(err));
        } finally {
          setEditImageUploading(false);
        }
      } else if (editImageUrl === null) {
        // User explicitly removed the image
        finalImageUrl = null;
      }
      // else undefined → don't change image_url in DB

      await updateDiscussion.mutateAsync({ id: discussion.id, title: editTitle, body: editBody || null, imageUrl: finalImageUrl });
      await refetchDiscussion();
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    }
  }

  async function handleDeleteDiscussion() {
    if (!discussion) return;
    Alert.alert('Delete discussion?', 'This will delete the post and all comments.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteDiscussion.mutateAsync(discussion.id);
            router.back();
          } catch (err: any) {
            Alert.alert('Error', `Could not delete: ${err?.message ?? 'Unknown error'}`);
          }
        },
      },
    ]);
  }

  function showOwnerMenu() {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Cancel', 'Edit', 'Delete discussion'], destructiveButtonIndex: 2, cancelButtonIndex: 0 },
      (i) => {
        if (i === 1) startEdit();
        if (i === 2) handleDeleteDiscussion();
      },
    );
  }

  const flatItems = useMemo(() => {
    const topLevel = [...comments.filter((c) => !c.parent_id)];
    const repliesMap = new Map<string, DiscussionComment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = repliesMap.get(c.parent_id) ?? [];
        arr.push(c);
        repliesMap.set(c.parent_id, arr);
      }
    }
    if (sort === 'popular') {
      topLevel.sort((a, b) => (repliesMap.get(b.id)?.length ?? 0) - (repliesMap.get(a.id)?.length ?? 0));
    } else if (sort === 'recent') {
      topLevel.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      topLevel.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    const SHOW = 2;
    const result: { comment: DiscussionComment; isReply: boolean; parentId?: string; hiddenCount?: number }[] = [];
    for (const top of topLevel) {
      result.push({ comment: top, isReply: false });
      const replies = repliesMap.get(top.id) ?? [];
      const isCollapsed = collapsedThreads.has(top.id);
      const shown = isCollapsed ? replies.slice(0, SHOW) : replies;
      for (const reply of shown) {
        result.push({ comment: reply, isReply: true, parentId: top.id });
      }
      if (!isCollapsed && replies.length > SHOW) {
        result.push({ comment: top, isReply: false, parentId: '__collapse__' + top.id, hiddenCount: replies.length - SHOW });
      } else if (isCollapsed && replies.length > SHOW) {
        result.push({ comment: top, isReply: false, parentId: '__expand__' + top.id, hiddenCount: replies.length - SHOW });
      }
    }
    return result;
  }, [comments, sort, collapsedThreads]);

  function handleReply(comment: DiscussionComment) {
    setReplyTo(comment);
    inputRef.current?.focus();
  }

  // Mention detection — fires when mentionQuery changes
  useEffect(() => {
    if (mentionQuery === null || mentionQuery.length === 0) {
      setMentionResults([]);
      return;
    }
    const q = mentionQuery.toLowerCase();
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .or(`username.ilike.${q}%,full_name.ilike.%${q}%`)
      .neq('id', user?.id ?? '')
      .limit(6)
      .then(({ data }) => setMentionResults(data ?? []));
  }, [mentionQuery, user?.id]);

  function handleTextChange(val: string) {
    setText(val);
    const match = /@(\w*)$/.exec(val);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  }

  function insertMention(username: string) {
    const newText = text.replace(/@(\w*)$/, `@${username} `);
    setText(newText);
    setMentionQuery(null);
    setMentionResults([]);
  }

  async function handleSend() {
    if (!text.trim() || !id) return;
    try {
      await addComment.mutateAsync({ discussionId: id, body: text.trim(), parentId: replyTo?.id, isSpoiler });
      track(user?.id, Events.COMMENT_ADDED, {
        discussion_id: id,
        is_reply: !!replyTo,
        is_spoiler: isSpoiler,
        char_count: text.trim().length,
      });
      setText('');
      setIsSpoiler(false);
      setReplyTo(null);
    } catch {
      Alert.alert('Error', 'Could not post comment.');
    }
  }

  async function handleDeleteComment(comment: DiscussionComment) {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await deleteComment.mutateAsync({ id: comment.id, discussionId: comment.discussion_id });
          } catch {
            Alert.alert('Could not delete', 'Check your connection and try again.');
          }
        },
      },
    ]);
  }

  const typeColor = (TypeColors as any)[discussion?.type ?? 'general'] ?? { color: '#6B7280', bg: '#F3F4F6' };
  const typeLabel = TYPE_LABELS[discussion?.type ?? 'general'] ?? 'General';

  // ── Poll hero header ──────────────────────────────────────────────────────

  const PollHeroHeader = () => {
    if (!discussion) return null;

    return (
      <View>
        {/* Hero image — black strip behind island, image starts below it */}
        <View style={[styles_.heroWrap, { height: HERO_HEIGHT + top, backgroundColor: '#000' }]}>
          {(localImageUrl || discussion.image_url || backdropUrl || discussion.content_poster) ? (
            <Image
              source={{ uri: (localImageUrl || discussion.image_url || backdropUrl || discussion.content_poster)! }}
              style={[styles_.heroImage, { marginTop: top }]}
              contentFit="cover" cachePolicy="memory-disk" recyclingKey={(localImageUrl || discussion.image_url || backdropUrl || discussion.content_poster)!} />
          ) : (
            <View style={[styles_.heroImage, { marginTop: top, backgroundColor: '#1A1028' }]} />
          )}

          {/* Gradient overlay */}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)', '#000']}
            locations={[0, 0.4, 0.75, 1]}
            style={StyleSheet.absoluteFill}
          />

          {/* Nav row overlaid on image */}
          <View style={[styles_.heroNav, { paddingTop: top + 8 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => router.back()} hitSlop={12} style={styles_.heroNavBtn} accessibilityRole="button" accessibilityLabel="Go back">
                <SymbolView name="chevron.left" size={18} tintColor="#fff" type="monochrome" style={{ width: 18, height: 18 }} />
              </Pressable>
              <View style={styles_.heroPollBadge}>
                <Text style={styles_.heroPollBadgeText}>{discussion?.is_quiz ? 'TRIVIA' : 'POLL'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable hitSlop={12} style={styles_.heroNavBtn} accessibilityRole="button" accessibilityLabel="Share">
                <SymbolView name="square.and.arrow.up" size={17} tintColor="#fff" type="monochrome" style={{ width: 17, height: 17 }} />
              </Pressable>
              {isOwner && (
                <Pressable onPress={showOwnerMenu} hitSlop={12} style={styles_.heroNavBtn} accessibilityRole="button" accessibilityLabel="More options">
                  <Text style={styles_.heroNavDots}>···</Text>
                </Pressable>
              )}
            </View>
          </View>

          {/* Title + show overlaid at bottom of image */}
          <View style={styles_.heroBottom}>
            {poll?.questions && poll.questions.length > 1 && (
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <ProgressCircle current={currentQuestion} total={poll.questions.length} />
              </View>
            )}
            <Text style={styles_.heroTitle}>{discussion.title}</Text>
            {discussion.content_title ? (
              <Text style={styles_.heroShowName}>{discussion.content_title}</Text>
            ) : null}
            {poll?.questions && poll.questions.length > 1 && (
              <Text style={styles_.heroQuestionOf}>Question {currentQuestion + 1} of {poll.questions.length}</Text>
            )}
          </View>
        </View>

        {/* White content area */}
        <View style={styles_.pollContent}>
          {/* Body text */}
          {discussion.body ? (
            <Text style={[styles_.pollBody, { color: 'rgba(255,255,255,0.75)' }]}>{discussion.body}</Text>
          ) : null}

          {/* Poll options */}
          {poll ? (
            <PollBlock
              poll={poll}
              Brand={Brand}
              currentQuestion={currentQuestion}
              onQuestionChange={(qi) => setCurrentQuestion(Math.max(0, Math.min(qi, (poll.questions?.length ?? 1) - 1)))}
              onVote={(optionIndex, questionIndex = 0) => {
                const alreadyVoted = poll.questions
                  ? (poll.questions[questionIndex]?.my_vote !== null)
                  : poll.my_vote !== null;
                if (alreadyVoted) return;
                voteOnPoll.mutate(
                  { pollId: poll.id, optionIndex, questionIndex, discussionId: id },
                  {
                    onError: (err) => Alert.alert('Error', `Could not save vote: ${(err as any)?.message ?? 'unknown error'}`),
                    onSuccess: () => {
                      const isQuiz = !!discussion?.is_quiz;
                      const totalQuestions = poll.questions?.length ?? 1;
                      const isLastQuestion = !poll.questions || questionIndex >= totalQuestions - 1;
                      track(user?.id, isQuiz ? Events.QUIZ_ANSWER_SUBMITTED : Events.POLL_VOTED, {
                        discussion_id: id,
                        poll_id: poll.id,
                        question_index: questionIndex,
                        option_index: optionIndex,
                      });
                      if (isQuiz && isLastQuestion) {
                        track(user?.id, Events.QUIZ_COMPLETED, {
                          discussion_id: id,
                          poll_id: poll.id,
                          total_questions: totalQuestions,
                        });
                      }
                      // Auto-advance to next unanswered question after a short delay
                      if (poll.questions && questionIndex < poll.questions.length - 1) {
                        setTimeout(() => setCurrentQuestion(questionIndex + 1), 600);
                      }
                    },
                  },
                );
              }}
            />
          ) : null}

          {/* Action bar */}
          <View style={styles_.pollActionBar}>
            {/* Emoji reaction */}
            <Pressable style={styles_.pollActionPill} onPress={showEmojiPicker} hitSlop={6} accessibilityRole="button" accessibilityLabel="Add reaction">
              <Text style={styles_.pollActionEmoji}>
                {reactions?.mine && reactions.mine.size > 0 ? [...reactions.mine][0] : '🔥'}
              </Text>
              <Text style={styles_.pollActionCount}>
                {Object.values(reactions?.counts ?? {}).reduce((a, b) => a + b, 0) || discussion.upvote_count}
              </Text>
            </Pressable>
            {/* Upvote */}
            <Pressable
              style={[styles_.pollActionPill, discussion.has_voted && !discussion.has_disagreed && { backgroundColor: '#4F46E5' }]}
              onPress={() => vote.mutate({ discussionId: discussion.id, hasVoted: discussion.has_voted, hasDisagreed: discussion.has_disagreed })}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={discussion.has_voted && !discussion.has_disagreed ? 'Remove upvote' : 'Upvote'}>
              <Text style={{ fontSize: 14 }}>👍</Text>
              {discussion.upvote_count > 0 && (
                <Text style={[styles_.pollActionCount, discussion.has_voted && !discussion.has_disagreed && { color: '#fff' }]}>{discussion.upvote_count}</Text>
              )}
            </Pressable>
            {/* Disagree */}
            <Pressable
              style={[styles_.pollActionPill, discussion.has_disagreed && { backgroundColor: '#991B1B' }]}
              onPress={() => disagree.mutate({ discussionId: discussion.id, hasDisagreed: discussion.has_disagreed, hasVoted: discussion.has_voted })}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={discussion.has_disagreed ? 'Remove disagree' : 'Disagree'}>
              <Text style={{ fontSize: 14 }}>👎</Text>
              {discussion.disagree_count > 0 && (
                <Text style={[styles_.pollActionCount, discussion.has_disagreed && { color: '#fff' }]}>{discussion.disagree_count}</Text>
              )}
            </Pressable>
            {/* Save */}
            <Pressable
              style={[styles_.pollActionPill, isSaved && { backgroundColor: Brand.trust }]}
              onPress={handleToggleSave}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save discussion'}>
              <SymbolView name={isSaved ? 'bookmark.fill' : 'bookmark'} size={15} tintColor={isSaved ? '#fff' : '#9CA3AF'} type="monochrome" style={{ width: 15, height: 15 }} />
            </Pressable>
            {/* Share */}
            <Pressable style={styles_.pollActionPill} onPress={handleShare} hitSlop={6} accessibilityRole="button" accessibilityLabel="Share discussion">
              <SymbolView name="arrowshape.turn.up.right" size={15} tintColor="#9CA3AF" type="monochrome" style={{ width: 15, height: 15 }} />
            </Pressable>
          </View>
        </View>

        {/* Comments toggle row — above the sort tabs */}
        <Pressable
          style={[styles_.pollCommentsToggle, { backgroundColor: showComments ? Brand.paper : '#111' }]}
          onPress={() => setShowComments(v => !v)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={showComments ? 'Hide comments' : `Show comments (${comments.length})`}>
          <SymbolView name="bubble.left" size={15} tintColor={showComments ? Brand.trust : '#9CA3AF'} type="monochrome" style={{ width: 15, height: 15 }} />
          <Text style={[styles_.pollCommentsToggleText, { color: showComments ? Brand.trust : '#9CA3AF' }]}>
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
          <SymbolView
            name={showComments ? 'chevron.up' : 'chevron.down'}
            size={12} tintColor={showComments ? Brand.trust : '#9CA3AF'} type="monochrome"
            style={{ width: 12, height: 12, marginLeft: 'auto' }}
          />
        </Pressable>

        {/* Sort tabs — only when comments expanded */}
        {showComments && (
          <View style={[styles_.sortBar, { borderBottomColor: Brand.border, borderTopColor: Brand.border }]}>
            {(['popular', 'recent', 'oldest'] as SortMode[]).map((s) => (
              <Pressable key={s} onPress={() => setSort(s)} style={styles_.sortTab} hitSlop={6} accessibilityRole="button" accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}>
                <Text style={[styles_.sortLabel, { color: sort === s ? Brand.trust : Brand.muted }]}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </Text>
                {sort === s && <View style={[styles_.sortUnderline, { backgroundColor: Brand.trust }]} />}
              </Pressable>
            ))}
          </View>
        )}
      </View>
    );
  };

  // ── Regular discussion header ─────────────────────────────────────────────

  const RegularHeader = () => {
    if (!discussion) return null;

    return (
      <View>
        {/* Nav bar */}
        <View style={[styles_.navBar, { borderBottomColor: Brand.border }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles_.navBack} accessibilityRole="button" accessibilityLabel="Go back">
            <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" style={{ width: 20, height: 20 }} />
          </Pressable>
          <Text style={[styles_.navTitle, { color: Brand.ink }]}>Discussion</Text>
          {isOwner ? (
            <Pressable onPress={showOwnerMenu} hitSlop={12} style={styles_.navMore} accessibilityRole="button" accessibilityLabel="More options">
              <Text style={[styles_.navDots, { color: Brand.ink }]}>···</Text>
            </Pressable>
          ) : (
            <View style={styles_.navMore} />
          )}
        </View>

        <View style={styles_.discussionBlock}>
          {discussion.content_title && discussion.content_external_id ? (
            <Pressable
              onPress={() => router.push({
                pathname: '/content-room-modal',
                params: {
                  externalId: discussion.content_external_id!,
                  mediaType: discussion.content_media_type ?? '',
                  title: discussion.content_title!,
                  poster: discussion.content_poster ?? '',
                },
              })}
              hitSlop={6}>
              <Text style={[styles_.contentShowName, { color: Brand.trust }]} numberOfLines={1}>
                {discussion.content_title}
              </Text>
            </Pressable>
          ) : (
            <View style={[styles_.typePill, { backgroundColor: typeColor.bg }]}>
              <Text style={[styles_.typeText, { color: typeColor.color }]}>{typeLabel.toUpperCase()}</Text>
            </View>
          )}

          {editing ? (
            <TextInput
              style={[styles_.titleInput, { color: Brand.ink, borderColor: Brand.border, backgroundColor: Brand.card }]}
              value={editTitle}
              onChangeText={setEditTitle}
              multiline maxLength={300} autoFocus
            />
          ) : (
            <Text style={[styles_.title, { color: Brand.ink }]}>{discussion.title}</Text>
          )}

          <Pressable
            style={styles_.authorRow}
            onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: discussion.user_id } })}
            hitSlop={6}>
            <Avatar avatarUrl={discussion.author_avatar} name={discussion.author_name} size={28} />
            <Text style={[styles_.authorName, { color: Brand.ink }]}>{discussion.author_name}</Text>
            {!!discussion.author_verified_tier && <VerifiedBadge tier={discussion.author_verified_tier} size={13} />}
            <View style={[styles_.opBadge, { backgroundColor: Brand.tlight }]}>
              <Text style={[styles_.opBadgeText, { color: Brand.trust }]}>OP</Text>
            </View>
            <Text style={[styles_.authorTime, { color: Brand.muted }]}>· {timeAgo(discussion.created_at)}</Text>
          </Pressable>

          {editing ? (
            <TextInput
              style={[styles_.bodyInput, { color: Brand.ink, borderColor: Brand.border, backgroundColor: Brand.card }]}
              value={editBody} onChangeText={setEditBody}
              multiline maxLength={10000}
              placeholder="Add more context… (optional)" placeholderTextColor={Brand.muted}
              textAlignVertical="top"
            />
          ) : discussion.body ? (
            <Text style={[styles_.body, { color: Brand.ink }]}>{discussion.body}</Text>
          ) : null}

          {/* Attached image — view mode */}
          {!editing && (localImageUrl || discussion.image_url) ? (
            <Image
              source={{ uri: (localImageUrl || discussion.image_url)! }}
              style={styles_.attachedImage}
              contentFit="cover" cachePolicy="memory-disk" recyclingKey={(localImageUrl || discussion.image_url)!} />
          ) : null}

          {/* Photo edit row — shown while editing */}
          {editing ? (
            <>
              {/* Show new local preview OR existing image (unless removed) */}
              {editImageUri ? (
                <View style={{ position: 'relative', marginTop: 8 }}>
                  <Image source={{ uri: editImageUri }} style={styles_.attachedImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={editImageUri} />
                  <Pressable
                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                    onPress={() => { setEditImageUri(null); setEditImageUrl(null); setLocalImageUrl(null); }}>
                    <SymbolView name="xmark" size={12} tintColor="#fff" type="monochrome" style={{ width: 12, height: 12 }} />
                  </Pressable>
                </View>
              ) : (discussion.image_url && editImageUrl !== null) ? (
                <View style={{ position: 'relative', marginTop: 8 }}>
                  <Image source={{ uri: discussion.image_url }} style={styles_.attachedImage} contentFit="cover" cachePolicy="memory-disk" recyclingKey={discussion.image_url} />
                  <Pressable
                    style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 14, padding: 4 }}
                    accessibilityRole="button"
                    accessibilityLabel="Remove image"
                    onPress={() => setEditImageUrl(null)}>
                    <SymbolView name="xmark" size={12} tintColor="#fff" type="monochrome" style={{ width: 12, height: 12 }} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={pickEditImage}
                  accessibilityRole="button"
                  accessibilityLabel="Add a photo"
                  style={{ borderWidth: 1.5, borderColor: Brand.border, borderStyle: 'dashed', borderRadius: 12, padding: 12, alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <SymbolView name="photo.badge.plus" size={18} tintColor={Brand.muted} type="monochrome" style={{ width: 18, height: 18 }} />
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted }}>Add a photo</Text>
                </Pressable>
              )}

              <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end', marginTop: 10 }}>
                <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={saveEdit} disabled={updateDiscussion.isPending || editImageUploading || editTitle.trim().length < 3} hitSlop={8}>
                  {updateDiscussion.isPending || editImageUploading
                    ? <ActivityIndicator size="small" color={Brand.trust} />
                    : <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, opacity: editTitle.trim().length < 3 ? 0.4 : 1 }}>Save</Text>}
                </Pressable>
              </View>
            </>
          ) : null}

          {/* Action pills */}
          <View style={styles_.actionBar}>
            {/* Emoji reactions */}
            <Pressable style={styles_.actionPill} onPress={showEmojiPicker} hitSlop={6} accessibilityRole="button" accessibilityLabel="Add reaction">
              <Text style={{ fontSize: 14 }}>
                {reactions?.mine && reactions.mine.size > 0
                  ? [...reactions.mine][0]
                  : '✦'}
              </Text>
              <Text style={[styles_.actionPillText, { color: Brand.ink }]}>
                {Object.values(reactions?.counts ?? {}).reduce((a, b) => a + b, 0) || discussion.upvote_count}
              </Text>
            </Pressable>
            {/* Comments — scroll to input */}
            <Pressable
              style={styles_.actionPill}
              onPress={() => inputRef.current?.focus()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${comments.length} ${comments.length === 1 ? 'comment' : 'comments'}, tap to add a comment`}>
              <SymbolView name="bubble.left" size={15} tintColor={Brand.muted} type="monochrome" style={{ width: 15, height: 15 }} />
              <Text style={[styles_.actionPillText, { color: Brand.ink }]}>{comments.length}</Text>
            </Pressable>
            {/* Save */}
            <Pressable
              style={[styles_.actionPill, styles_.actionIconPill, isSaved && { backgroundColor: Brand.trust }]}
              onPress={handleToggleSave}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={isSaved ? 'Remove bookmark' : 'Save discussion'}>
              <SymbolView name={isSaved ? 'bookmark.fill' : 'bookmark'} size={15} tintColor={isSaved ? '#fff' : Brand.muted} type="monochrome" style={{ width: 15, height: 15 }} />
            </Pressable>
            {/* Share */}
            <Pressable style={[styles_.actionPill, styles_.actionIconPill]} onPress={handleShare} hitSlop={6} accessibilityRole="button" accessibilityLabel="Share discussion">
              <SymbolView name="square.and.arrow.up" size={15} tintColor={Brand.muted} type="monochrome" style={{ width: 15, height: 15 }} />
            </Pressable>
          </View>
        </View>

        {/* Sort tabs */}
        <View style={[styles_.sortBar, { borderBottomColor: Brand.border, borderTopColor: Brand.border }]}>
          {(['popular', 'recent', 'oldest'] as SortMode[]).map((s) => (
            <Pressable key={s} onPress={() => setSort(s)} style={styles_.sortTab} hitSlop={6} accessibilityRole="button" accessibilityLabel={s.charAt(0).toUpperCase() + s.slice(1)}>
              <Text style={[styles_.sortLabel, { color: sort === s ? Brand.trust : Brand.muted }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
              {sort === s && <View style={[styles_.sortUnderline, { backgroundColor: Brand.trust }]} />}
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={[styles_.safe, { backgroundColor: isPollDiscussion ? '#000' : Brand.paper }]}
      edges={isPollDiscussion ? [] : ['top']}>
      {/* For poll view — nav is overlaid on the hero, so no separate bar */}
      {!isPollDiscussion && null}

      <View style={{ flex: 1 }}>
        {dLoading ? (
          <ActivityIndicator style={{ marginTop: 80 }} color={Brand.trust} />
        ) : (
          <FlatList
            data={isPollDiscussion && !showComments ? [] : flatItems}
            keyExtractor={(item) => item.parentId?.startsWith('__') ? item.parentId : item.comment.id}
            style={isPollDiscussion && showComments ? { backgroundColor: Brand.paper } : undefined}
            ListHeaderComponent={isPollDiscussion ? PollHeroHeader : RegularHeader}
            renderItem={({ item }) => {
              if (item.parentId?.startsWith('__collapse__') || item.parentId?.startsWith('__expand__')) {
                const threadId = item.comment.id;
                const isExpanding = item.parentId!.startsWith('__expand__');
                const hidden = item.hiddenCount ?? 0;
                return (
                  <Pressable
                    style={[styles_.viewMoreRow, { borderTopColor: Brand.border }]}
                    onPress={() => {
                      setCollapsedThreads((prev) => {
                        const next = new Set(prev);
                        if (isExpanding) next.delete(threadId);
                        else next.add(threadId);
                        return next;
                      });
                    }}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={isExpanding ? `View ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}` : 'Collapse replies'}>
                    <Text style={[styles_.viewMoreText, { color: Brand.trust }]}>
                      {isExpanding ? `View ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}` : 'Collapse replies'}
                    </Text>
                  </Pressable>
                );
              }
              return (
                <CommentRow
                  comment={item.comment}
                  isReply={item.isReply}
                  onReply={handleReply}
                  onDelete={handleDeleteComment}
                  opUserId={discussion?.user_id ?? ''}
                  Brand={Brand}
                />
              );
            }}
            ListEmptyComponent={
              (isPollDiscussion && !showComments) ? null :
              cLoading
                ? <ActivityIndicator style={{ margin: 20 }} color={Brand.trust} />
                : <Text style={[styles_.emptyText, { color: Brand.muted }]}>No comments yet. Be the first!</Text>
            }
            contentContainerStyle={{ paddingBottom: 80 + (bottom || 0) }}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {replyTo && (!isPollDiscussion || showComments) && (
          <View style={[styles_.replyBanner, { backgroundColor: Brand.tlight, borderTopColor: Brand.border }]}>
            <Text style={[styles_.replyBannerText, { color: Brand.trust }]} numberOfLines={1}>
              Replying to {replyTo.author_name}
            </Text>
            <Pressable onPress={() => { setReplyTo(null); setText(''); }} hitSlop={8} accessibilityRole="button" accessibilityLabel="Cancel reply">
              <SymbolView name="xmark" size={14} tintColor={Brand.muted} type="monochrome" style={{ width: 14, height: 14 }} />
            </Pressable>
          </View>
        )}

        {/* Mention picker */}
        {mentionResults.length > 0 && (
          <View style={[styles_.mentionList, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
            {mentionResults.map((profile) => (
              <Pressable
                key={profile.id}
                style={[styles_.mentionRow, { borderBottomColor: Brand.border }]}
                onPress={() => insertMention(profile.username)}>
                <Avatar avatarUrl={profile.avatar_url} name={profile.full_name || profile.username} size={28} />
                <View>
                  <Text style={[styles_.mentionUsername, { color: Brand.ink }]}>@{profile.username}</Text>
                  {profile.full_name ? (
                    <Text style={[styles_.mentionName, { color: Brand.muted }]}>{profile.full_name}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {(!isPollDiscussion || showComments || true) && (
        <View style={[styles_.inputBar, { borderTopColor: Brand.border, backgroundColor: Brand.paper, paddingBottom: kbHeight > 0 ? 8 : (bottom || 12), bottom: kbHeight }]}>
          <Avatar avatarUrl={user?.user_metadata?.avatar_url ?? null} name={user?.email ?? ''} size={32} />
          <TextInput
            ref={inputRef}
            style={[styles_.input, { backgroundColor: Brand.card, borderColor: Brand.border, color: Brand.ink }]}
            placeholder="Join the conversation…"
            placeholderTextColor={Brand.muted}
            value={text}
            onChangeText={handleTextChange}
            onFocus={() => { if (isPollDiscussion) setShowComments(true); }}
            multiline
            maxLength={5000}

          />
          {text.trim().length > 0 && (
            <Pressable
              onPress={() => setIsSpoiler((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={isSpoiler ? 'Remove spoiler tag' : 'Mark as spoiler'}
              style={[styles_.spoilerBtn, isSpoiler && { backgroundColor: Brand.tlight }]}>
              <SymbolView
                name={isSpoiler ? 'eye.slash.fill' : 'eye.slash'}
                size={16}
                tintColor={isSpoiler ? Brand.trust : Brand.muted}
                type="monochrome"
                style={{ width: 16, height: 16 }}
              />
            </Pressable>
          )}
          <Pressable onPress={handleSend} disabled={!text.trim() || addComment.isPending} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send comment">
            {addComment.isPending
              ? <ActivityIndicator color={Brand.trust} />
              : (
                <View style={[styles_.sendBtn, { backgroundColor: text.trim() ? Brand.trust : Brand.border }]}>
                  <SymbolView name="arrow.up" size={18} tintColor="#fff" type="monochrome" style={{ width: 18, height: 18 }} />
                </View>
              )}
          </Pressable>
        </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1 },

    // ── Poll hero ──
    heroWrap: { width: '100%', height: HERO_HEIGHT, position: 'relative' },
    heroImage: { width: '100%', flex: 1 },
    heroNav: {
      position: 'absolute',
      top: 0, left: 0, right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 10,
    },
    heroNavBtn: {
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: 'rgba(0,0,0,0.35)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroNavDots: { color: '#fff', fontFamily: BrandFonts.syneBold, fontSize: 18, letterSpacing: 1 },
    heroPollBadge: {
      backgroundColor: '#7C3AED',
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    heroPollBadgeText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      letterSpacing: 0.8,
      color: '#fff',
    },
    heroBottom: {
      position: 'absolute',
      bottom: 0, left: 0, right: 0,
      paddingHorizontal: 20,
      paddingBottom: 20,
      gap: 4,
    },
    heroTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 26,
      color: '#fff',
      lineHeight: 32,
    },
    heroShowName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#F59E0B',
    },
    heroQuestionOf: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: 'rgba(255,255,255,0.7)',
      marginTop: 6,
      textAlign: 'center',
    },

    // Poll content area
    pollContent: { backgroundColor: '#000', paddingTop: 20, gap: 0 },
    pollBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      lineHeight: 22,
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    // Poll action bar (dark)
    pollActionBar: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    pollActionPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: Brand.card,
      borderRadius: 50,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    pollActionIcon: { paddingHorizontal: 13 },
    pollCommentsToggle: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      paddingHorizontal: 20, paddingVertical: 14,
    },
    pollCommentsToggleText: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
    pollActionEmoji: { fontSize: 16 },
    pollActionCount: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#F9FAFB' },

    // ── Regular nav ──
    navBar: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: 16, paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    navBack: { width: 36, alignItems: 'flex-start' },
    navTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16 },
    navMore: { width: 36, alignItems: 'flex-end' },
    navDots: { fontFamily: BrandFonts.syneBold, fontSize: 18, letterSpacing: 1 },

    // ── Regular discussion ──
    discussionBlock: { padding: 16, gap: 12 },
    typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
    typeText: { fontFamily: BrandFonts.syneBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, lineHeight: 24 },
    titleInput: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, lineHeight: 26, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    body: { fontFamily: BrandFonts.interRegular, fontSize: 15.5, lineHeight: 23 },
    bodyInput: { fontFamily: BrandFonts.interRegular, fontSize: 15, lineHeight: 22, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 80 },
    contentCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
    contentCardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
    contentCardSub: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    contentCardPoster: { width: 44, height: 60, borderRadius: 8 },
    contentShowName: { fontFamily: BrandFonts.syneBold, fontSize: 20 },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    authorName: { fontFamily: BrandFonts.syneBold, fontSize: 13.5 },
    opBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
    opBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 10.5, letterSpacing: 0.3 },
    authorTime: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    actionBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
    actionPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Brand.border },
    actionIconPill: { paddingHorizontal: 12 },
    actionPillText: { fontFamily: BrandFonts.syneBold, fontSize: 14 },

    // ── Sort ──
    sortBar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, backgroundColor: Brand.paper },
    sortTab: { paddingVertical: 12, marginRight: 24, position: 'relative' },
    sortLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
    sortUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 1 },

    // ── Comments ──
    viewMoreRow: { paddingHorizontal: 46, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, backgroundColor: '#fff' },
    viewMoreText: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 14, textAlign: 'center', padding: 28, backgroundColor: '#fff' },

    // ── Reply banner ──
    mentionList: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 220 },
    mentionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
    mentionUsername: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
    mentionName: { fontFamily: BrandFonts.interRegular, fontSize: 11, marginTop: 1 },
    replyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
    replyBannerText: { fontFamily: BrandFonts.interMedium, fontSize: 13, flex: 1 },

    // ── Input ──
    inputBar: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
    input: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, fontFamily: BrandFonts.interRegular, fontSize: 14, maxHeight: 100 },
    spoilerBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    sendBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    attachedImage: { width: '100%', height: 220, borderRadius: 14, marginTop: 4 },
  });
}
