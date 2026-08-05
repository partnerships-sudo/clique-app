import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { useUpdateCollectionItemPage } from '@/features/collection/api';
import { fetchBookPageCount } from '@/features/search/api';
import { VerifiedBadge } from '@/components/verified-badge';
import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { SwipeableRow } from '@/components/swipeable-row';
import { AvatarSizes, BrandFonts, CloseFriendsColors, type BrandPalette } from '@/constants/theme';
import type { Post } from '@/features/feed/api';
import { EMOJI_OPTIONS, useToggleEmojiReaction, type EmojiReactionSummary } from '@/features/feed/emoji-reactions';
import type { Reaction } from '@/features/feed/reactions';
import { timeAgo } from '@/features/feed/time-ago';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const POSTER_W = 90;
const POSTER_H = Math.round(POSTER_W * 1.5); // 2:3 → 135

const CURL_SIZE = 22;

function BookPageCurl() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, delay: 200, tension: 60, friction: 8 }).start();
  }, []);
  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
  return (
    <Animated.View style={{ position: 'absolute', bottom: 0, right: 0, width: CURL_SIZE, height: CURL_SIZE, transform: [{ scale }] }}>
      {/* Shadow behind fold */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderBottomWidth: CURL_SIZE, borderLeftWidth: CURL_SIZE, borderBottomColor: 'rgba(0,0,0,0.18)', borderLeftColor: 'transparent' }} />
      {/* White page underneath */}
      <View style={{ position: 'absolute', bottom: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderBottomWidth: CURL_SIZE, borderLeftWidth: CURL_SIZE, borderBottomColor: '#fff', borderLeftColor: 'transparent' }} />
    </Animated.View>
  );
}

