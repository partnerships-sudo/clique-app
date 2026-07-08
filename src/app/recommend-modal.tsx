import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useSendDm } from '@/features/dms/api';
import { useFeedPosts } from '@/features/feed/api';
import { computeCompatibility } from '@/features/friends/compatibility';
import { useFriends } from '@/features/friends/api';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬',
  read: '📚',
  play: '🎮',
  listen: '🎵',
  podcast: '🎙️',
};

export default function RecommendModal() {
  const params = useLocalSearchParams<{
    title?: string; sub?: string; type?: string; poster?: string; extRating?: string;
  }>();
  const { user } = useSession();
  const { data: profile } = useProfile();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: friends } = useFriends();
  const sendDm = useSendDm();
  const { allPosts } = useFeedPosts('all');

  const compatScores = useMemo(() => {
    const map = new Map<string, number>();
    if (!user?.id) return map;
    const myPosts = allPosts.filter((p) => p.user_id === user.id);
    const byUser = new Map<string, typeof allPosts>();
    for (const p of allPosts) {
      if (p.user_id === user.id) continue;
      const bucket = byUser.get(p.user_id) ?? [];
      bucket.push(p);
      byUser.set(p.user_id, bucket);
    }
    for (const [uid, uPosts] of byUser) {
      map.set(uid, computeCompatibility(myPosts, uPosts));
    }
    return map;
  }, [allPosts, user?.id]);

  const [note, setNote] = useState('');
  const [sent, setSent] = useState(new Set<string>());
  const [sending, setSending] = useState<string | null>(null);

  const emoji = TYPE_EMOJI[params.type ?? ''] ?? '🔗';

  async function handleSend(friendId: string) {
    if (sent.has(friendId) || sending) return;
    setSending(friendId);

    const compatScore = compatScores.get(friendId);
    const senderName = profile?.full_name ?? profile?.username ?? 'A friend';
    const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    const payload = JSON.stringify({
      __rec: 1,
      title: params.title,
      type: params.type,
      sub: params.sub || undefined,
      poster: params.poster || undefined,
      note: note.trim() || undefined,
      extRating: params.extRating || undefined,
      compatScore,
    });

    try {
      await sendDm.mutateAsync({ friendId, content: payload });

      const { error: libError } = await supabase.from('library').insert({
        user_id: friendId,
        type: params.type,
        title: params.title,
        sub: params.sub || null,
        poster: params.poster || null,
        ext_rating: params.extRating || null,
        note: note.trim() || null,
        status: 'watchlist',
        rec_from_user_name: senderName,
        rec_compat_score: compatScore ?? null,
        date: dateLabel,
      });
      if (libError) {
        console.error('[rec] library insert failed:', libError.code, libError.message, libError.details);
      }

      setSent((prev) => new Set([...prev, friendId]));
    } finally {
      setSending(null);
    }
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBody}>
          <Text style={styles.heading} numberOfLines={1}>
            {emoji} Send a rec
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {params.title}
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      {/* Note */}
      <View style={styles.noteWrap}>
        <TextInput
          style={styles.noteInput}
          placeholder="Add a note… (optional)"
          placeholderTextColor={Brand.muted}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={200}
        />
      </View>

      {/* Friend list */}
      <Text style={styles.sectionLabel}>Send to</Text>
      <ScrollView
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">
        {(friends ?? []).length === 0 ? (
          <Text style={styles.empty}>Add friends to send recommendations.</Text>
        ) : null}
        {(friends ?? []).map((friend) => {
          const isSent = sent.has(friend.id);
          const isSending = sending === friend.id;
          return (
            <View key={friend.id} style={styles.friendRow}>
              <Avatar
                name={friend.full_name ?? friend.username ?? 'F'}
                size={42}
                avatarUrl={friend.avatar_url}
              />
              <View style={styles.friendBody}>
                <Text style={styles.friendName} numberOfLines={1}>
                  {friend.full_name ?? friend.username ?? 'Friend'}
                </Text>
                {friend.username ? (
                  <Text style={styles.friendSub}>@{friend.username}</Text>
                ) : null}
              </View>
              <Pressable
                style={[styles.sendBtn, isSent && styles.sendBtnSent]}
                onPress={() => handleSend(friend.id)}
                disabled={isSent || !!sending}>
                {isSending ? (
                  <ActivityIndicator color={Brand.trust} size="small" style={{ width: 44 }} />
                ) : (
                  <Text style={[styles.sendBtnText, isSent && styles.sendBtnTextSent]}>
                    {isSent ? '✓ Sent' : 'Send'}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingTop: 20,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    headerBody: { flex: 1, minWidth: 0, marginRight: 12 },
    heading: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.ink,
      marginBottom: 2,
    },
    sub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
    },
    done: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.trust,
    },
    noteWrap: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    noteInput: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      minHeight: 40,
      textAlignVertical: 'top',
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: Spacing.three,
      paddingTop: 16,
      paddingBottom: 8,
    },
    listContent: { paddingBottom: 40 },
    empty: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', paddingTop: 32, paddingHorizontal: Spacing.three },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: Spacing.three,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    friendBody: { flex: 1, minWidth: 0 },
    friendName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14.5,
      color: Brand.ink,
    },
    friendSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginTop: 1,
    },
    sendBtn: {
      borderRadius: 20,
      paddingVertical: 6,
      paddingHorizontal: 16,
      backgroundColor: Brand.tlight,
    },
    sendBtnSent: {
      backgroundColor: '#E8F7EE',
    },
    sendBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: Brand.trust,
    },
    sendBtnTextSent: {
      color: '#2E9E5B',
    },
  });
}
