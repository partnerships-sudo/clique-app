import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import type { Message } from '@/features/chats/api';
import { parseChatImage } from '@/features/chat-media/upload';
import { parseRec } from '@/features/dms/rec';
import { parseStoryReply } from '@/features/dms/story-reply';
import { timeAgo } from '@/features/feed/time-ago';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useAddLibraryItem } from '@/features/library/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export function MessageBubble({
  message,
  isMine,
  isSpoiler,
  avatarUrl,
  userHandle,
}: {
  message: Message;
  isMine: boolean;
  isSpoiler: boolean;
  avatarUrl?: string | null;
  userHandle?: string;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [revealed, setRevealed] = useState(false);
  const blurred = isSpoiler && !revealed;
  const addLibraryItem = useAddLibraryItem();
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);

  async function handleSaveToWatchlist() {
    if (!rec || savedToWatchlist || addLibraryItem.isPending) return;
    await addLibraryItem.mutateAsync({
      type: rec.type as EntryType,
      title: rec.title,
      sub: rec.sub ?? undefined,
      poster: rec.poster ?? undefined,
      extRating: rec.extRating ?? undefined,
      intent: 'watchlist',
      recFromUserName: message.user_name,
      recCompatScore: rec.compatScore,
    });
    setSavedToWatchlist(true);
  }

  const storyReply = parseStoryReply(message.content);
  const rec = storyReply ? null : parseRec(message.content);
  const chatImage = (!storyReply && !rec) ? parseChatImage(message.content) : null;
  const gifUrl = (() => {
    if (storyReply || rec || chatImage) return null;
    if (message.content.startsWith('__gif:')) return message.content.slice(6, -2);
    try {
      const parsed = JSON.parse(message.content);
      if (parsed.__chatGif && parsed.url) return parsed.url;
    } catch {}
    return null;
  })();

  return (
    <View style={[styles.group, isMine && styles.groupMine]}>
      {!isMine ? (
        <Pressable
          onPress={() =>
            router.push({ pathname: '/friend-profile-modal', params: { userId: message.user_id } })
          }
          hitSlop={8}>
          <Avatar name={message.user_name} size={30} avatarUrl={avatarUrl} />
        </Pressable>
      ) : null}
      <View style={[styles.col, isMine && styles.colMine]}>
        {!isMine ? <Text style={styles.sender}>{userHandle ?? message.user_name}</Text> : null}

        {blurred ? (
          <Pressable style={styles.spoilerBubble} onPress={() => setRevealed(true)}>
            <Text style={styles.spoilerText}>
              🙈 Spoiler
              {message.ep_season != null
                ? message.post_type === 'read'
                  ? ` for Chapter ${message.ep_episode}`
                  : ` for S${message.ep_season}E${message.ep_episode}`
                : ''}{' '}
              — tap to reveal
            </Text>
          </Pressable>
        ) : storyReply ? (
          /* ── Story reply card ── */
          <View style={styles.storyReplyCard}>
            <View style={styles.storyReplyPreview}>
              {storyReply.poster ? (
                <Image source={{ uri: storyReply.poster }} style={styles.storyReplyPoster} resizeMode="cover" />
              ) : null}
              <View style={styles.storyReplyInfo}>
                <Text style={styles.storyReplyLabel}>Replied to your story</Text>
                <Text style={styles.storyReplyTitle} numberOfLines={1}>{storyReply.title}</Text>
              </View>
            </View>
            <View style={[styles.bubble, isMine && styles.bubbleMine, styles.storyReplyBubble]}>
              <Text style={[styles.text, isMine && styles.textMine]}>{storyReply.text}</Text>
            </View>
          </View>
        ) : rec ? (
          /* ── Rich recommendation card ── */
          <Pressable
            style={styles.recCard}
            onPress={() =>
              router.push({
                pathname: '/content-detail-modal',
                params: {
                  title: rec.title,
                  type: rec.type,
                  poster: rec.poster,
                  sub: rec.sub,
                  mediaType: rec.sub?.includes('Film') ? 'movie' : rec.sub?.includes('TV') ? 'tv' : undefined,
                },
              })
            }>
            {/* Header: type pill + label */}
            <View style={styles.recHeader}>
              {(() => {
                const t = TypeColors[rec.type as EntryType] ?? TypeColors.watch;
                return (
                  <View style={[styles.recPill, { backgroundColor: t.bg }]}>
                    <Text style={[styles.recPillText, { color: t.color }]}>{t.label}</Text>
                  </View>
                );
              })()}
              <Text style={styles.recHeaderLabel}>Recommendation</Text>
            </View>

            {/* Body: poster + title/sub */}
            <View style={styles.recBody}>
              {rec.poster ? (
                <Image source={{ uri: rec.poster }} style={styles.recPoster} />
              ) : (
                <View
                  style={[
                    styles.recPoster,
                    styles.recPosterFallback,
                    { backgroundColor: (TypeColors[rec.type as EntryType] ?? TypeColors.watch).bg },
                  ]}>
                  <Text style={{ fontSize: 20 }}>
                    {(TypeColors[rec.type as EntryType] ?? TypeColors.watch).icon}
                  </Text>
                </View>
              )}
              <View style={styles.recInfo}>
                <Text style={styles.recTitle} numberOfLines={3}>
                  {rec.title}
                </Text>
                {rec.sub ? (
                  <Text style={styles.recSub} numberOfLines={2}>
                    {rec.sub}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Optional note */}
            {rec.note ? (
              <View style={styles.recNoteWrap}>
                <Text style={styles.recNote}>&ldquo;{rec.note}&rdquo;</Text>
              </View>
            ) : null}

            {/* Meta: rating + compat */}
            {(rec.extRating || rec.compatScore !== undefined) ? (
              <View style={styles.recMeta}>
                {rec.extRating ? (
                  <View style={styles.recRatingBadge}>
                    <Text style={styles.recRatingText}>★ {rec.extRating}</Text>
                  </View>
                ) : null}
                {rec.compatScore !== undefined ? (
                  <View style={[styles.recCompatBadge, { backgroundColor: compatColor(rec.compatScore) + '1A' }]}>
                    <Text style={[styles.recCompatText, { color: compatColor(rec.compatScore) }]}>
                      {compatEmoji(rec.compatScore)} {rec.compatScore}% match
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {/* Footer: tap hint + watchlist button for received recs */}
            <View style={styles.recFooter}>
              <Text style={styles.recTapHintText}>Synopsis & cast →</Text>
              {!isMine ? (
                <Pressable
                  style={[styles.recWatchlistBtn, savedToWatchlist && styles.recWatchlistBtnSaved]}
                  onPress={handleSaveToWatchlist}
                  disabled={savedToWatchlist || addLibraryItem.isPending}
                  hitSlop={8}>
                  <Text style={[styles.recWatchlistBtnText, savedToWatchlist && styles.recWatchlistBtnTextSaved]}>
                    {addLibraryItem.isPending ? '…' : savedToWatchlist ? '✓ Saved' : '+ Watchlist'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        ) : chatImage ? (
          /* ── Photo bubble ── */
          <Image
            source={{ uri: chatImage.url }}
            style={[
              styles.photoImage,
              chatImage.width > 0 && chatImage.height > 0
                ? { aspectRatio: chatImage.width / chatImage.height }
                : undefined,
            ]}
            resizeMode="cover"
          />
        ) : gifUrl ? (
          /* ── GIF bubble ── */
          <Image source={{ uri: gifUrl }} style={styles.gifImage} resizeMode="cover" />
        ) : (
          /* ── Plain text bubble ── */
          <View style={[styles.bubble, isMine && styles.bubbleMine]}>
            {isSpoiler && message.ep_season != null ? (
              <Text style={[styles.epTag, isMine && styles.epTagMine]}>
                {message.post_type === 'read'
                  ? `Chapter ${message.ep_episode}`
                  : `S${message.ep_season}E${message.ep_episode}`}
              </Text>
            ) : null}
            <Text style={[styles.text, isMine && styles.textMine]}>{message.content}</Text>
          </View>
        )}

        <Text style={styles.time}>{timeAgo(message.created_at)}</Text>
      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    group: { flexDirection: 'row', gap: 9, alignItems: 'flex-end' },
    groupMine: { flexDirection: 'row-reverse' },
    col: { gap: 3, maxWidth: '80%' },
    colMine: { alignItems: 'flex-end' },
    sender: { fontSize: 11, color: Brand.muted, fontFamily: BrandFonts.interMedium, paddingHorizontal: 4 },

    // Plain bubble
    bubble: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    bubbleMine: {
      backgroundColor: Brand.trust,
      borderColor: Brand.trust,
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 4,
    },
    epTag: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.trust,
      marginBottom: 3,
    },
    epTagMine: { color: '#fff' },
    text: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.ink, lineHeight: 19 },
    textMine: { color: '#fff' },
    time: { fontSize: 10.5, color: Brand.muted, paddingHorizontal: 4 },

    // Spoiler bubble
    spoilerBubble: {
      backgroundColor: Brand.ink,
      borderRadius: 18,
      borderBottomLeftRadius: 4,
      paddingHorizontal: 13,
      paddingVertical: 10,
    },
    spoilerText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: '#fff',
    },

    // Story reply card
    storyReplyCard: {
      minWidth: 210,
      maxWidth: 280,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    storyReplyPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.tlight,
    },
    storyReplyPoster: {
      width: 36,
      height: 50,
      borderRadius: 6,
      backgroundColor: Brand.border,
    },
    storyReplyInfo: { flex: 1, minWidth: 0 },
    storyReplyLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 10.5,
      color: Brand.muted,
      marginBottom: 2,
    },
    storyReplyTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.ink,
    },
    storyReplyBubble: {
      borderRadius: 0,
      borderWidth: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    },

    // Rec card
    recCard: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
      minWidth: 210,
    },
    recHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    recPill: {
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 7,
    },
    recPillText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    recHeaderLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
    },
    recBody: {
      flexDirection: 'row',
      padding: 11,
      gap: 11,
      alignItems: 'flex-start',
    },
    recPoster: {
      width: 48,
      height: 66,
      borderRadius: 8,
      backgroundColor: Brand.border,
    },
    recPosterFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    recInfo: { flex: 1, minWidth: 0, justifyContent: 'center' },
    recTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
      lineHeight: 19,
      marginBottom: 3,
    },
    recSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      lineHeight: 16,
    },
    recNoteWrap: {
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    recNote: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12.5,
      color: '#555',
      lineHeight: 17,
    },
    recMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 11,
      paddingTop: 8,
      paddingBottom: 4,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      flexWrap: 'wrap',
    },
    recRatingBadge: {
      backgroundColor: '#FFF8E6',
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    recRatingText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: '#D4860A',
    },
    recCompatBadge: {
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    recCompatText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
    },
    recFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      backgroundColor: Brand.paper,
    },
    recTapHintText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.trust,
    },
    recWatchlistBtn: {
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    recWatchlistBtnSaved: {
      backgroundColor: '#E8F7EE',
    },
    recWatchlistBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.trust,
    },
    recWatchlistBtnTextSaved: {
      color: '#2E9E5B',
    },

    // Photo bubble
    photoImage: {
      width: 240,
      borderRadius: 14,
      backgroundColor: Brand.border,
    },

    // GIF bubble
    gifImage: {
      width: 220,
      height: 160,
      borderRadius: 14,
      backgroundColor: Brand.border,
    },
  });
}
