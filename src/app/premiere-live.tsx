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
  Share,
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
  useLeavePremiere,
  useTrackPremiereShare,
  useTrackBuyClick,
  useIsCoHost,
  usePremiereCoHosts,
  useMessageReactions,
  useToggleReaction,
  usePremiereTriviaItems,
  useMarkPremiereTriviaFired,
  useSubmitPremiereTriviaResponse,
  usePremiereTriviaResponseCounts,
  type PremiereMessage,
  type TriviaItem,
} from '@/features/premieres/api';
import { useAddLibraryItem } from '@/features/library/api';
import { useCreatePost } from '@/features/feed/api';
import { useDmThreads } from '@/features/dms/api';
import { useSession } from '@/hooks/use-session';
import { useProfile } from '@/features/profile/api';
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
  const { data: profile } = useProfile();
  const isUpperTier = (profile?.verified_tier ?? 0) >= 2;
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ id: string; fromWaiting?: string }>();
  const insets = useSafeAreaInsets();

  const { data: premiere, isLoading: premiereLoading, isError: premiereError } = usePremiere(params.id ?? null);
  const { data: initialMessages = [], isSuccess: messagesLoaded } = usePremiereMessages(params.id ?? null);
  const joinPremiere = useJoinPremiere();
  const leavePremiere = useLeavePremiere();
  const trackShare = useTrackPremiereShare();
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
  const trackBuyClick = useTrackBuyClick();

  // Buy / Rent CTA state
  const hasBuyLink = !!(premiere?.buy_url);
  const [buyPinned, setBuyPinned] = useState(false);   // true once host fires the pin
  const [buyDismissed, setBuyDismissed] = useState(false); // viewer dismissed pill
  const buyPinFiredRef = useRef(false);                 // prevent double-fire
  const showBuyPill = hasBuyLink && !buyDismissed && (buyPinned || isHostOrCoHost);

  // Trivia & polls
  const { data: triviaItems = [] } = usePremiereTriviaItems(params.id ?? null);
  const markTriviaFired = useMarkPremiereTriviaFired();
  const submitTriviaResponse = useSubmitPremiereTriviaResponse();
  const [activeTriviaCard, setActiveTriviaCard] = useState<TriviaItem | null>(null);
  const [triviaMyAnswer, setTriviaMyAnswer] = useState<number | null>(null);
  const { data: triviaResponseCounts = {} } = usePremiereTriviaResponseCounts(activeTriviaCard?.id ?? null);

  // Join on mount; stamp left_at on unmount for watch-time analytics
  useEffect(() => {
    if (!params.id) return;
    joinPremiere.mutate(params.id);
    return () => { leavePremiere.mutate(params.id!); };
  }, [params.id]);

  // Host: stamp live_started_at the first time they open the live screen.
  // Watch parties have no explicit "go live" action unlike screening rooms,
  // so we set it here — the trivia timer depends on this value.
  useEffect(() => {
    if (!isHost || !params.id || premiere?.live_started_at) return;
    supabase
      .from('premieres')
      .update({ live_started_at: new Date().toISOString() })
      .eq('id', params.id)
      .then(() => queryClient.invalidateQueries({ queryKey: ['premiere', params.id] }));
  }, [isHost, params.id, premiere?.live_started_at]);

  // Auto-post to feed when the party ends — once per session, for every member
  useEffect(() => {
    if (!isEnded || !premiere || autoPostedRef.current) return;
    autoPostedRef.current = true;
    const episodeSub = premiere.season_number && premiere.episode_number
      ? `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`
      : premiere.episode_name ?? undefined;
    createPost.mutate({
      // TV is watched content: the entry type is 'watch' and mediaType carries
      // the distinction. Writing type:'tv' here produced posts that fell
      // through TypeColors (grey "📝 tv" badge) and were excluded by the
      // feed's `p.type === filterType` category filter.
      type: 'watch',
      mediaType: 'tv',
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

  // Realtime: buy/rent pin broadcast
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`live-buy-pin-${params.id}`)
      .on('broadcast', { event: 'buy_pinned' }, () => {
        setBuyPinned(true);
        setBuyDismissed(false);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  // Trivia timer — host only fires items; everyone listens via broadcast
  useEffect(() => {
    if (!isHost || !premiere?.live_started_at || !params.id) return;
    const startTime = new Date(premiere.live_started_at).getTime();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const next = triviaItems.find((t) => t.trigger_ms <= elapsed && !t.fired_at);
      if (!next) return;
      markTriviaFired.mutate({ id: next.id, premiereId: params.id! });
      if (next.type === 'message') {
        // Send as a regular chat message — appears naturally in the feed
        sendMsg.mutate({ premiereId: params.id!, content: next.question, relativeMs: next.trigger_ms }, {
          onError: () => Alert.alert('Could not send message', 'Check your connection and try again.'),
        });
      } else {
        supabase.channel(`live-trivia-${params.id}`).send({
          type: 'broadcast',
          event: 'trivia_fire',
          payload: next,
        });
        setActiveTriviaCard(next);
        setTriviaMyAnswer(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isHost, premiere?.live_started_at, params.id, triviaItems]);

  // All viewers receive the broadcast
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`live-trivia-${params.id}`)
      .on('broadcast', { event: 'trivia_fire' }, ({ payload }) => {
        if (!isHost) {
          setActiveTriviaCard(payload as TriviaItem);
          setTriviaMyAnswer(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id, isHost]);

  async function handleTriviaAnswer(optionIdx: number) {
    if (!activeTriviaCard || !user?.id || triviaMyAnswer !== null) return;
    setTriviaMyAnswer(optionIdx);
    await submitTriviaResponse.mutateAsync({
      triviaId: activeTriviaCard.id,
      userId: user.id,
      optionIdx,
    });
  }

  async function handlePinBuy() {
    if (!params.id || buyPinFiredRef.current) return;
    buyPinFiredRef.current = true;
    setBuyPinned(true);
    await supabase.channel(`live-buy-pin-${params.id}`).send({
      type: 'broadcast',
      event: 'buy_pinned',
      payload: {},
    });
  }

  function handleBuyPress() {
    if (!premiere?.buy_url) return;
    trackBuyClick.mutate(params.id!);
    // Open URL — Linking is already available via React Native
    const { Linking } = require('react-native');
    Linking.openURL(premiere.buy_url).catch(() => {});
  }

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

  async function handleShare() {
    try {
      await Share.share({ message: `Join my Watch Party on Clique: "${premiere?.show_title}" — clique://premiere/${params.id}` });
      if (params.id) trackShare.mutate(params.id);
    } catch {}
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
        type: 'watch',
        mediaType: 'tv',
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

          {hasBuyLink && premiere?.buy_url && (
            <Pressable style={styles.buyEndedBtn} onPress={handleBuyPress}>
              <Text style={styles.buyEndedIcon}>🛒</Text>
              <Text style={styles.buyEndedText}>{premiere?.buy_label ?? 'Buy / Rent Now'}</Text>
            </Pressable>
          )}
          {isHostOrCoHost && params.id && (
            <Pressable
              style={[styles.leaveEndedBtn, { backgroundColor: 'rgba(255,255,255,0.12)', marginBottom: 0 }]}
              onPress={() => {
                router.back();
                router.push({ pathname: '/watch-party-analytics-modal', params: { premiereId: params.id, showTitle: premiere?.show_title ?? '' } });
              }}>
              <Text style={styles.leaveEndedText}>View Analytics →</Text>
            </Pressable>
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
            <Pressable onPress={handleShare} hitSlop={16}>
              <Text style={styles.addBtn}>↑</Text>
            </Pressable>
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={16}>
              <Text style={styles.addBtn}>＋</Text>
            </Pressable>
            {isHostOrCoHost ? (
              <>
                {isHost && (
                  <Pressable
                    onPress={() => router.push({ pathname: '/trivia-setup-modal', params: { id: params.id, type: 'premiere', showTitle: premiere?.show_title ?? '' } })}
                    style={styles.triviaSetupBtn}
                    hitSlop={8}
                  >
                    <Text style={styles.triviaSetupBtnText}>Trivia</Text>
                  </Pressable>
                )}
                {isHost && isUpperTier && hasBuyLink && !buyPinned && (
                  <Pressable onPress={handlePinBuy} style={styles.pinBuyBtn} hitSlop={8}>
                    <Text style={styles.pinBuyBtnText}>📌 Pin</Text>
                  </Pressable>
                )}
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
          {/* Trivia / Poll card */}
          {activeTriviaCard && (
            <View style={styles.triviaCard}>
              <View style={styles.triviaCardHeader}>
                <Text style={styles.triviaCardType}>
                  {activeTriviaCard.type === 'trivia' ? '🧠 TRIVIA' : '📊 POLL'}
                </Text>
                <Pressable onPress={() => setActiveTriviaCard(null)} hitSlop={12}>
                  <Text style={styles.triviaCardClose}>✕</Text>
                </Pressable>
              </View>
              <Text style={styles.triviaCardQuestion}>{activeTriviaCard.question}</Text>
              <View style={styles.triviaOptions}>
                {activeTriviaCard.options.map((opt, i) => {
                  const totalVotes = Object.values(triviaResponseCounts).reduce((a, b) => a + b, 0);
                  const votes = triviaResponseCounts[i] ?? 0;
                  const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                  const answered = triviaMyAnswer !== null;
                  const isMyPick = triviaMyAnswer === i;
                  const isCorrect = opt.is_correct === true;

                  return (
                    <Pressable
                      key={i}
                      style={[
                        styles.triviaOption,
                        answered && isMyPick && styles.triviaOptionMine,
                        answered && activeTriviaCard.type === 'trivia' && isCorrect && styles.triviaOptionCorrect,
                      ]}
                      onPress={() => handleTriviaAnswer(i)}
                      disabled={answered || submitTriviaResponse.isPending}
                    >
                      <View style={styles.triviaOptionInner}>
                        <Text style={styles.triviaOptionLetter}>{['A', 'B', 'C', 'D'][i]})</Text>
                        <Text style={styles.triviaOptionLabel}>{opt.label}</Text>
                        {answered && (
                          <Text style={styles.triviaOptionPct}>{pct}%</Text>
                        )}
                      </View>
                      {answered && (
                        <View style={[styles.triviaOptionBar, { width: `${pct}%` as any }]} />
                      )}
                    </Pressable>
                  );
                })}
              </View>
              {triviaMyAnswer !== null && activeTriviaCard.type === 'trivia' && (
                <Text style={styles.triviaResult}>
                  {activeTriviaCard.options[triviaMyAnswer]?.is_correct
                    ? '✅ Correct!'
                    : `❌ The answer was: ${activeTriviaCard.options.find((o) => o.is_correct)?.label ?? '?'}`}
                </Text>
              )}
            </View>
          )}

          {/* Buy / Rent pill — shown once host pins (or always for host) */}
          {showBuyPill && premiere?.buy_url && (
            <View style={styles.buyPill}>
              <Pressable style={styles.buyPillBtn} onPress={handleBuyPress}>
                <Text style={styles.buyPillIcon}>🛒</Text>
                <Text style={styles.buyPillText}>{premiere.buy_label ?? 'Buy / Rent Now'}</Text>
              </Pressable>
              <Pressable onPress={() => setBuyDismissed(true)} hitSlop={12} style={styles.buyPillClose}>
                <Text style={styles.buyPillCloseText}>✕</Text>
              </Pressable>
            </View>
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
            <Pressable style={styles.sendBtn} onPress={handleSend} disabled={!text.trim() || sendMsg.isPending}>
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

  // Trivia setup button (host header)
  triviaSetupBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  triviaSetupBtnText: { fontSize: 14 },

  // Trivia / poll card
  triviaCard: {
    backgroundColor: '#1A1A2E',
    borderRadius: 14,
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  triviaCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  triviaCardType: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#A78BFA', letterSpacing: 0.8 },
  triviaCardClose: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.4)' },
  triviaCardQuestion: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff', marginBottom: 10, lineHeight: 20 },
  triviaOptions: { gap: 6 },
  triviaOption: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    position: 'relative',
  },
  triviaOptionMine: { borderWidth: 1, borderColor: 'rgba(167,139,250,0.6)' },
  triviaOptionCorrect: { borderWidth: 1, borderColor: '#10B981' },
  triviaOptionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 9,
    gap: 8,
    zIndex: 1,
  },
  triviaOptionLetter: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: 'rgba(255,255,255,0.5)', width: 18 },
  triviaOptionLabel: { flex: 1, fontFamily: BrandFonts.interRegular, fontSize: 13, color: '#fff' },
  triviaOptionPct: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  triviaOptionBar: {
    position: 'absolute',
    left: 0, top: 0, bottom: 0,
    backgroundColor: 'rgba(167,139,250,0.15)',
    borderRadius: 8,
  },
  triviaResult: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: '#fff',
    marginTop: 10,
    textAlign: 'center',
  },

  // Buy / Rent pill (live view, above input)
  buyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    marginHorizontal: 12,
    marginBottom: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  buyPillBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyPillIcon: { fontSize: 16 },
  buyPillText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    color: '#fff',
  },
  buyPillClose: { paddingLeft: 8 },
  buyPillCloseText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
  },

  // Pin buy button (host header controls)
  pinBuyBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pinBuyBtnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12,
    color: '#fff',
  },

  // Buy / Rent CTA on ended screen
  buyEndedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginBottom: 12,
  },
  buyEndedIcon: { fontSize: 18 },
  buyEndedText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
    color: '#fff',
  },
});
