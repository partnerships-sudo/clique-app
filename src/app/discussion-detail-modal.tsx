import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import {
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
  useToggleDiscussionVote,
  useUpdateDiscussion,
  useVoteOnPoll,
} from '@/features/discussions/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

const TYPE_LABELS: Record<string, string> = {
  read: 'Books', watch: 'TV & Film', tv: 'TV & Film',
  play: 'Games', listen: 'Music', podcast: 'Podcasts', general: 'General',
};

// ── Comment component ────────────────────────────────────────────────────────

const commentStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowReply: { paddingLeft: 44 },
  replyLine: { position: 'absolute', left: 30, top: 0, bottom: 0, width: 1.5, opacity: 0.4 },
  body: { flex: 1, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  author: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
  time: { fontFamily: BrandFonts.interRegular, fontSize: 11 },
  text: { fontFamily: BrandFonts.interRegular, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 2 },
  btn: { fontFamily: BrandFonts.interMedium, fontSize: 12 },
});

function CommentRow({
  comment,
  isReply,
  onReply,
  onDelete,
  Brand,
}: {
  comment: DiscussionComment;
  isReply: boolean;
  onReply: (comment: DiscussionComment) => void;
  onDelete: (comment: DiscussionComment) => void;
  Brand: BrandPalette;
}) {
  const { user } = useSession();
  const isOwn = user?.id === comment.user_id;

  return (
    <View style={[commentStyles.row, isReply && commentStyles.rowReply, { borderColor: Brand.border }]}>
      {isReply && <View style={[commentStyles.replyLine, { backgroundColor: Brand.border }]} />}
      <Avatar avatarUrl={comment.author_avatar} name={comment.author_name} size={28} />
      <View style={commentStyles.body}>
        <View style={commentStyles.header}>
          <Text style={[commentStyles.author, { color: Brand.ink }]}>{comment.author_name}</Text>
          <Text style={[commentStyles.time, { color: Brand.muted }]}>{timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={[commentStyles.text, { color: Brand.ink }]}>{comment.body}</Text>
        <View style={commentStyles.actions}>
          <Pressable onPress={() => onReply(comment)} hitSlop={8}>
            <Text style={[commentStyles.btn, { color: Brand.muted }]}>Reply</Text>
          </Pressable>
          {isOwn && (
            <Pressable onPress={() => onDelete(comment)} hitSlop={8}>
              <Text style={[commentStyles.btn, { color: '#EF4444' }]}>Delete</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ── Poll block ───────────────────────────────────────────────────────────────

function PollBlock({ poll, onVote, Brand }: { poll: DiscussionPoll; onVote: (optionIndex: number) => void; Brand: import('@/constants/theme').BrandPalette }) {
  const voted = poll.my_vote !== null;
  const total = poll.total_votes;

  return (
    <View style={[pollStyles.card, { borderColor: Brand.border, backgroundColor: Brand.card }]}>
      <Text style={[pollStyles.question, { color: Brand.ink }]}>{poll.question}</Text>
      {poll.options.map((opt, i) => {
        const count = poll.vote_counts[i] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMyVote = poll.my_vote === i;
        return (
          <Pressable
            key={i}
            disabled={voted}
            onPress={() => onVote(i)}
            style={[
              pollStyles.optionBtn,
              { borderColor: isMyVote ? Brand.trust : Brand.border, backgroundColor: Brand.paper },
            ]}>
            {/* Fill bar shown after voting */}
            {voted && (
              <View
                style={[
                  pollStyles.fill,
                  { width: `${pct}%` as any, backgroundColor: isMyVote ? Brand.tlight : Brand.card },
                ]}
              />
            )}
            <Text style={[pollStyles.optionText, { color: isMyVote ? Brand.trust : Brand.ink }]} numberOfLines={2}>
              {opt}
            </Text>
            {voted && (
              <Text style={[pollStyles.pct, { color: isMyVote ? Brand.trust : Brand.muted }]}>{pct}%</Text>
            )}
          </Pressable>
        );
      })}
      <Text style={[pollStyles.meta, { color: Brand.muted }]}>
        {total} {total === 1 ? 'vote' : 'votes'}{voted ? ' · tap to see results' : ' · tap to vote'}
      </Text>
    </View>
  );
}

const pollStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 12, gap: 8 },
  question: { fontFamily: BrandFonts.syneBold, fontSize: 15, marginBottom: 4 },
  optionBtn: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  fill: { position: 'absolute', top: 0, left: 0, bottom: 0, borderRadius: 8 },
  optionText: { fontFamily: BrandFonts.interMedium, fontSize: 14, flex: 1 },
  pct: { fontFamily: BrandFonts.syneBold, fontSize: 13, marginLeft: 8 },
  meta: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, marginTop: 2 },
});

// ── Main screen ──────────────────────────────────────────────────────────────

export default function DiscussionDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles_ = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { bottom } = useSafeAreaInsets();

  const { data: discussion, isLoading: dLoading } = useDiscussion(id);
  const { data: comments = [], isLoading: cLoading } = useDiscussionComments(id);
  const { data: poll } = useDiscussionPoll(id);
  const vote = useToggleDiscussionVote();
  const voteOnPoll = useVoteOnPoll();
  const updateDiscussion = useUpdateDiscussion();
  const addComment = useAddDiscussionComment();
  const deleteDiscussion = useDeleteDiscussion();
  const deleteComment = useDeleteDiscussionComment();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<DiscussionComment | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Inline edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');

  function startEdit() {
    if (!discussion) return;
    setEditTitle(discussion.title);
    setEditBody(discussion.body ?? '');
    setEditing(true);
  }

  async function saveEdit() {
    if (!discussion || editTitle.trim().length < 3) return;
    try {
      await updateDiscussion.mutateAsync({ id: discussion.id, title: editTitle, body: editBody || null });
      setEditing(false);
    } catch {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    }
  }

  // Build flat list: top-level + their replies grouped together
  const flatItems = useMemo(() => {
    const topLevel = comments.filter((c) => !c.parent_id);
    const repliesMap = new Map<string, DiscussionComment[]>();
    for (const c of comments) {
      if (c.parent_id) {
        const arr = repliesMap.get(c.parent_id) ?? [];
        arr.push(c);
        repliesMap.set(c.parent_id, arr);
      }
    }
    const result: { comment: DiscussionComment; isReply: boolean }[] = [];
    for (const top of topLevel) {
      result.push({ comment: top, isReply: false });
      for (const reply of repliesMap.get(top.id) ?? []) {
        result.push({ comment: reply, isReply: true });
      }
    }
    return result;
  }, [comments]);

  function handleReply(comment: DiscussionComment) {
    setReplyTo(comment);
    inputRef.current?.focus();
  }

  function handleCancelReply() {
    setReplyTo(null);
    setText('');
  }

  async function handleSend() {
    if (!text.trim() || !id) return;
    try {
      await addComment.mutateAsync({ discussionId: id, body: text.trim(), parentId: replyTo?.id });
      setText('');
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
          await deleteComment.mutateAsync({ id: comment.id, discussionId: comment.discussion_id });
        },
      },
    ]);
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
            Alert.alert('Error', `Could not delete discussion: ${err?.message ?? 'Unknown error'}`);
          }
        },
      },
    ]);
  }

  const typeColor = (TypeColors as any)[discussion?.type ?? 'general'] ?? { color: '#6B7280', bg: '#F3F4F6' };
  const typeLabel = TYPE_LABELS[discussion?.type ?? 'general'] ?? 'General';

  // Header rendered inside FlatList for scrolling continuity
  const ListHeader = () => {
    if (!discussion) return null;
    const isOwn = user?.id === discussion.user_id;

    return (
      <View style={styles_.discussionHeader}>
        {/* Type + edit + delete */}
        <View style={styles_.headerTopRow}>
          <View style={[styles_.typePill, { backgroundColor: typeColor.bg }]}>
            <Text style={[styles_.typeText, { color: typeColor.color }]}>{typeLabel.toUpperCase()}</Text>
          </View>
          {isOwn && !editing && (
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <Pressable onPress={startEdit} hitSlop={8}>
                <SymbolView name="pencil" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16 }} />
              </Pressable>
              <Pressable onPress={handleDeleteDiscussion} hitSlop={8}>
                <SymbolView name="trash" size={16} tintColor="#EF4444" type="monochrome" style={{ width: 16, height: 16 }} />
              </Pressable>
            </View>
          )}
          {isOwn && editing && (
            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted }}>Cancel</Text>
              </Pressable>
              <Pressable onPress={saveEdit} disabled={updateDiscussion.isPending || editTitle.trim().length < 3} hitSlop={8}>
                {updateDiscussion.isPending
                  ? <ActivityIndicator size="small" color={Brand.trust} />
                  : <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, opacity: editTitle.trim().length < 3 ? 0.4 : 1 }}>Save</Text>}
              </Pressable>
            </View>
          )}
        </View>

        {/* Title */}
        {editing ? (
          <TextInput
            style={[styles_.discussionTitle, styles_.editInput, { color: Brand.ink, borderColor: Brand.border, backgroundColor: Brand.card }]}
            value={editTitle}
            onChangeText={setEditTitle}
            multiline
            maxLength={300}
            autoFocus
          />
        ) : (
          <Text style={[styles_.discussionTitle, { color: Brand.ink }]}>{discussion.title}</Text>
        )}

        {/* Body */}
        {editing ? (
          <TextInput
            style={[styles_.discussionBody, styles_.editInput, { color: Brand.ink, borderColor: Brand.border, backgroundColor: Brand.card, minHeight: 80 }]}
            value={editBody}
            onChangeText={setEditBody}
            multiline
            maxLength={10000}
            placeholder="Add more context… (optional)"
            placeholderTextColor={Brand.muted}
            textAlignVertical="top"
          />
        ) : discussion.body ? (
          <Text style={[styles_.discussionBody, { color: Brand.ink }]}>{discussion.body}</Text>
        ) : null}

        {/* Linked content — taps into content room */}
        {discussion.content_title && discussion.content_external_id && (
          <Pressable
            style={[styles_.linkedContent, { backgroundColor: Brand.tlight, borderColor: Brand.border }]}
            onPress={() => router.push({
              pathname: '/content-room-modal',
              params: {
                externalId: discussion.content_external_id!,
                mediaType: discussion.content_media_type ?? '',
                title: discussion.content_title!,
                poster: discussion.content_poster ?? '',
              },
            })}>
            {discussion.content_poster ? (
              <Image source={{ uri: discussion.content_poster }} style={styles_.linkedPoster} resizeMode="cover" />
            ) : null}
            <Text style={[styles_.linkedTitle, { color: Brand.trust }]} numberOfLines={1}>
              🔗 {discussion.content_title}
            </Text>
          </Pressable>
        )}

        {/* Poll */}
        {poll ? (
          <PollBlock
            poll={poll}
            Brand={Brand}
            onVote={(optionIndex) => {
              if (poll.my_vote !== null) return;
              voteOnPoll.mutate(
                { pollId: poll.id, optionIndex, discussionId: id },
                { onError: (err) => Alert.alert('Error', `Could not save vote: ${(err as any)?.message ?? 'unknown error'}`) },
              );
            }}
          />
        ) : null}

        {/* Author row + vote */}
        <View style={styles_.authorRow}>
          <Pressable
            style={styles_.authorPressable}
            onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: discussion.user_id } })}
            hitSlop={6}>
            <Avatar avatarUrl={discussion.author_avatar} name={discussion.author_name} size={22} />
            <Text style={[styles_.authorText, { color: Brand.muted }]}>
              @{discussion.author_name} · {timeAgo(discussion.created_at)}
            </Text>
          </Pressable>
          <Pressable
            style={styles_.voteBtn}
            onPress={() => vote.mutate({ discussionId: discussion.id, hasVoted: discussion.has_voted })}
            hitSlop={8}>
            <SymbolView
              name={discussion.has_voted ? 'arrow.up.circle.fill' : 'arrow.up.circle'}
              size={18}
              tintColor={discussion.has_voted ? Brand.trust : Brand.muted}
              type="monochrome"
              style={{ width: 18, height: 18 }}
            />
            <Text style={[styles_.voteCount, { color: discussion.has_voted ? Brand.trust : Brand.muted }]}>
              {discussion.upvote_count}
            </Text>
          </Pressable>
        </View>

        {/* Comments divider */}
        <View style={[styles_.divider, { backgroundColor: Brand.border }]} />
        <Text style={[styles_.commentsHeading, { color: Brand.ink }]}>
          {discussion.comment_count} {discussion.comment_count === 1 ? 'Comment' : 'Comments'}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles_.safe, { backgroundColor: Brand.paper }]} edges={['top']}>
      {/* Nav bar */}
      <View style={[styles_.navBar, { borderBottomColor: Brand.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles_.backBtn}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
          <Text style={[styles_.backText, { color: Brand.trust }]}>Back</Text>
        </Pressable>
        <Text style={[styles_.navTitle, { color: Brand.ink }]}>Discussion</Text>
        <View style={{ width: 60 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {dLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} color={Brand.trust} />
        ) : (
          <FlatList
            data={flatItems}
            keyExtractor={(item) => item.comment.id}
            ListHeaderComponent={ListHeader}
            renderItem={({ item }) => (
              <CommentRow
                comment={item.comment}
                isReply={item.isReply}
                onReply={handleReply}
                onDelete={handleDeleteComment}
                Brand={Brand}
              />
            )}
            ListEmptyComponent={
              cLoading ? <ActivityIndicator style={{ margin: 20 }} color={Brand.trust} /> : (
                <Text style={[styles_.emptyComments, { color: Brand.muted }]}>
                  No comments yet. Be the first!
                </Text>
              )
            }
            contentContainerStyle={styles_.listContent}
            keyboardShouldPersistTaps="handled"
          />
        )}

        {/* Reply banner */}
        {replyTo && (
          <View style={[styles_.replyBanner, { backgroundColor: Brand.tlight, borderTopColor: Brand.border }]}>
            <Text style={[styles_.replyBannerText, { color: Brand.trust }]} numberOfLines={1}>
              Replying to {replyTo.author_name}
            </Text>
            <Pressable onPress={handleCancelReply} hitSlop={8}>
              <SymbolView name="xmark" size={14} tintColor={Brand.muted} type="monochrome" style={{ width: 14, height: 14 }} />
            </Pressable>
          </View>
        )}

        {/* Comment input */}
        <View style={[styles_.inputBar, { borderTopColor: Brand.border, backgroundColor: Brand.paper, paddingBottom: bottom || 12 }]}>
          <TextInput
            ref={inputRef}
            style={[styles_.input, { backgroundColor: Brand.card, borderColor: Brand.border, color: Brand.ink }]}
            placeholder="Add a comment…"
            placeholderTextColor={Brand.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={5000}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim() || addComment.isPending}
            hitSlop={8}>
            {addComment.isPending
              ? <ActivityIndicator color={Brand.trust} />
              : (
                <SymbolView
                  name="arrow.up.circle.fill"
                  size={32}
                  tintColor={text.trim() ? Brand.trust : Brand.border}
                  type="monochrome"
                  style={{ width: 32, height: 32 }}
                />
              )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1 },
    navBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
    backText: { fontFamily: BrandFonts.interMedium, fontSize: 15 },
    navTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16 },
    listContent: { paddingBottom: 20 },

    discussionHeader: { padding: 16, gap: 10 },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
    typeText: { fontFamily: BrandFonts.interMedium, fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase' },
    discussionTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, lineHeight: 26 },
    discussionBody: { fontFamily: BrandFonts.interRegular, fontSize: 15, lineHeight: 22 },
    editInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    linkedContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: 12,
      padding: 10,
    },
    linkedPoster: { width: 32, height: 44, borderRadius: 6 },
    linkedTitle: { fontFamily: BrandFonts.interMedium, fontSize: 13, flex: 1 },
    authorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    authorPressable: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    authorText: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    voteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    voteCount: { fontFamily: BrandFonts.syneBold, fontSize: 14 },
    divider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
    commentsHeading: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15 },
    emptyComments: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      textAlign: 'center',
      padding: 24,
    },

    commentRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    commentRowReply: { paddingLeft: 44 },
    replyLine: { position: 'absolute', left: 30, top: 0, bottom: 0, width: 1.5, opacity: 0.4 },
    commentBody: { flex: 1, gap: 4 },
    commentHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    commentAuthor: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
    commentTime: { fontFamily: BrandFonts.interRegular, fontSize: 11 },
    commentText: { fontFamily: BrandFonts.interRegular, fontSize: 14, lineHeight: 20 },
    commentActions: { flexDirection: 'row', gap: 12, marginTop: 2 },
    replyBtn: { fontFamily: BrandFonts.interMedium, fontSize: 12 },

    replyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    replyBannerText: { fontFamily: BrandFonts.interMedium, fontSize: 13, flex: 1 },

    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 20,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      maxHeight: 100,
    },
  });
}
