import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import type { Message } from '@/features/chats/api';
import { parseRec } from '@/features/dms/rec';
import { timeAgo } from '@/features/feed/time-ago';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
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

  const rec = parseRec(message.content);

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

            {/* Footer: tap hint */}
            <View style={styles.recFooter}>
              <Text style={styles.recTapHintText}>Synopsis & cast →</Text>
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
  });
}