function formatLoggedDate(isoDate: string) {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

const REWATCH_VERB: Partial<Record<string, string>> = {
  watch: 'watch',
  read: 'read',
  play: 'playthrough',
  listen: 'listen',
  podcast: 'listen',
};


function PageTracker({
  libraryItemId,
  currentPage,
  totalPages: initialTotalPages,
  externalId,
}: {
  libraryItemId: string;
  currentPage: number | null;
  totalPages: number | null;
  externalId: string;
}) {
  const updateProgress = useUpdateCollectionItemPage();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [open, setOpen] = useState(false);
  const [pageVal, setPageVal] = useState(currentPage ?? 0);
  const [totalPages, setTotalPages] = useState<number | null>(initialTotalPages);

  // Lazily fetch total pages from Hardcover if not stored yet
  useEffect(() => {
    if (!open || totalPages) return;
    fetchBookPageCount(externalId).then((p) => { if (p) setTotalPages(p); });
  }, [open, totalPages, externalId]);

  function nudge(delta: number) {
    setPageVal((v) => Math.max(0, Math.min(v + delta, totalPages ?? 9999)));
  }

  function handleSave() {
    if (pageVal > 0) {
      updateProgress.mutate({ id: libraryItemId, page: pageVal, ...(totalPages ? { totalPages } : {}) });
    }
    setOpen(false);
  }

  const pct = currentPage && totalPages ? Math.min(currentPage / totalPages, 1) : null;

  return (
    <>
      <Pressable style={styles.pageTrackerRow} onPress={() => { setPageVal(currentPage ?? 0); setOpen(true); }} hitSlop={8}>
        <SymbolView name="book.pages" size={12} tintColor={Brand.muted} style={{ width: 13, height: 13 }} />
        {currentPage && totalPages ? (
          <View style={styles.pageTrackerBarWrap}>
            <View style={styles.pageTrackerBar}>
              <View style={[styles.pageTrackerFill, { width: `${Math.round(pct! * 100)}%` as any }]} />
            </View>
            <Text style={styles.pageTrackerText}>p.{currentPage} / {totalPages}</Text>
          </View>
        ) : currentPage ? (
          <Text style={styles.pageTrackerText}>Page <Text style={styles.pageTrackerBtn}>{currentPage}</Text> · tap to update</Text>
        ) : (
          <Text style={styles.pageTrackerBtn}>+ Log current page</Text>
        )}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.pageModalOverlay} onPress={() => setOpen(false)} />
        <View style={styles.pageModalSheet}>
          <Text style={styles.pageModalTitle}>What page are you on?</Text>
          {totalPages ? (
            <View style={styles.pageModalProgressWrap}>
              <View style={styles.pageModalProgressBar}>
                <View style={[styles.pageModalProgressFill, { width: `${Math.round(Math.min(pageVal / totalPages, 1) * 100)}%` as any }]} />
              </View>
              <Text style={styles.pageModalSub}>{totalPages} pages total</Text>
            </View>
          ) : null}

          {/* Big page display */}
          <Text style={styles.pageModalBigNum}>{pageVal > 0 ? pageVal : '—'}</Text>

          {/* ±1 / ±10 / ±50 stepper row */}
          <View style={styles.stepperRow}>
            {[-50, -10, -1, +1, +10, +50].map((delta) => (
              <Pressable key={delta} style={styles.stepperBtn} onPress={() => nudge(delta)}>
                <Text style={styles.stepperBtnText}>{delta > 0 ? `+${delta}` : delta}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.pageModalActions}>
            <Pressable style={styles.pageModalCancel} onPress={() => setOpen(false)}>
              <Text style={styles.pageModalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.pageModalSave} onPress={handleSave}>
              <Text style={styles.pageModalSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function NoteBlock({ note, isSpoiler, revealed, onReveal, styles }: {
  note: string;
  isSpoiler: boolean;
  revealed: boolean;
  onReveal: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (!isSpoiler || revealed) {
    return <Text style={styles.note} numberOfLines={isSpoiler ? undefined : 3}>&ldquo;{note}&rdquo;</Text>;
  }
  return (
    <Pressable onPress={onReveal} style={styles.spoilerWrap}>
      <Text style={styles.spoilerBlurred} numberOfLines={2}>&ldquo;{note}&rdquo;</Text>
      <View style={styles.spoilerOverlay}>
        <Text style={styles.spoilerLabel}>🔒 Spoiler — tap to reveal</Text>
      </View>
    </Pressable>
  );
}

export function PostCard({
  post,
  isMine,
  currentUserId,
  reactions,
  emojiReactions,
  compatScore,
  commentCount,
  onToggleReaction,
  onDelete,
  onEdit,
  pageProgress,
}: {
  post: Post;
  isMine: boolean;
  currentUserId: string | undefined;
  reactions: Reaction[];
  emojiReactions?: EmojiReactionSummary;
  compatScore?: number;
  commentCount?: number;
  onToggleReaction: () => void;
  onDelete: () => void;
  onEdit?: () => void;
  pageProgress?: { libraryItemId: string; currentPage: number | null; totalPages: number | null; externalId: string };
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const ratingIcon = (post.user_rating_icon as RatingIconStyle) ?? 'stars';
  const type = TypeColors[post.type as keyof typeof TypeColors] ?? { color: '#888', bg: '#EEE', icon: '📝', label: post.type };
  const meReacted = reactions.some((r) => r.user_id === currentUserId);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const emojiSummary = emojiReactions ?? { counts: {}, mine: new Set<string>() };
  const toggleEmoji = useToggleEmojiReaction();
  const topEmojis = Object.entries(emojiSummary.counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  function confirmDelete() {
    Alert.alert('Delete post?', post.title, [
      ...(onEdit ? [{ text: 'Edit post', onPress: onEdit }] : []),
      { text: 'Delete', style: 'destructive' as const, onPress: onDelete },
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  }

  // Music/podcast cover art is genuinely square, so a square box shows it
  // whole with zero cropping. Games have real 2:3 portrait box art (IGDB) now,
  // so they use the same tall poster treatment as movies/TV/books below.
  const isSquareType = post.type === 'listen' || post.type === 'podcast';

  return (
    <SwipeableRow enabled={isMine} onDelete={confirmDelete}>
      <View style={[styles.card, isSquareType && styles.cardCompact]}>
        {/* ── Left: poster (tappable) — 2:3 for movies/TV/books/games, 1:1 for music/podcasts ── */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/content-detail-modal',
              params: {
                title: post.title,
                type: post.type,
                poster: post.poster ?? undefined,
                sub: post.sub ?? undefined,
                externalId: post.external_id ?? undefined,
                mediaType: post.media_type ?? (post.sub?.includes('Film') ? 'movie' : post.sub?.includes('TV') ? 'tv' : undefined),
              },
            })
          }
          accessibilityLabel={`View details for ${post.title}`}
          accessibilityRole="button"
          style={[styles.posterPress, isSquareType && styles.posterPressSquare]}>
          {post.poster ? (
            <Image source={{ uri: post.poster }} style={[styles.poster, isSquareType && styles.posterSquare]} resizeMode="cover" />
          ) : (
            <View style={[styles.poster, isSquareType && styles.posterSquare, styles.posterFallback, { backgroundColor: type.bg }]}>
              <Text style={styles.posterFallbackEmoji}>{type.icon}</Text>
            </View>
          )}
          {post.type === 'read' ? <BookPageCurl /> : null}
        </Pressable>

        {/* ── Right: content ── */}
        <View style={[styles.body, isSquareType && styles.bodyCompact]}>
          {/* avatar · username · pill · compat · time */}
          <View style={[styles.metaRow, isSquareType && styles.metaRowCompact]}>
            <Pressable
              style={styles.identity}
              hitSlop={4}
              accessibilityLabel={`View @${post.user_name}'s profile`}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: post.user_id } })}>
              <Avatar name={post.user_name} size={AvatarSizes.md} avatarUrl={post.user_avatar_url} />
              <Text style={styles.userName} numberOfLines={1}>@{post.user_name}</Text>
              {post.user_verified_tier ? <VerifiedBadge tier={post.user_verified_tier} size={12} /> : null}
            </Pressable>
            <View style={[styles.pill, { backgroundColor: type.bg }]}>
              <Text style={[styles.pillText, { color: type.color }]}>{type.label}</Text>
            </View>
            {post.visibility === 'close_friends' ? (
              <View style={styles.closeFriendsPill}>
                <Text style={styles.closeFriendsPillText}>💚 Friends</Text>
              </View>
            ) : null}
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </View>

          {/* Rewatch / re-read badge */}
          {(post.watch_count ?? 1) > 1 && (
            <View style={styles.rewatchBadge}>
              <Text style={styles.rewatchText}>
                {ordinal(post.watch_count)} {REWATCH_VERB[post.type] ?? 'time'}
              </Text>
            </View>
          )}

          {isMine && onEdit ? (
            <Pressable onPress={onEdit} accessibilityLabel="Edit rating and review" accessibilityRole="button">
              <Text style={styles.title} numberOfLines={isSquareType ? 1 : 3}>{post.title}</Text>
              {!isSquareType && post.sub ? <Text style={styles.sub} numberOfLines={2}>{post.sub}</Text> : null}
              {!isSquareType && post.note ? (
                <NoteBlock note={post.note} isSpoiler={post.is_spoiler} revealed={spoilerRevealed} onReveal={() => setSpoilerRevealed(true)} styles={styles} />
              ) : null}
              {post.rating ? (
                <RatingIcons rating={post.rating} iconStyle={ratingIcon} textStyle={styles.stars} />
              ) : (
                <Text style={styles.tapToRate}>Tap to rate ›</Text>
              )}
            </Pressable>
          ) : (
            <>
              <Text style={styles.title} numberOfLines={isSquareType ? 1 : 3}>{post.title}</Text>
              {!isSquareType && post.sub ? <Text style={styles.sub} numberOfLines={2}>{post.sub}</Text> : null}
              {!isSquareType && post.note ? (
                <NoteBlock note={post.note} isSpoiler={post.is_spoiler} revealed={spoilerRevealed} onReveal={() => setSpoilerRevealed(true)} styles={styles} />
              ) : null}
              {post.rating ? (
                <RatingIcons rating={post.rating} iconStyle={ratingIcon} textStyle={styles.stars} />
              ) : null}
            </>
          )}
          {/* Page tracker — shown on reading posts for the owner */}
          {isMine && post.type === 'read' && pageProgress ? (
            <PageTracker
              libraryItemId={pageProgress.libraryItemId}
              currentPage={pageProgress.currentPage}
              totalPages={pageProgress.totalPages}
              externalId={pageProgress.externalId}
            />
          ) : null}

          {/* Emoji picker popover — hidden on own posts */}
          {showEmojiPicker && !isMine && (
            <View style={styles.emojiPickerWrap}>
              {EMOJI_OPTIONS.map((e) => (
                <Pressable
                  key={e}
                  style={[styles.emojiPickerBtn, emojiSummary.mine.has(e) && styles.emojiPickerBtnActive]}
                  onPress={() => {
                    toggleEmoji.mutate({ postId: post.id, emoji: e, reacted: emojiSummary.mine.has(e) });
                    setShowEmojiPicker(false);
                  }}>
                  <Text style={styles.emojiPickerEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Emoji reactions row */}
          <View style={styles.emojiRow}>
            {topEmojis.map(([emoji, count]) => (
              <Pressable
                key={emoji}
                style={[styles.emojiPill, emojiSummary.mine.has(emoji) && styles.emojiPillActive]}
                onPress={() => {
                  if (!isMine) toggleEmoji.mutate({ postId: post.id, emoji, reacted: emojiSummary.mine.has(emoji) });
                }}
                onLongPress={() =>
                  router.push({ pathname: '/post-reactions-modal', params: { postId: post.id, emoji } })
                }
                hitSlop={4}>
                <Text style={styles.emojiPillText}>{emoji} {count}</Text>
              </Pressable>
            ))}
            {!isMine && (
              <Pressable
                style={styles.emojiAddBtn}
                onPress={() => setShowEmojiPicker((v) => !v)}
                hitSlop={16}>
                <Text style={styles.emojiAddText}>+</Text>
              </Pressable>
            )}
          </View>

          {/* Me too + share + comment row */}
          <View style={[styles.actionsRow, isSquareType && styles.actionsRowCompact]}>
            <View style={styles.reactCol}>
              {!isMine ? (
                <Pressable
                  onPress={onToggleReaction}
                  accessibilityLabel={meReacted ? `Remove Me too reaction, ${reactions.length} reactions` : `Me too — ${reactions.length} reactions`}
                  accessibilityRole="button"
                  style={[styles.reactBtn, meReacted && styles.reactBtnActive]}>
                  <Text style={[styles.reactText, meReacted && styles.reactTextActive]}>
                    ✦ Me too!
                  </Text>
                </Pressable>
              ) : null}
              {reactions.length > 0 && (
                <Pressable
                  style={styles.reactorRow}
                  onPress={() => router.push({ pathname: '/post-reactions-modal', params: { postId: post.id } })}>
                  {reactions.slice(0, 4).map((r, i) => (
                    <View key={r.user_id} style={[styles.reactorAvatar, i > 0 && { marginLeft: -6 }]}>
                      <Avatar name={r.user_name} avatarUrl={r.avatar_url} size={18} />
                    </View>
                  ))}
                </Pressable>
              )}
            </View>
            <View style={styles.shareChatRow}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/post-share-modal',
                    params: {
                      title: post.title,
                      type: post.type,
                      sub: post.sub ?? undefined,
                      poster: post.poster ?? undefined,
                      extRating: post.ext_rating ?? undefined,
                      mediaType: post.media_type ?? undefined,
                    },
                  })
                }
                accessibilityLabel={`Share ${post.title}`}
                accessibilityRole="button"
                hitSlop={16}>
                <SymbolView name="paperplane" size={17} tintColor={Brand.muted} style={{ width: 18, height: 18 }} />
              </Pressable>
              <View style={styles.shareDivider} />
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/post-comments-modal',
                    params: {
                      postId: post.id,
                      postTitle: post.title,
                      postAuthorId: post.user_id,
                      postPoster: post.poster ?? undefined,
                      postSub: post.sub ?? undefined,
                      postRating: post.rating != null ? String(post.rating) : undefined,
                      postNote: post.note ?? undefined,
                      postUserName: post.user_name,
                      postUserAvatar: post.user_avatar_url ?? undefined,
                    },
                  })
                }
                accessibilityLabel={`Comments for ${post.title}`}
                accessibilityRole="button"
                hitSlop={16}
                style={styles.commentBtn}>
                <SymbolView name="bubble.left" size={17} tintColor={Brand.muted} style={{ width: 18, height: 18 }} />
                {commentCount != null && commentCount > 0 && (
                  <Text style={styles.commentCount}>{commentCount > 99 ? '99+' : commentCount}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </SwipeableRow>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      flexDirection: 'row',
      alignItems: 'stretch',
      overflow: 'hidden',
      minHeight: POSTER_H,
    },
    // Music/podcast posts use a square poster instead of the tall 2:3 one, so
    // the card only needs to be as tall as that photo (90) rather than the
    // full poster height (135) — but it's a floor, not a hard cap: the body
    // column (meta row + title + actions row) is allowed to grow past 90 if
    // its content needs more room, instead of being clipped by the card's
    // `overflow: hidden`.
    cardCompact: { minHeight: POSTER_W },

    // Poster
    posterPress: { width: POSTER_W },
    posterPressSquare: { height: POSTER_W, alignSelf: 'flex-start' },
    poster: {
      width: POSTER_W,
      height: POSTER_H,
      alignSelf: 'flex-start',
      backgroundColor: Brand.border,
    },
    posterSquare: { height: POSTER_W },
    posterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    posterFallbackEmoji: { fontSize: 36 },
    ratingBadge: {
      position: 'absolute',
      bottom: 6,
      left: 6,
      backgroundColor: 'rgba(0,0,0,0.65)',
      borderRadius: 6,
      paddingVertical: 2,
      paddingHorizontal: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    ratingBadgeStar: { color: '#FFD700', fontSize: 10 },
    ratingBadgeText: { color: '#fff', fontSize: 10, fontFamily: BrandFonts.syneBold },

    // Body
    body: { flex: 1, minWidth: 0, padding: 12, paddingTop: 8, paddingBottom: 10 },
    bodyCompact: { padding: 8, paddingTop: 8, paddingBottom: 6 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6,
      flexWrap: 'wrap',
    },
    metaRowCompact: { marginBottom: 3 },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1, minWidth: 0 },
    userName: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11.5,
      color: Brand.ink,
      flexShrink: 1,
    },
    pill: {
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 7,
    },
    closeFriendsPill: {
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 7,
      backgroundColor: CloseFriendsColors.bg,
    },
    closeFriendsPillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      color: CloseFriendsColors.text,
    },
    pillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    compatBadge: {
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    compatText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      letterSpacing: 0.2,
    },
    time: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
      marginLeft: 'auto',
    },
    title: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14.5,
      color: Brand.ink,
      marginBottom: 2,
      lineHeight: 19,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
    },
    note: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12,
      color: Brand.muted,
      marginTop: 5,
      lineHeight: 17,
    },
    stars: {
      color: Brand.warm,
      fontSize: 13,
      marginTop: 4,
    },
    tapToRate: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginTop: 4,
    },
    spoilerWrap: {
      marginTop: 4,
      borderRadius: 8,
      overflow: 'hidden',
    },
    spoilerBlurred: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      lineHeight: 18,
      color: 'transparent',
      textShadowColor: Brand.muted,
      textShadowRadius: 8,
    },
    spoilerOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    spoilerLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12,
      color: Brand.muted,
    },
    rewatchBadge: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.tlight,
      borderRadius: 6,
      paddingHorizontal: 7,
      paddingVertical: 2,
      marginBottom: 3,
    },
    rewatchText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.trust,
    },
    pageTrackerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 5,
    },
    pageTrackerBarWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    pageTrackerBar: {
      flex: 1,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      overflow: 'hidden',
    },
    pageTrackerFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.trust,
    },
    pageTrackerText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
    },
    pageTrackerBtn: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: Brand.trust,
    },
    pageModalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    pageModalSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: Brand.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: 40,
      gap: 12,
    },
    pageModalTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
    },
    pageModalProgressWrap: { gap: 6 },
    pageModalProgressBar: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Brand.border,
      overflow: 'hidden',
    },
    pageModalProgressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: Brand.trust,
    },
    pageModalSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
    },
    pageModalBigNum: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 52,
      color: Brand.ink,
      textAlign: 'center',
      marginVertical: 4,
    },
    stepperRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 6,
    },
    stepperBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.paper,
      alignItems: 'center',
    },
    stepperBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.ink,
    },
    pageModalActions: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    pageModalCancel: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
    },
    pageModalCancelText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.muted,
    },
    pageModalSave: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: Brand.trust,
      alignItems: 'center',
    },
    pageModalSaveText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: '#fff',
    },
    emojiPickerWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: 10,
      marginTop: 8,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
    },
    emojiPickerBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiPickerBtnActive: { backgroundColor: Brand.tlight, borderWidth: 1.5, borderColor: Brand.trust },
    emojiPickerEmoji: { fontSize: 20 },
    emojiRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
    },
    emojiPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.tlight,
      borderRadius: 12,
      paddingVertical: 2,
      paddingHorizontal: 6,
    },
    emojiPillActive: { backgroundColor: Brand.trust },
    emojiPillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.trust,
    },
    emojiAddBtn: {
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emojiAddText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      lineHeight: 18,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    actionsRowCompact: { paddingTop: 4 },
    reactBtn: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 10,
    },
    reactBtnActive: { backgroundColor: Brand.trust },
    reactText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.trust,
    },
    reactTextActive: { color: '#fff' },
    reactCol: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
    },
    reactorRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reactorAvatar: {
      borderRadius: 9,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: Brand.card,
    },
    shareChatRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginLeft: 'auto',
    },
    shareDivider: {
      width: 1,
      height: 16,
      backgroundColor: Brand.border,
    },
    commentBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    commentCount: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
    },
  });
}
