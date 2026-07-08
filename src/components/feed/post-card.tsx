import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { RatingIcons, type RatingIconStyle } from '@/components/rating-icons';
import { SwipeableRow } from '@/components/swipeable-row';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { Post } from '@/features/feed/api';
import type { Reaction } from '@/features/feed/reactions';
import { timeAgo } from '@/features/feed/time-ago';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const POSTER_W = 90;
const POSTER_H = Math.round(POSTER_W * 1.5); // 2:3 → 135


export function PostCard({
  post,
  isMine,
  currentUserId,
  reactions,
  compatScore,
  onToggleReaction,
  onDelete,
}: {
  post: Post;
  isMine: boolean;
  currentUserId: string | undefined;
  reactions: Reaction[];
  compatScore?: number;
  onToggleReaction: () => void;
  onDelete: () => void;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const ratingIcon = (post.user_rating_icon as RatingIconStyle) ?? 'stars';
  const type = TypeColors[post.type];
  const meReacted = reactions.some((r) => r.user_id === currentUserId);

  function confirmDelete() {
    Alert.alert('Delete post?', `Delete "${post.title}" from the feed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <SwipeableRow enabled={isMine} onDelete={confirmDelete}>
      <View style={styles.card}>
        {/* ── Left: large 2:3 poster (tappable) ── */}
        <Pressable
          onPress={() =>
            router.push({
              pathname: '/content-detail-modal',
              params: {
                title: post.title,
                type: post.type,
                poster: post.poster ?? undefined,
                sub: post.sub ?? undefined,
              },
            })
          }
          style={styles.posterPress}>
          {post.poster ? (
            <Image source={{ uri: post.poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback, { backgroundColor: type.bg }]}>
              <Text style={styles.posterFallbackEmoji}>{type.icon}</Text>
            </View>
          )}
          {post.ext_rating ? (
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingBadgeStar}>★</Text>
              <Text style={styles.ratingBadgeText}>{post.ext_rating}</Text>
            </View>
          ) : null}
        </Pressable>

        {/* ── Right: content ── */}
        <View style={styles.body}>
          {/* avatar · username · pill · compat · time */}
          <View style={styles.metaRow}>
            <Avatar name={post.user_name} size={22} avatarUrl={post.user_avatar_url} />
            <Text style={styles.userName} numberOfLines={1}>@{post.user_name}</Text>
            <View style={[styles.pill, { backgroundColor: type.bg }]}>
              <Text style={[styles.pillText, { color: type.color }]}>{type.label}</Text>
            </View>
            {!isMine && compatScore !== undefined ? (
              <View style={[styles.compatBadge, { backgroundColor: compatColor(compatScore) + '1A' }]}>
                <Text style={[styles.compatText, { color: compatColor(compatScore) }]}>
                  {compatEmoji(compatScore)} {compatScore}%
                </Text>
              </View>
            ) : null}
            <Text style={styles.time}>{timeAgo(post.created_at)}</Text>
          </View>

          <Text style={styles.title} numberOfLines={3}>{post.title}</Text>
          {post.sub ? <Text style={styles.sub} numberOfLines={2}>{post.sub}</Text> : null}
          {post.note ? <Text style={styles.note} numberOfLines={3}>&ldquo;{post.note}&rdquo;</Text> : null}
          {post.rating ? (
            <RatingIcons rating={post.rating} iconStyle={ratingIcon} textStyle={styles.stars} />
          ) : null}

          <View style={styles.actionsRow}>
            {!isMine ? (
              <Pressable
                onPress={onToggleReaction}
                style={[styles.reactBtn, meReacted && styles.reactBtnActive]}>
                <Text style={[styles.reactText, meReacted && styles.reactTextActive]}>
                  ✦ Me too!{reactions.length ? ` ${reactions.length}` : ''}
                </Text>
              </Pressable>
            ) : null}
            {reactions.length > 0 ? (
              <View style={styles.reactorRow}>
                {reactions.slice(0, 3).map((r, i) => (
                  <View key={r.id} style={[styles.reactorBubble, i > 0 && styles.reactorBubbleOverlap]}>
                    {r.avatar_url ? (
                      <Image source={{ uri: r.avatar_url }} style={styles.reactorPhoto} />
                    ) : (
                      <Avatar name={r.user_name} size={22} />
                    )}
                  </View>
                ))}
                {reactions.length > 3 ? (
                  <View style={[styles.reactorBubble, styles.reactorBubbleOverlap, styles.reactorOverflow]}>
                    <Text style={styles.reactorOverflowText}>+{reactions.length - 3}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Pressable
              style={styles.shareBtn}
              onPress={() =>
                router.push({
                  pathname: '/recommend-modal',
                  params: {
                    title: post.title,
                    type: post.type,
                    sub: post.sub ?? undefined,
                    poster: post.poster ?? undefined,
                    extRating: post.ext_rating ?? undefined,
                  },
                })
              }
              hitSlop={8}>
              <Text style={styles.shareBtnText}>↗</Text>
            </Pressable>
            <Pressable
              style={styles.chatBtn}
              onPress={() =>
                router.push({ pathname: '/chat-modal', params: { title: post.title, type: post.type } })
              }
              hitSlop={8}>
              <Text style={styles.chatBtnText}>💬</Text>
            </Pressable>
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

    // Poster
    posterPress: { width: POSTER_W },
    poster: {
      width: POSTER_W,
      flex: 1,
      backgroundColor: Brand.border,
    },
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
    ratingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

    // Body
    body: { flex: 1, minWidth: 0, padding: 12, paddingBottom: 10 },
    metaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginBottom: 6,
      flexWrap: 'wrap',
    },
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
      color: '#555',
      marginTop: 5,
      lineHeight: 17,
    },
    stars: {
      color: '#F4A340',
      fontSize: 13,
      marginTop: 4,
    },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 'auto',
      paddingTop: 8,
      flexWrap: 'wrap',
    },
    reactBtn: {
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    reactBtnActive: { backgroundColor: Brand.trust },
    reactText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.trust,
    },
    reactTextActive: { color: '#fff' },
    reactorRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    reactorBubble: {
      borderRadius: 13,
      borderWidth: 2,
      borderColor: Brand.card,
      overflow: 'hidden',
    },
    reactorBubbleOverlap: { marginLeft: -7 },
    reactorPhoto: { width: 26, height: 26, borderRadius: 13 },
    reactorOverflow: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    reactorOverflowText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: Brand.trust,
    },
    shareBtn: { marginLeft: 'auto', padding: 4 },
    shareBtnText: { fontSize: 15, color: Brand.muted },
    chatBtn: { padding: 4 },
    chatBtnText: { fontSize: 15 },
  });
}
