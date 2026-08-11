import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import * as Haptics from 'expo-haptics';
import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts } from '@/constants/theme';
import {
  usePremiere,
  usePremiereMessages,
  usePremiereMembers,
  useJoinPremiere,
  useInviteToPremiere,
  useSendPremiereMessage,
  useEndPremiere,
  useIsCoHost,
  usePremiereCoHosts,
  useMessageReactions,
  useToggleReaction,
  type PremiereMessage,
} from '@/features/premieres/api';
import { useAddLibraryItem } from '@/features/library/api';
import { useCreatePost } from '@/features/feed/api';
import { useDmThreads } from '@/features/dms/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const QUICK_EMOJIS = ['😂', '😱', '🔥', '❤️', '💀', '🤯', '👏', '😭', '😍', '🍿'];

function formatRelativeTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PremiereLive() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string; fromWaiting?: string }>();
  const insets = useSafeAreaInsets();

  const { data: premiere, isLoading: premiereLoading, isError: premiereError } = usePremiere(params.id ?? null);
  const { data: initialMessages = [], isSuccess: messagesLoaded } = usePremiereMessages(params.id ?? null);
  const joinPremiere = useJoinPremiere();
  const sendMsg = useSendPremiereMessage();
  const endPremiere = useEndPremiere();
  const [viewerCount, setViewerCount] = useState(0);

  const [spoilerGate, setSpoilerGate] = useState(params.fromWaiting !== 'true');
  const [messages, setMessages] = useState<PremiereMessage[]>([]);
  const [text, setText] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [showNowWatching, setShowNowWatching] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const { threads: dmThreads } = useDmThreads();
  const { data: currentMembers = [] } = usePremiereMembers(params.id ?? null);
  const inviteToPremiere = useInviteToPremiere();
  const { data: reactionsMap = {} } = useMessageReactions(params.id ?? null);
  const toggleReaction = useToggleReaction();

  const isHost = premiere?.host_user_id === user?.id;
  const isCoHost = useIsCoHost(params.id ?? null);
  const isHostOrCoHost = isHost || isCoHost;
  const { data: cohosts = [] } = usePremiereCoHosts(params.id ?? null);
  const coHostIds = new Set(cohosts.filter((c) => c.status === 'accepted').map((c) => c.user_id));
  const isEnded = premiere?.status === 'ended';
  const addLibraryItem = useAddLibraryItem();
  const createPost = useCreatePost();
  const autoPostedRef = useRef(false);
  const [quickRating, setQuickRating] = useState<number | null>(null);
  const [rated, setRated] = useState(false);

  // Join on mount
  useEffect(() => {
    if (params.id) joinPremiere.mutate(params.id);
  }, [params.id]);

  // Auto-post to feed when the party ends — once per session, for every member
  useEffect(() => {
    if (!isEnded || !premiere || autoPostedRef.current) return;
    autoPostedRef.current = true;
    const episodeSub = premiere.season_number && premiere.episode_number
      ? `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`
      : premiere.episode_name ?? undefined;
    createPost.mutate({
      type: 'tv',
      title: premiere.show_title,
      sub: episodeSub,
      poster: premiere.show_poster ?? undefined,
      externalId: premiere.external_id ?? undefined,
      note: '🎬 Watch party',
    });
  }, [isEnded, premiere]);

  // Seed messages from DB — re-runs whenever fresh data arrives so rejoining
  // always shows the full history, not a stale snapshot from the first visit.
  useEffect(() => {
    if (!messagesLoaded) return;
    setMessages((prev) => {
      // Keep any realtime-only messages that haven't been persisted yet
      const dbIds = new Set(initialMessages.map((m) => m.id));
      const realtimeOnly = prev.filter((m) => !dbIds.has(m.id));
      const merged = [...initialMessages, ...realtimeOnly].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      return merged;
    });
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
  }, [initialMessages]);

  // Realtime: new live messages
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`live-msgs-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'premiere_messages',
          filter: `premiere_id=eq.${params.id}`,
        },
        (payload) => {
          const msg = payload.new as PremiereMessage;
          if (msg.relative_ms !== null) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              if (msg.user_id !== user?.id) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  // Realtime: presence — tracks who is actually in the room right now
  useEffect(() => {
    if (!params.id || !user?.id) return;
    const channel = supabase.channel(`live-presence-${params.id}`, {
      config: { presence: { key: user.id } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setViewerCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: user.id });
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [params.id, user?.id]);

  // Realtime: reaction changes
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`live-reactions-${params.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'premiere_message_reactions', filter: `premiere_id=eq.${params.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['premiere-reactions', params.id] });
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  function handleSend() {
    if (!text.trim() || !params.id) return;
    const relativeMs = premiere?.live_started_at
      ? Date.now() - new Date(premiere.live_started_at).getTime()
      : 0;
    const content = text.trim();
    setText('');
    const optimistic: PremiereMessage = {
      id: `optimistic-${Date.now()}`,
      premiere_id: params.id,
      user_id: user?.id ?? '',
      user_name: premiere?.host_name ?? 'You',
      user_avatar_url: null,
      content,
      relative_ms: relativeMs,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    sendMsg.mutate({ premiereId: params.id, content, relativeMs }, {
      onError: () => setMessages((prev) => prev.filter((m) => m.id !== optimistic.id)),
    });
  }

  function handleEnd() {
    Alert.alert(
      'End Premiere?',
      'This will close the live chat for everyone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End it',
          style: 'destructive',
          onPress: () => endPremiere.mutate(params.id!),
        },
      ],
    );
  }

  // Ended state
  if (isEnded) {
    const episodeSub = `S${premiere?.season_number}E${premiere?.episode_number}${premiere?.episode_name ? ` · ${premiere.episode_name}` : ''}`;

    function handleStarPress(star: number) {
      setQuickRating(star);
      if (!premiere) return;
      // addLibraryItem stores the rating; the feed post is already created
      // by the auto-post effect above with the watch party note.
      addLibraryItem.mutate({
        intent: 'log',
        type: 'tv',
        title: premiere.show_title,
        sub: episodeSub,
        poster: premiere.show_poster ?? undefined,
        externalId: premiere.external_id ?? undefined,
        rating: star,
      }, {
        onSuccess: () => setRated(true),
      });
    }

    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.endedContainer}>
          <Text style={styles.endedTitle}>That's a wrap! 🎬</Text>
          <Text style={styles.endedSub}>{premiere?.show_title} · {episodeSub}</Text>

          {rated ? (
            <View style={styles.ratedConfirm}>
              <Text style={styles.ratedStars}>
                {Array.from({ length: quickRating ?? 0 }).map(() => '★').join('')}
                {Array.from({ length: 5 - (quickRating ?? 0) }).map(() => '☆').join('')}
              </Text>
              <Text style={styles.ratedConfirmText}>Logged!</Text>
              <Pressable
                onPress={() => router.push({
                  pathname: '/log-modal',
                  params: {
                    prefillTitle: premiere?.show_title,
                    prefillType: 'tv',
                    prefillSub: episodeSub,
                    prefillPoster: premiere?.show_poster ?? '',
                    prefillExternalId: premiere?.external_id ?? '',
                  },
                })}
                hitSlop={16}>
                <Text style={styles.addNoteText}>Add a note →</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.starContainer}>
              <Text style={styles.starPrompt}>How was it?</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable key={star} onPress={() => handleStarPress(star)} hitSlop={8}>
                    <Text style={[styles.star, quickRating !== null && star <= quickRating && styles.starFilled]}>
                      {quickRating !== null && star <= quickRating ? '★' : '☆'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Pressable
                onPress={() => router.push({
                  pathname: '/log-modal',
                  params: {
                    prefillTitle: premiere?.show_title,
                    prefillType: 'tv',
                    prefillSub: episodeSub,
                    prefillPoster: premiere?.show_poster ?? '',
                    prefillExternalId: premiere?.external_id ?? '',
                  },
                })}
                hitSlop={16}>
                <Text style={styles.addNoteText}>Add a note instead →</Text>
              </Pressable>
            </View>
          )}

          <Pressable style={styles.leaveEndedBtn} onPress={() => router.back()}>
            <Text style={styles.leaveEndedText}>Leave</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (spoilerGate) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.gateContainer}>
          <Text style={styles.gateEmoji}>🙈</Text>
          <Text style={styles.gateTitle}>Spoilers ahead</Text>
          <Text style={styles.gateSub}>
            This watch party is live. If you haven't caught up on{'\n'}
            <Text style={styles.gateShow}>{premiere?.show_title ?? 'the episode'}</Text>
            {premiere ? ` S${premiere.season_number}E${premiere.episode_number}` : ''}, you may see spoilers.
          </Text>
          <Pressable style={styles.gateEnterBtn} onPress={() => setSpoilerGate(false)}>
            <Text style={styles.gateEnterText}>I'm caught up — enter</Text>
          </Pressable>
          <Pressable style={styles.gateBackBtn} onPress={() => router.back()} hitSlop={16}>
            <Text style={styles.gateBackText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!premiereLoading && (premiereError || !premiere)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ fontSize: 36, marginBottom: 16 }}>📺</Text>
          <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 18, color: '#0A0A0F', marginBottom: 8, textAlign: 'center' }}>Watch party not found</Text>
          <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>This watch party may have ended or the link is no longer valid.</Text>
          <Pressable onPress={() => router.back()} style={{ backgroundColor: '#5B4FE8', borderRadius: 12, paddingVertical: 11, paddingHorizontal: 24 }}>
            <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' }}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingWrapper>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>● LIVE</Text>
          </View>
          <View style={{ flex: 1, marginHorizontal: 10 }}>
            <Text style={styles.title} numberOfLines={1}>{premiere?.show_title}</Text>
            <Text style={styles.viewerCount} numberOfLines={1}>
              S{premiere?.season_number}E{premiere?.episode_number}
              {premiere?.episode_name ? ` · ${premiere.episode_name}` : ''}
              {viewerCount > 0 ? `  ·  ${viewerCount} watching` : ''}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={16}>
              <Text style={styles.addBtn}>＋</Text>
            </Pressable>
            {isHostOrCoHost ? (
              <>
                <Pressable onPress={() => router.back()} hitSlop={16}>
                  <Text style={styles.leaveText}>Back</Text>
                </Pressable>
                <Pressable onPress={handleEnd} style={styles.endBtn}>
                  <Text style={styles.endBtnText}>End</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Text style={styles.leaveText}>Leave</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Now watching card */}
        {showNowWatching && premiere && (
          <View style={styles.nowWatchingCard}>
            {premiere.show_poster ? (
              <Image
                source={{ uri: premiere.show_poster }}
                style={styles.nowWatchingPoster}
              />
            ) : (
              <View style={[styles.nowWatchingPoster, styles.nowWatchingPosterFallback]}>
                <Text style={{ fontSize: 16 }}>📺</Text>
              </View>
            )}
            <View style={styles.nowWatchingInfo}>
              <Text style={styles.nowWatchingLabel}>NOW WATCHING</Text>
              <Text style={styles.nowWatchingTitle} numberOfLines={1}>{premiere.show_title}</Text>
              <Text style={styles.nowWatchingSub} numberOfLines={1}>
                S{premiere.season_number}E{premiere.episode_number}
                {premiere.episode_name ? ` · ${premiere.episode_name}` : ''}
              </Text>
            </View>
            <Pressable onPress={() => setShowNowWatching(false)} hitSlop={12} style={styles.nowWatchingClose}>
              <Text style={styles.nowWatchingCloseText}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => {
            if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: false });
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>Chat is open — say something! 🍿</Text>
          }
          renderItem={({ item }) => {
            const isMine = item.user_id === user?.id;
            const msgReactions = reactionsMap[item.id] ?? {};
            const reactionEntries = Object.entries(msgReactions);
            return (
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                {!isMine && (
                  <Avatar name={item.user_name} size={28} avatarUrl={item.user_avatar_url} />
                )}
                <View style={{ maxWidth: '75%' }}>
                  <Pressable
                    onLongPress={() => setReactionTarget(item.id)}
                    delayLongPress={350}
                    style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}
                  >
                    {!isMine && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                        <Text style={styles.bubbleName}>{item.user_name}</Text>
                        {item.user_id === premiere?.host_user_id && (
                          <Text style={styles.hostBadge}>HOST</Text>
                        )}
                        {coHostIds.has(item.user_id) && (
                          <Text style={styles.coHostBadge}>CO-HOST</Text>
                        )}
                      </View>
                    )}
                    <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                    {item.relative_ms !== null && (
                      <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                        {formatRelativeTime(item.relative_ms)}
                      </Text>
                    )}
                  </Pressable>
                  {reactionEntries.length > 0 && (
                    <View style={[styles.reactionRow, isMine && styles.reactionRowMine]}>
                      {reactionEntries.map(([emoji, { count, mine }]) => (
                        <Pressable
                          key={emoji}
                          style={[styles.reactionPill, mine && styles.reactionPillMine]}
                          onPress={() => toggleReaction.mutate({
                            messageId: item.id,
                            premiereId: params.id!,
                            emoji,
                            isCurrentlyMine: mine,
                          })}
                        >
                          <Text style={styles.reactionEmoji}>{emoji}</Text>
                          {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={[styles.inputWrap, { paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 10 }]}>
          {showEmojiBar && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.emojiBar}
              contentContainerStyle={styles.emojiBarContent}
            >
              {QUICK_EMOJIS.map((emoji) => (
                <Pressable
                  key={emoji}
                  style={styles.emojiBarBtn}
                  onPress={() => setText((t) => t + emoji)}
                >
                  <Text style={styles.emojiBarEmoji}>{emoji}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <View style={styles.inputRow}>
            <Pressable style={styles.emojiToggleBtn} onPress={() => setShowEmojiBar((v) => !v)}>
              <Text style={styles.emojiToggleText}>{showEmojiBar ? '⌨️' : '😊'}</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              placeholder="Say something…"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={text}
              onChangeText={setText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={handleSend} disabled={!text.trim()}>
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          </View>
        </View>

      </KeyboardAvoidingWrapper>

      {/* Reaction picker */}
      <Modal visible={reactionTarget !== null} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <Pressable style={styles.reactionBackdrop} onPress={() => setReactionTarget(null)}>
          <View style={styles.reactionPicker}>
            {QUICK_EMOJIS.map((emoji) => {
              const mine = reactionTarget ? (reactionsMap[reactionTarget]?.[emoji]?.mine ?? false) : false;
              return (
                <Pressable
                  key={emoji}
                  style={[styles.reactionPickerBtn, mine && styles.reactionPickerBtnMine]}
                  onPress={() => {
                    if (!reactionTarget || !params.id) return;
                    toggleReaction.mutate({ messageId: reactionTarget, premiereId: params.id, emoji, isCurrentlyMine: mine });
                    setReactionTarget(null);
                  }}
                >
                  <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.inviteBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.inviteSheet} onPress={() => {}}>
            <View style={styles.inviteGrabber} />
            <Text style={styles.inviteTitle}>Invite friends</Text>
            <FlatList
              data={dmThreads.filter((t) => !currentMembers.some((m) => m.user_id === t.friendId))}
              keyExtractor={(t) => t.friendId}
              style={styles.inviteList}
              renderItem={({ item }) => {
                const sent = invitedIds.has(item.friendId);
                return (
                  <Pressable
                    style={styles.inviteRow}
                    onPress={async () => {
                      if (sent || !params.id || !premiere) return;
                      await inviteToPremiere.mutateAsync({ premiereId: params.id, friendId: item.friendId, showTitle: premiere.show_title });
                      setInvitedIds((prev) => new Set([...prev, item.friendId]));
                    }}>
                    <Avatar name={item.name} size={36} avatarUrl={item.avatarUrl} />
                    <Text style={styles.inviteName}>{item.name}</Text>
                    <Text style={[styles.inviteAction, sent && styles.inviteActionSent]}>
                      {sent ? '✓ Invited' : 'Invite'}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.inviteEmpty}>No friends yet.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F0D1A' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  liveBadgeText: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 10,
    color: '#fff',
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 14,
    color: '#fff',
  },
  viewerCount: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 1,
  },
  endBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  endBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
  leaveText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
  addBtn: { fontFamily: BrandFonts.syneBold, fontSize: 22, color: 'rgba(255,255,255,0.7)' },
  inviteBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  inviteSheet: { backgroundColor: '#1A1826', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 40, maxHeight: '70%' },
  inviteGrabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginBottom: 16 },
  inviteTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff', textAlign: 'center', marginBottom: 12 },
  inviteList: { paddingHorizontal: 16 },
  inviteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
  inviteName: { flex: 1, fontFamily: BrandFonts.interRegular, fontSize: 15, color: '#fff' },
  inviteAction: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#7C3AED' },
  inviteActionSent: { color: 'rgba(255,255,255,0.35)' },
  inviteEmpty: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 24 },

  // Messages
  messageList: { padding: 16, gap: 10, flexGrow: 1 },
  messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  messageRowMine: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  bubbleOther: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderTopLeftRadius: 4,
  },
  bubbleMine: {
    backgroundColor: '#7C3AED',
    borderBottomRightRadius: 4,
  },
  bubbleName: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: '#A78BFA',
  },
  hostBadge: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 9,
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.5,
    overflow: 'hidden',
  },
  coHostBadge: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 9,
    color: '#1D4ED8',
    backgroundColor: '#DBEAFE',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.5,
    overflow: 'hidden',
  },
  bubbleText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 10,
    color: 'rgba(255,255,255,0.35)',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.5)' },
  emptyText: {
    textAlign: 'center',
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 60,
  },

  // Input bar
  inputWrap: {
    backgroundColor: '#1A1826',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14.5,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },

  // Now watching card
  nowWatchingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  nowWatchingPoster: {
    width: 36,
    height: 54,
    borderRadius: 6,
  },
  nowWatchingPosterFallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nowWatchingInfo: {
    flex: 1,
    gap: 2,
  },
  nowWatchingLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 9,
    color: '#A78BFA',
    letterSpacing: 1,
  },
  nowWatchingTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 13,
    color: '#fff',
  },
  nowWatchingSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
  },
  nowWatchingClose: {
    padding: 4,
  },
  nowWatchingCloseText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
  },

  // Emoji bar
  emojiBar: {
    marginBottom: 8,
  },
  emojiBarContent: {
    gap: 6,
    paddingHorizontal: 2,
  },
  emojiBarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBarEmoji: { fontSize: 20 },
  emojiToggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiToggleText: { fontSize: 20 },

  // Reactions
  reactionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 4,
    marginLeft: 4,
  },
  reactionRowMine: {
    justifyContent: 'flex-end',
    marginLeft: 0,
    marginRight: 4,
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  reactionPillMine: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: '#7C3AED',
  },
  reactionEmoji: { fontSize: 13 },
  reactionCount: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
  },

  // Reaction picker modal
  reactionBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#1A1826',
    borderRadius: 20,
    padding: 12,
    gap: 8,
    maxWidth: 280,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  reactionPickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  reactionPickerBtnMine: {
    backgroundColor: 'rgba(124,58,237,0.35)',
  },
  reactionPickerEmoji: { fontSize: 24 },

  // Spoiler gate
  gateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  gateEmoji: { fontSize: 52, marginBottom: 20 },
  gateTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 26,
    color: '#fff',
    marginBottom: 14,
    textAlign: 'center',
  },
  gateSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  gateShow: {
    fontFamily: BrandFonts.syneBold,
    color: 'rgba(255,255,255,0.8)',
  },
  gateEnterBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 14,
  },
  gateEnterText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  gateBackBtn: { paddingVertical: 10 },
  gateBackText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.35)',
  },

  // Ended state
  endedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 32,
  },
  endedTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  endedSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  starContainer: { alignItems: 'center', gap: 16 },
  starPrompt: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
  },
  starRow: { flexDirection: 'row', gap: 8 },
  star: {
    fontSize: 40,
    color: 'rgba(255,255,255,0.2)',
  },
  starFilled: { color: '#F59E0B' },
  addNoteText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: '#7C3AED',
    marginTop: 4,
  },
  ratedConfirm: { alignItems: 'center', gap: 8 },
  ratedStars: { fontSize: 36, color: '#F59E0B', letterSpacing: 4 },
  ratedConfirmText: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: '#fff',
  },
  leaveEndedBtn: { paddingVertical: 14 },
  leaveEndedText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
