import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  useAddListComment,
  useDeleteListComment,
  useListComments,
  useListLikeState,
  useToggleListLike,
  type ListComment,
} from '@/features/lists/api';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

function CommentRow({
  comment,
  currentUserId,
  listId,
  styles,
  Brand,
}: {
  comment: ListComment;
  currentUserId: string | undefined;
  listId: string;
  styles: ReturnType<typeof createStyles>;
  Brand: BrandPalette;
}) {
  const deleteComment = useDeleteListComment();

  function confirmDelete() {
    Alert.alert('Delete comment?', comment.content.slice(0, 60), [
      { text: 'Delete', style: 'destructive', onPress: () => deleteComment.mutate({ commentId: comment.id, listId }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.commentRow}>
      <Pressable
        onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: comment.user_id } })}
        style={styles.avatarWrap}>
        <Avatar name={comment.user_name} avatarUrl={comment.user_avatar_url} size={36} />
      </Pressable>
      <View style={styles.bubble}>
        <View style={styles.meta}>
          <Text style={styles.username}>@{comment.user_name}</Text>
          <Text style={styles.time}>{timeAgo(comment.created_at)}</Text>
        </View>
        <Text style={styles.content}>{comment.content}</Text>
        {comment.user_id === currentUserId && (
          <Pressable hitSlop={8} onPress={confirmDelete} style={{ marginTop: 4 }}>
            <Text style={styles.deleteBtn}>Delete</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function ListCommentsModal() {
  const { listId, listTitle } = useLocalSearchParams<{ listId: string; listTitle: string }>();
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const { data: comments = [], isLoading } = useListComments(listId);
  const { data: likeState } = useListLikeState(listId);
  const addComment = useAddListComment();
  const toggleLike = useToggleListLike();

  const [text, setText] = useState('');
  const inputRef = useRef<TextInput>(null);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    try {
      await addComment.mutateAsync({ listId, content: trimmed });
      setText('');
    } catch {
      Alert.alert('Could not post comment', 'Please check your connection and try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerLabel}>Comments</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{listTitle}</Text>
          </View>
          {/* Like button in header */}
          <Pressable
            style={styles.likeBtn}
            onPress={() => likeState && toggleLike.mutate({ listId, liked: likeState.liked })}
            hitSlop={10}>
            <SymbolView
              name={likeState?.liked ? 'heart.fill' : 'heart'}
              size={20}
              tintColor={likeState?.liked ? '#e05' : Brand.muted}
              type="monochrome"
            />
            {(likeState?.count ?? 0) > 0 && (
              <Text style={[styles.likeCount, likeState?.liked && styles.likeCountActive]}>
                {likeState!.count}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Compose bar */}
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

        {/* Comments list */}
        {isLoading ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
        ) : comments.length === 0 ? (
          <View style={styles.empty}>
            <SymbolView name="bubble.left" size={36} tintColor={Brand.border} type="monochrome" />
            <Text style={styles.emptyTitle}>No comments yet</Text>
            <Text style={styles.emptySub}>Be the first to say something</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.list}
            keyboardDismissMode="on-drag"
            renderItem={({ item }) => (
              <CommentRow
                comment={item}
                currentUserId={user?.id}
                listId={listId}
                styles={styles}
                Brand={Brand}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingTop: 14,
      paddingBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerLabel: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 2 },
    likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    likeCount: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted },
    likeCountActive: { color: '#e05' },

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

    list: { padding: Spacing.three, paddingBottom: 24 },
    separator: { height: 1, backgroundColor: Brand.border, marginVertical: 12, marginLeft: 46 },

    commentRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    avatarWrap: {},
    bubble: { flex: 1 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
    username: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },
    content: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.ink, lineHeight: 20 },
    deleteBtn: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#e05' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 60 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
  });
}
