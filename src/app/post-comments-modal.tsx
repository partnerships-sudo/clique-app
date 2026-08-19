import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  useAddComment,
  useCommentReplies,
  useDeleteComment,
  usePostComments,
  useToggleCommentUpvote,
  type PostComment,
} from '@/features/comments/api';
import { timeAgo } from '@/features/feed/time-ago';
import { QueryErrorState } from '@/components/query-error-state';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

function ReplyThread({
  comment,
  currentUserId,
  postId,
  onReply,
  styles,
  Brand,
}: {
  comment: PostComment;
  currentUserId: string | undefined;
  postId: string;
  onReply: (username: string, parentId: string) => void;
  styles: ReturnType<typeof createStyles>;
  Brand: BrandPalette;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: replies = [], isLoading } = useCommentReplies(comment.id, expanded);
  const upvote = useToggleCommentUpvote();
  const deleteComment = useDeleteComment();

  function confirmDelete(c: PostComment) {
    Alert.alert('Delete comment?', c.content.slice(0, 60), [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteComment.mutate({ commentId: c.id, postId }, {
          onError: () => Alert.alert('Could not delete', 'Check your connection and try again.'),
        }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <>
      {replies.map((reply) => (
        <View key={reply.id} style={styles.replyRow}>
          <View style={styles.replyLine} />
          <View style={styles.commentInner}>
            <Pressable
              onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: reply.user_id } })}
              style={styles.commentAvatarWrap}
              accessibilityRole="button"
              accessibilityLabel={`View ${reply.user_name}'s profile`}>
              <Avatar name={reply.user_name} avatarUrl={reply.user_avatar_url} size={28} />
            </Pressable>
            <View style={styles.commentBubble}>
              <View style={styles.commentMeta}>
                <Text style={styles.commentUser}>@{reply.user_name}</Text>
                <Text style={styles.commentTime}>{timeAgo(reply.created_at)}</Text>
              </View>
              <Text style={styles.commentContent}>{reply.content}</Text>
              <View style={styles.commentActions}>
                <Pressable
                  hitSlop={8}
                  onPress={() =>
                    upvote.mutate({ commentId: reply.id, didUpvote: reply.did_upvote, postId, parentId: reply.parent_id }, {
                      onError: () => Alert.alert('Could not update', 'Check your connection and try again.'),
                    })
                  }
                  style={styles.upvoteBtn}
                  accessibilityRole="button"
                  accessibilityLabel={reply.did_upvote ? 'Unlike comment' : 'Like comment'}>
                  <SymbolView
                    name={reply.did_upvote ? 'heart.fill' : 'heart'}
                    size={13}
                    tintColor={reply.did_upvote ? '#e05' : Brand.muted}
                  />
                  {reply.upvote_count > 0 && (
                    <Text style={[styles.upvoteCount, reply.did_upvote && styles.upvoteCountActive]}>
                      {reply.upvote_count}
                    </Text>
                  )}
                </Pressable>
                <Pressable hitSlop={8} onPress={() => onReply(reply.user_name, comment.id)} accessibilityRole="button" accessibilityLabel={`Reply to ${reply.user_name}`}>
                  <Text style={styles.replyBtn}>Reply</Text>
                </Pressable>
                {reply.user_id === currentUserId && (
                  <Pressable hitSlop={8} onPress={() => confirmDelete(reply)}>
                    <Text style={styles.deleteBtn}>Delete</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </View>
        </View>
      ))}
      {comment.reply_count > 0 && !expanded && (
        <Pressable style={styles.viewRepliesBtn} onPress={() => setExpanded(true)} accessibilityRole="button" accessibilityLabel={`View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}>
          <View style={styles.viewRepliesLine} />
          <Text style={styles.viewRepliesText}>
            {isLoading ? 'Loading…' : `View ${comment.reply_count} ${comment.reply_count === 1 ? 'reply' : 'replies'}`}
          </Text>
        </Pressable>
      )}
      {expanded && comment.reply_count > 0 && isLoading && (
        <ActivityIndicator size="small" color={Brand.trust} style={{ marginLeft: 52, marginTop: 4 }} />
      )}
    </>
  );
}

function CommentRow({
  comment,
  currentUserId,
  postId,
  onReply,
  styles,
  Brand,
}: {
  comment: PostComment;
  currentUserId: string | undefined;
  postId: string;
  onReply: (username: string, parentId: string) => void;
  styles: ReturnType<typeof createStyles>;
  Brand: BrandPalette;
}) {
  const upvote = useToggleCommentUpvote();
  const deleteComment = useDeleteComment();

  function confirmDelete() {
    Alert.alert('Delete comment?', comment.content.slice(0, 60), [
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteComment.mutate({ commentId: comment.id, postId }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.commentRow}>
      <View style={styles.commentInner}>
        <Pressable
          onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: comment.user_id } })}
          style={styles.commentAvatarWrap}
          accessibilityRole="button"
          accessibilityLabel={`View ${comment.user_name}'s profile`}>
          <Avatar name={comment.user_name} avatarUrl={comment.user_avatar_url} size={36} />
        </Pressable>
        <View style={styles.commentBubble}>
          <View style={styles.commentMeta}>
            <Text style={styles.commentUser}>@{comment.user_name}</Text>
            <Text style={styles.commentTime}>{timeAgo(comment.created_at)}</Text>
          </View>
          <Text style={styles.commentContent}>{comment.content}</Text>
          <View style={styles.commentActions}>
            <Pressable
              hitSlop={8}
              onPress={() =>
                upvote.mutate({ commentId: comment.id, didUpvote: comment.did_upvote, postId, parentId: null }, {
                  onError: () => Alert.alert('Could not update', 'Check your connection and try again.'),
                })
              }
              style={styles.upvoteBtn}
              accessibilityRole="button"
              accessibilityLabel={comment.did_upvote ? 'Unlike comment' : 'Like comment'}>
              <SymbolView
                name={comment.did_upvote ? 'heart.fill' : 'heart'}
                size={13}
                tintColor={comment.did_upvote ? '#e05' : Brand.muted}
              />
              {comment.upvote_count > 0 && (
                <Text style={[styles.upvoteCount, comment.did_upvote && styles.upvoteCountActive]}>
                  {comment.upvote_count}
                </Text>
              )}
            </Pressable>
            <Pressable hitSlop={8} onPress={() => onReply(comment.user_name, comment.id)} accessibilityRole="button" accessibilityLabel={`Reply to ${comment.user_name}`}>
              <Text style={styles.replyBtn}>Reply</Text>
            </Pressable>
            {comment.user_id === currentUserId && (
              <Pressable hitSlop={8} onPress={confirmDelete}>
                <Text style={styles.deleteBtn}>Delete</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
      <ReplyThread
        comment={comment}
        currentUserId={currentUserId}
        postId={postId}
        onReply={onReply}
        styles={styles}
        Brand={Brand}
      />
    </View>
  );
}

export default function PostCommentsModal() {
  const { postId, postTitle, postAuthorId, postPoster, postSub, postRating, postNote, postUserName, postUserAvatar } =
    useLocalSearchParams<{
      postId: string;
      postTitle: string;
      postAuthorId: string;
      postPoster?: string;
      postSub?: string;
      postRating?: string;
      postNote?: string;
      postUserName?: string;
      postUserAvatar?: string;
    }>();
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const { data: comments = [], isLoading, isError, refetch } = usePostComments(postId);
  const addComment = useAddComment();

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ username: string; parentId: string } | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleReply = useCallback((username: string, parentId: string) => {
    setReplyTo({ username, parentId });
    setText(`@${username} `);
    inputRef.current?.focus();
  }, []);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await addComment.mutateAsync({
        postId,
        content: trimmed,
        parentId: replyTo?.parentId,
      });
      setText('');
      setReplyTo(null);
    } catch {
      Alert.alert('Could not post comment', 'Please check your connection and try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Post context card */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>Comments</Text>
          <View style={styles.postCard}>
            {postPoster ? (
              <Image source={{ uri: postPoster }} style={styles.postPoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={postPoster} />
            ) : null}
            <View style={styles.postInfo}>
              {postUserName ? (
                <View style={styles.postAuthorRow}>
                  {postUserAvatar ? (
                    <Image source={{ uri: postUserAvatar }} style={styles.postAvatar} cachePolicy="memory-disk" recyclingKey={postUserAvatar} />
                  ) : null}
                  <Text style={styles.postAuthor}>@{postUserName}</Text>
                </View>
              ) : null}
              <Text style={styles.postTitle} numberOfLines={1}>{postTitle}</Text>
              {postSub ? <Text style={styles.postSub} numberOfLines={1}>{postSub}</Text> : null}
              {postRating ? (
                <Text style={styles.postRating}>{'★'.repeat(Math.round(Number(postRating)))}{'☆'.repeat(5 - Math.round(Number(postRating)))}</Text>
              ) : null}
              {postNote ? <Text style={styles.postNote} numberOfLines={2}>&ldquo;{postNote}&rdquo;</Text> : null}
            </View>
          </View>
        </View>

        {/* Input bar — top */}
        <View style={styles.inputBar}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Add a comment…"
            placeholderTextColor={Brand.muted}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            returnKeyType="default"
          />
          <Pressable
            onPress={submit}
            disabled={!text.trim() || addComment.isPending}
            hitSlop={8}
            style={[styles.sendBtn, (!text.trim() || addComment.isPending) && styles.sendBtnDisabled]}>
            {addComment.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.sendBtnText}>Post</Text>
            )}
          </Pressable>
        </View>

        {/* Reply context pill */}
        {replyTo && (
          <View style={styles.replyContext}>
            <Text style={styles.replyContextText}>Replying to @{replyTo.username}</Text>
            <Pressable hitSlop={8} onPress={() => { setReplyTo(null); setText(''); }} accessibilityRole="button" accessibilityLabel="Cancel reply">
              <SymbolView name="xmark.circle.fill" size={16} tintColor={Brand.muted} />
            </Pressable>
          </View>
        )}

        {/* Comments list */}
        {isLoading ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
        ) : isError ? (
          <QueryErrorState title="Couldn't load comments" onRetry={refetch} />
        ) : comments.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptySub}>Be the first to say something</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            renderItem={useCallback(({ item }: { item: typeof comments[number] }) => (
              <CommentRow
                comment={item}
                currentUserId={user?.id}
                postId={postId}
                onReply={handleReply}
                styles={styles}
                Brand={Brand}
              />
            ), [user?.id, postId, handleReply, styles, Brand])}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      gap: 10,
    },
    headerLabel: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    postCard: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    postPoster: { width: 48, height: 68, borderRadius: 6 },
    postInfo: { flex: 1, gap: 2 },
    postAuthorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
    postAvatar: { width: 18, height: 18, borderRadius: 9 },
    postAuthor: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted },
    postTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    postSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },
    postRating: { fontSize: 12, color: '#F59E0B', letterSpacing: 1, marginTop: 1 },
    postNote: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, fontStyle: 'italic', marginTop: 2 },

    list: { padding: Spacing.three, gap: 4, paddingBottom: 16 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 60 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },

    commentRow: { marginBottom: 16 },
    commentInner: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    commentAvatarWrap: {},
    commentBubble: { flex: 1, minWidth: 0 },
    commentMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    commentUser: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    commentTime: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },
    commentContent: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.ink, lineHeight: 20 },
    commentActions: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 6 },
    upvoteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    upvoteCount: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    upvoteCountActive: { color: '#e05' },
    replyBtn: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    deleteBtn: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#e05' },

    replyRow: { flexDirection: 'row', marginTop: 10, paddingLeft: 46 },
    replyLine: { width: 1.5, backgroundColor: Brand.border, marginRight: 10, borderRadius: 1 },
    viewRepliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 46 },
    viewRepliesLine: { width: 24, height: 1.5, backgroundColor: Brand.border, borderRadius: 1 },
    viewRepliesText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },

    replyContext: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 8,
      backgroundColor: Brand.tlight,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    replyContextText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },

    inputBar: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 10,
      padding: 12,
      paddingHorizontal: Spacing.three,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.paper,
    },
    input: {
      flex: 1,
      minHeight: 36,
      maxHeight: 100,
      backgroundColor: Brand.tlight,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 8,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
    },
    sendBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 7,
      alignSelf: 'flex-end',
    },
    sendBtnDisabled: { opacity: 0.4 },
    sendBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
  });
}
