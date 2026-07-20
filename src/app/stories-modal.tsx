import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { ShareCard } from '@/components/share/share-card';
import { BrandFonts } from '@/constants/theme';
import { SymbolView } from 'expo-symbols';
import { useCloseFriendsPosts } from '@/features/close-friends/posts';
import { useSendStoryLike, useToggleReaction } from '@/features/feed/reactions';
import { useRecordStoryView, useStoryActivity } from '@/features/stories/views';
import { useAddLibraryItem, useRemoveLibraryItem } from '@/features/library/api';
import { useSendDm } from '@/features/dms/api';
import { encodeStoryReply } from '@/features/dms/story-reply';
import { useSession } from '@/hooks/use-session';

const { width: SW } = Dimensions.get('window');
const STORY_DURATION = 10_000;

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'Just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StoriesModal() {
  const { user } = useSession();
  const insets = useSafeAreaInsets();
  const { data: posts = [] } = useCloseFriendsPosts();
  const [index, setIndex] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const pausedAt = useRef(0);

  const sendStoryLike = useSendStoryLike();
  const toggleReaction = useToggleReaction();
  const recordView = useRecordStoryView();
  const sendDm = useSendDm();
  const addLibraryItem = useAddLibraryItem();
  const removeLibraryItem = useRemoveLibraryItem();
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());
  // maps post.id → library item id (so we can delete it)
  const [savedMap, setSavedMap] = useState<Map<string, string>>(new Map());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);
  const [activitySheetVisible, setActivitySheetVisible] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const post = posts[index];
  const isOwnStory = post?.user_id === user?.id;
  const { data: activity } = useStoryActivity(isOwnStory ? post?.id : undefined);
  const meReacted = post ? likedIds.has(post.id) : false;
  const meSaved = post ? savedMap.has(post.id) : false;

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
    toastTimer.current = setTimeout(() => setToastMsg(null), 1900);
  }

  function handleSave() {
    if (!post || isOwnStory) return;
    if (meSaved) {
      const libraryId = savedMap.get(post.id)!;
      setSavedMap((prev) => { const m = new Map(prev); m.delete(post.id); return m; });
      removeLibraryItem.mutate(libraryId);
      showToast('Removed from watchlist');
    } else {
      addLibraryItem.mutate(
        { type: post.type, title: post.title, sub: post.sub ?? undefined, poster: post.poster ?? undefined, intent: 'watchlist' },
        { onSuccess: (item) => setSavedMap((prev) => new Map(prev).set(post.id, item.id)) },
      );
      showToast('Added to watchlist');
    }
  }

  function startProgress(from = 0) {
    progress.setValue(from);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: STORY_DURATION * (1 - from),
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  }

  function handlePressIn() {
    animRef.current?.stop();
    pausedAt.current = (progress as any)._value ?? 0;
  }

  function handlePressOut() {
    startProgress(pausedAt.current);
  }

  function goNext() {
    if (index < posts.length - 1) {
      setIndex((i) => i + 1);
    } else {
      router.back();
    }
  }

  function goPrev() {
    if (index > 0) setIndex((i) => i - 1);
    else startProgress(0);
  }

  useEffect(() => {
    if (posts.length === 0) return;
    startProgress(0);
    if (post) {
      recordView.mutate({ postId: post.id, postAuthorId: post.user_id });
    }
    setMessage('');
    setSent(false);
    Keyboard.dismiss();
    return () => animRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, posts.length]);

  async function handleSendMessage() {
    if (!message.trim() || !post) return;
    const content = encodeStoryReply({
      title: post.title,
      type: post.type,
      sub: post.sub ?? undefined,
      poster: post.poster ?? undefined,
      author: post.user_name,
      text: message.trim(),
    });
    await sendDm.mutateAsync({ friendId: post.user_id, content });
    setMessage('');
    setSent(true);
    Keyboard.dismiss();
  }

  if (!post) return null;

  return (
    <Pressable
      style={styles.container}
      onPressIn={() => handlePressIn()}
      onPressOut={() => handlePressOut()}
      onPress={(e) => {
        const x = e.nativeEvent.locationX;
        if (x < SW * 0.3) goPrev();
        else if (x > SW * 0.7) goNext();
      }}>

      {/* Watchlist toast */}
      {toastMsg ? (
        <Animated.View style={[styles.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={styles.toastText}>{toastMsg}</Text>
        </Animated.View>
      ) : null}


      {/* Story card */}
      <View style={styles.cardWrap} pointerEvents="box-none">
        <ShareCard
          title={post.title}
          sub={post.sub}
          poster={post.poster}
          type={post.type}
          rating={post.rating}
          ratingIcon={(post.user_rating_icon as RatingIconStyle) ?? 'stars'}
          note={post.note}
          date={new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          genre={null}
          onPosterPress={() => {
            animRef.current?.stop();
            pausedAt.current = (progress as any)._value ?? 0;
            router.push({
              pathname: '/content-detail-modal',
              params: {
                title: post.title,
                type: post.type,
                poster: post.poster ?? undefined,
                sub: post.sub ?? undefined,
                externalId: post.external_id ?? undefined,
                mediaType: post.sub?.includes('Film') ? 'movie' : post.sub?.includes('TV') ? 'tv' : undefined,
              },
            });
          }}
        />
      </View>

      {/* Progress bars + header overlay */}
      <View style={[styles.topSafe, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <View style={styles.progressRow} pointerEvents="none">
          {posts.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width:
                      i < index
                        ? '100%'
                        : i === index
                        ? progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })
                        : '0%',
                  },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <Pressable onPress={(e) => { e.stopPropagation(); isOwnStory ? router.push('/profile') : router.push({ pathname: '/friend-profile-modal', params: { userId: post.user_id } }); }} hitSlop={8}>
            <Avatar name={post.user_name} avatarUrl={post.user_avatar_url} size={34} ring="#34D399" />
          </Pressable>
          <View style={styles.headerMeta}>
            <Text style={styles.headerName}>{post.user_name}</Text>
            <Text style={styles.headerTime}>{timeAgo(post.created_at)}</Text>
          </View>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <SymbolView name="xmark" size={16} tintColor="#fff" type="monochrome" />
          </Pressable>
        </View>
      </View>

      {/* Bottom action bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : 'height'}
        style={styles.bottomSafe}
        pointerEvents="box-none">
        <SafeAreaView edges={['bottom']} pointerEvents="box-none">
        <View style={styles.actionBar}>
          {/* ── Own story: IG-style activity (left) ── */}
          {isOwnStory ? (
            <Pressable
              style={styles.activityWrap}
              onPress={(e) => { e.stopPropagation(); setActivitySheetVisible((v) => !v); }}
              hitSlop={8}>
              {/* Viewer avatar stack */}
              {(activity?.viewers ?? []).length > 0 && (
                <View style={styles.activityAvatarRow}>
                  {(activity?.viewers ?? []).slice(0, 3).map((v, i) => (
                    <View key={v.viewer_id} style={[styles.activityAvatar, i > 0 && styles.activityAvatarOverlap]}>
                      {v.viewer_avatar_url ? (
                        <Image source={{ uri: v.viewer_avatar_url }} style={styles.activityAvatarImg} />
                      ) : (
                        <View style={[styles.activityAvatarImg, styles.activityAvatarFallback]}>
                          <Text style={styles.activityAvatarInitial}>{v.viewer_name[0]?.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
              <View style={styles.activityTextCol}>
                <View style={styles.activityCountRow}>
                  <SymbolView name="eye.fill" size={13} tintColor="rgba(255,255,255,0.85)" type="monochrome" />
                  <Text style={styles.activityCount}>
                    {(activity?.viewers ?? []).length}
                  </Text>
                  {(activity?.likers ?? []).length > 0 && (
                    <>
                      <Text style={styles.activityDot}>·</Text>
                      <SymbolView name="heart.fill" size={12} tintColor="#E84F4F" type="monochrome" />
                      <Text style={styles.activityCount}>{(activity?.likers ?? []).length}</Text>
                    </>
                  )}
                </View>
                {(activity?.likers ?? []).length > 0 && (
                  <Text style={styles.activityLikedBy} numberOfLines={1}>
                    {activity!.likers[0].from_user_name}
                    {activity!.likers.length > 1 ? ` and ${activity!.likers.length - 1} other${activity!.likers.length > 2 ? 's' : ''}` : ''}
                  </Text>
                )}
              </View>
            </Pressable>
          ) : (
            /* Friend story: heart button on left */
            <Pressable
              style={[styles.actionBtn, meReacted && styles.actionBtnActive]}
              onPress={() => {
                if (meReacted) {
                  setLikedIds((prev) => { const s = new Set(prev); s.delete(post.id); return s; });
                  toggleReaction.mutate({ postId: post.id, reacted: true });
                } else {
                  setLikedIds((prev) => new Set([...prev, post.id]));
                  sendStoryLike.mutate({
                    postId: post.id,
                    postAuthorId: post.user_id,
                    postTitle: post.title,
                    postType: post.type,
                    postPoster: post.poster,
                  });
                }
              }}
              hitSlop={8}>
              <SymbolView name={meReacted ? 'heart.fill' : 'heart'} size={22} tintColor={meReacted ? '#E84F4F' : '#fff'} type="monochrome" />
            </Pressable>
          )}

          {/* Message input bar — friend stories only */}
          {!isOwnStory && (
            <View style={styles.messageRow}>
              <TextInput
                ref={inputRef}
                style={styles.messageInput}
                placeholder={sent ? '✓ Sent' : `Reply to ${post.user_name}…`}
                placeholderTextColor={sent ? '#34D399' : 'rgba(255,255,255,0.5)'}
                value={message}
                onChangeText={setMessage}
                returnKeyType="send"
                onSubmitEditing={handleSendMessage}
                editable={!sent}
                onFocus={() => { animRef.current?.stop(); pausedAt.current = (progress as any)._value ?? 0; }}
                onBlur={() => { if (!sent) startProgress(pausedAt.current); }}
              />
              {message.length > 0 && !sent && (
                <Pressable onPress={handleSendMessage} hitSlop={8} style={styles.sendBtn}>
                  <SymbolView name="arrow.up.circle.fill" size={30} tintColor="#fff" type="monochrome" />
                </Pressable>
              )}
            </View>
          )}
          {/* Bookmark button — sits right of the message bar */}
          {!isOwnStory && (
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleSave(); }}
              hitSlop={12}
              style={styles.actionBtn}>
              <SymbolView name={meSaved ? 'bookmark.fill' : 'bookmark'} size={22} tintColor={meSaved ? '#34D399' : '#fff'} type="monochrome" />
            </Pressable>
          )}
        </View>
        </SafeAreaView>
      </KeyboardAvoidingView>

      {/* Activity sheet */}
      <Modal
        visible={activitySheetVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setActivitySheetVisible(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setActivitySheetVisible(false)}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            <View style={styles.sheetGrabberRow}>
              <View style={styles.sheetGrabber} />
            </View>
            <View style={styles.sheetTitleRow}>
              <Text style={styles.sheetTitle}>Story activity</Text>
              <Pressable onPress={() => setActivitySheetVisible(false)} hitSlop={12}>
                <SymbolView name="xmark.circle.fill" size={22} tintColor="rgba(255,255,255,0.3)" type="monochrome" />
              </Pressable>
            </View>

            {/* Summary counts */}
            <View style={styles.sheetCountRow}>
              <SymbolView name="eye" size={14} tintColor="rgba(255,255,255,0.5)" type="monochrome" />
              <Text style={styles.sheetCountText}>{(activity?.viewers ?? []).length} view{(activity?.viewers ?? []).length !== 1 ? 's' : ''}</Text>
              {(activity?.likers ?? []).length > 0 && (
                <>
                  <Text style={styles.sheetCountDot}>·</Text>
                  <Text style={styles.sheetCountText}>❤️ {activity!.likers.length} like{activity!.likers.length !== 1 ? 's' : ''}</Text>
                </>
              )}
            </View>

            <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
              {(activity?.viewers ?? []).length === 0 ? (
                <Text style={styles.sheetEmpty}>No views yet</Text>
              ) : (() => {
                  const likerIds = new Set((activity?.likers ?? []).map((l) => l.from_user_id));
                  const sorted = [...(activity?.viewers ?? [])].sort((a, b) => {
                    const aLiked = likerIds.has(a.viewer_id) ? 1 : 0;
                    const bLiked = likerIds.has(b.viewer_id) ? 1 : 0;
                    return bLiked - aLiked;
                  });
                  return sorted.map((v) => {
                    const liked = likerIds.has(v.viewer_id);
                    return (
                      <View key={v.viewer_id} style={styles.sheetRow}>
                        {v.viewer_avatar_url ? (
                          <Image source={{ uri: v.viewer_avatar_url }} style={styles.sheetAvatar} />
                        ) : (
                          <View style={[styles.sheetAvatar, styles.sheetAvatarFallback]}>
                            <Text style={styles.sheetAvatarInitial}>{v.viewer_name[0]?.toUpperCase()}</Text>
                          </View>
                        )}
                        <Text style={styles.sheetName}>{v.viewer_name}</Text>
                        <View style={styles.sheetRowRight}>
                          {liked && <Text style={styles.sheetLikeIcon}>❤️</Text>}
                          <Text style={styles.sheetTime}>{timeAgo(v.created_at)}</Text>
                        </View>
                      </View>
                    );
                  });
                })()
              }
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B0A14' },
  topSafe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 12,
    paddingBottom: 10,
  },
  progressTrack: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
    paddingBottom: 6,
  },
  headerMeta: { flex: 1 },
  headerName: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: '#fff',
  },
  headerTime: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  closeBtn: { padding: 4 },
  toast: {
    position: 'absolute',
    right: 16,
    bottom: 180,
    zIndex: 30,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastText: {
    color: '#fff',
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
  },
  rightActions: {
    position: 'absolute',
    right: 16,
    bottom: 120,
    zIndex: 15,
    alignItems: 'center',
    gap: 24,
  },
  rightBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
  },
  closeIcon: { fontSize: 18, color: '#fff' },
  cardWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapRow: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 5,
  },
  tapLeft: { flex: 1 },
  tapCenter: { flex: 2 },
  tapRight: { flex: 1 },
  bottomSafe: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 8,
    gap: 12,
  },
  activityWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  activityAvatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityAvatar: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    overflow: 'hidden',
  },
  activityAvatarOverlap: { marginLeft: -8 },
  activityAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  activityAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarInitial: {
    color: '#fff',
    fontSize: 11,
    fontFamily: BrandFonts.syneBold,
  },
  activityTextCol: {
    gap: 2,
  },
  activityCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityCount: {
    color: 'rgba(255,255,255,0.9)',
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
  },
  activityDot: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  activityLikedBy: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionBtnActive: { backgroundColor: 'rgba(255,80,80,0.25)' },
  messageRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  messageInput: {
    flex: 1,
    fontFamily: BrandFonts.interRegular,
    fontSize: 15,
    color: '#fff',
  },
  sendBtn: {
    marginRight: -4,
  },
  actionEmoji: { fontSize: 20 },
  actionCount: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: '#fff',
  },

  // Activity sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1C1830',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
    minHeight: '50%',
    maxHeight: '70%',
  },
  sheetGrabberRow: { alignItems: 'center', paddingVertical: 6, marginBottom: 4 },
  sheetGrabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 17,
    color: '#fff',
  },
  sheetSection: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 10,
  },
  sheetScroll: { flex: 1 },
  sheetEmpty: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    paddingVertical: 12,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sheetAvatar: { width: 40, height: 40, borderRadius: 20 },
  sheetAvatarFallback: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetAvatarInitial: {
    color: '#fff',
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
  },
  sheetName: {
    flex: 1,
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: '#fff',
  },
  sheetTime: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  sheetCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sheetCountText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  sheetCountDot: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
  },
  sheetRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sheetLikeIcon: { fontSize: 13 },
});
