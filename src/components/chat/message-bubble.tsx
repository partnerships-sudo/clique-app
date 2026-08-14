import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import type { Message } from '@/features/chats/api';
import { useMarkRecSeen } from '@/features/chats/api';
import { parseChatImage } from '@/features/chat-media/upload';
import { parseRec } from '@/features/dms/rec';
import { parseStoryReply } from '@/features/dms/story-reply';
import { parseWatchPartyInvite } from '@/features/dms/watch-party-invite';
import { timeAgo } from '@/features/feed/time-ago';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useAddLibraryItem } from '@/features/library/api';
import { useLists, useAddToList } from '@/features/lists/api';
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
  const addToList = useAddToList();
  const { data: myLists = [] } = useLists();
  const [savedToWatchlist, setSavedToWatchlist] = useState(false);
  const markRecSeen = useMarkRecSeen();

  function handleSaveOptions() {
    if (!rec || savedToWatchlist) return;
    const options = [
      '+ Watchlist',
      ...myLists.map((l) => `+ "${l.title}"`),
      'Cancel',
    ];
    Alert.alert('Add to…', rec.title, options.map((label, i) => ({
      text: label,
      style: i === options.length - 1 ? 'cancel' as const : 'default' as const,
      onPress: i === options.length - 1 ? undefined : async () => {
        if (i === 0) {
          // Watchlist
          try {
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
          } catch {
            Alert.alert('Could not save', 'Failed to add to watchlist.');
          }
        } else {
          // A specific list
          const list = myLists[i - 1];
          try {
            await addToList.mutateAsync({
              list_id: list.id,
              library_item_id: null,
              title: rec.title,
              sub: rec.sub ?? null,
              poster: rec.poster ?? null,
              type: rec.type ?? null,
            });
            Alert.alert('Added!', `"${rec.title}" added to ${list.title}.`);
          } catch {
            Alert.alert('Could not save', 'Failed to add to list.');
          }
        }
      },
    })));
  }

  const storyReply = parseStoryReply(message.content);
  const rec = storyReply ? null : parseRec(message.content);
  const watchPartyInvite = (!storyReply && !rec) ? parseWatchPartyInvite(message.content) : null;
  const chatImage = (!storyReply && !rec && !watchPartyInvite) ? parseChatImage(message.content) : null;
  const premiereId = (() => {
    if (storyReply || rec || watchPartyInvite || chatImage) return null;
    const m = message.content.match(/thecliqueapp:\/\/premiere\/([a-zA-Z0-9_-]+)/);
    return m ? m[1] : null;
  })();
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
          hitSlop={16}>
          <Avatar name={message.user_name} size={30} avatarUrl={avatarUrl} />
        </Pressable>
      ) : null}
      <View style={[styles.col, isMine && styles.colMine]}>
        {!isMine ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={styles.sender}>{userHandle ?? message.user_name}</Text>
            {!!message.user_verified_tier && <VerifiedBadge tier={message.user_verified_tier} size={11} />}
          </View>
        ) : null}

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
            onPress={() => {
              // Recipient tapping the card = "seen"
              if (!isMine && !message.rec_read_at) {
                markRecSeen.mutate(message.id);
              }
              router.push({
                pathname: '/content-detail-modal',
                params: {
                  title: rec.title,
                  type: rec.type,
                  poster: rec.poster,
                  sub: rec.sub,
                  mediaType: rec.mediaType ?? (rec.sub?.includes('Film') ? 'movie' : rec.sub?.includes('TV') ? 'tv' : undefined),
                },
              });
            }}>
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
                  onPress={handleSaveOptions}
                  disabled={savedToWatchlist || addLibraryItem.isPending || addToList.isPending}
                  hitSlop={16}>
                  <Text style={[styles.recWatchlistBtnText, savedToWatchlist && styles.recWatchlistBtnTextSaved]}>
                    {(addLibraryItem.isPending || addToList.isPending) ? '…' : savedToWatchlist ? '✓ Saved' : '+ Add to…'}
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
        ) : watchPartyInvite ? (
          /* ── Rich watch party invite card ── */
          <Pressable
            style={styles.wpInviteCard}
            onPress={() =>
              router.push({ pathname: '/party-detail-modal', params: { id: watchPartyInvite.id } })
            }>
            <View style={styles.wpInviteTop}>
              {watchPartyInvite.poster ? (
                <Image source={{ uri: watchPartyInvite.poster }} style={styles.wpInvitePoster} resizeMode="cover" />
              ) : (
                <View style={[styles.wpInvitePoster, styles.wpInvitePosterFallback]}>
                  <Text style={{ fontSize: 28 }}>🎬</Text>
                </View>
              )}
              <View style={styles.wpInviteInfo}>
                <View style={styles.wpInvitePill}>
                  <Text style={styles.wpInvitePillText}>WATCH PARTY</Text>
                </View>
                <Text style={styles.wpInviteTitle} numberOfLines={2}>{watchPartyInvite.title}</Text>
                {watchPartyInvite.episode ? (
                  <Text style={styles.wpInviteEpisode} numberOfLines={1}>{watchPartyInvite.episode}</Text>
                ) : null}
                {watchPartyInvite.tagline ? (
                  <Text style={styles.wpInviteTagline} numberOfLines={1}>"{watchPartyInvite.tagline}"</Text>
                ) : null}
                {watchPartyInvite.date ? (
                  <Text style={styles.wpInviteDate}>📅 {new Date(watchPartyInvite.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'numeric', day: 'numeric', year: 'numeric' })}{watchPartyInvite.time ? ` · ${watchPartyInvite.time}` : ''}</Text>
                ) : null}
                <Text style={styles.wpInviteHost}>Hosted by {watchPartyInvite.hostName}</Text>
              </View>
            </View>
            <View style={styles.wpInviteJoinBtn}>
              <Text style={styles.wpInviteJoinText}>View watch party →</Text>
            </View>
          </Pressable>
        ) : premiereId ? (
          /* ── Watch party invite card ── */
          <Pressable
            style={styles.premiereCard}
            onPress={() =>
              router.push({ pathname: '/premiere-waiting-room', params: { id: premiereId } })
            }>
            <View style={styles.premiereHeader}>
              <Text style={styles.premiereEmoji}>🎬</Text>
              <Text style={styles.premiereLabel}>Watch Party Invite</Text>
            </View>
            <Text style={styles.premiereBody} numberOfLines={3}>
              {message.content.replace(/\n*thecliqueapp:\/\/premiere\/[a-zA-Z0-9_-]+/, '').trim()}
            </Text>
            <View style={styles.premiereFooter}>
              <Text style={styles.premiereJoin}>Tap to join →</Text>
            </View>
          </Pressable>
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
        {/* Rec read receipt — only shown to sender when recipient has tapped the card */}
        {isMine && rec && message.rec_read_at ? (
          <Text style={styles.recSeenLabel}>Seen</Text>
        ) : null}
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
    recSeenLabel: { fontSize: 10.5, color: Brand.trust, paddingHorizontal: 4, fontFamily: BrandFonts.interMedium },

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
      color: Brand.muted,
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
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 8,
    },
    recRatingText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.trust,
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
      backgroundColor: Brand.tlight,
    },
    recWatchlistBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.trust,
    },
    recWatchlistBtnTextSaved: {
      color: Brand.trust,
    },

    // Watch party invite card
    premiereCard: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.trust,
      borderRadius: 16,
      overflow: 'hidden',
      minWidth: 210,
      maxWidth: 280,
    },
    premiereHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      backgroundColor: Brand.tlight,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    premiereEmoji: { fontSize: 16 },
    premiereLabel: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.trust, textTransform: 'uppercase', letterSpacing: 0.5 },
    premiereBody: { fontFamily: BrandFonts.interRegular, fontSize: 13.5, color: Brand.ink, paddingHorizontal: 12, paddingVertical: 10, lineHeight: 19 },
    premiereFooter: {
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      paddingHorizontal: 12,
      paddingVertical: 9,
      backgroundColor: Brand.paper,
    },
    premiereJoin: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },

    // Rich watch party invite card
    wpInviteCard: {
      width: 260,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#0f0f1a',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    wpInviteTop: { flexDirection: 'row', gap: 10, padding: 12 },
    wpInvitePoster: { width: 64, height: 90, borderRadius: 8 },
    wpInvitePosterFallback: { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
    wpInviteInfo: { flex: 1, minWidth: 0, gap: 3 },
    wpInvitePill: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.trust,
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginBottom: 2,
    },
    wpInvitePillText: { fontFamily: BrandFonts.syneBold, fontSize: 8, color: '#fff', letterSpacing: 1 },
    wpInviteTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff', lineHeight: 18 },
    wpInviteEpisode: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.trust },
    wpInviteTagline: { fontFamily: BrandFonts.interRegular, fontStyle: 'italic', fontSize: 11, color: 'rgba(255,255,255,0.55)' },
    wpInviteDate: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#FFD700' },
    wpInviteHost: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: 'rgba(255,255,255,0.5)' },
    wpInviteJoinBtn: {
      backgroundColor: Brand.trust,
      paddingVertical: 10,
      alignItems: 'center',
    },
    wpInviteJoinText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },

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
