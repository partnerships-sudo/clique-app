import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';

import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  usePremiere,
  useJoinPremiere,
  useInviteToPremiere,
  useResendPremiereInvite,
  useSendPremiereMessage,
  useWaitingRoomMessages,
  usePremiereMembers,
  usePremiereCoHosts,
  useIsCoHost,
  useMyCoHostInvite,
  useInviteCoHost,
  useRespondToCoHostInvite,
  useRemoveCoHost,
  type PremiereMessage,
  type PremiereCoHost,
} from '@/features/premieres/api';
import { useDmThreads } from '@/features/dms/api';
import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';
import { supabase } from '@/lib/supabase';

export default function PremiereWaitingRoom() {
  const Brand = useBrand();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const styles = useMemo(() => createStyles(Brand, isDark), [Brand, isDark]);
  const { user } = useSession();
  const params = useLocalSearchParams<{ id: string }>();

  const queryClient = useQueryClient();
  const { data: premiere, isLoading: premiereLoading } = usePremiere(params.id ?? null);
  const joinPremiere = useJoinPremiere();
  const sendMsg = useSendPremiereMessage();
  const resendInvite = useResendPremiereInvite();
  const [resentIds, setResentIds] = useState<Set<string>>(new Set());
  const { data: dbMessages = [] } = useWaitingRoomMessages(params.id ?? null);

  const [extraMessages, setExtraMessages] = useState<PremiereMessage[]>([]);
  const [text, setText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [channelError, setChannelError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const [guestSheetTab, setGuestSheetTab] = useState<'attending' | 'maybe' | 'invited' | 'not_attending' | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const redirectedRef = useRef(false);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const isHost = premiere?.host_user_id === user?.id;
  const isCoHost = useIsCoHost(params.id ?? null);
  const isHostOrCoHost = isHost || isCoHost;
  const myCoHostInvite = useMyCoHostInvite(params.id ?? null);
  const { threads: dmThreads } = useDmThreads();
  const inviteToPremiere = useInviteToPremiere();
  const inviteCoHost = useInviteCoHost();
  const respondToCoHostInvite = useRespondToCoHostInvite();
  const removeCoHost = useRemoveCoHost();
  const { data: cohosts = [] } = usePremiereCoHosts(params.id ?? null);
  const { data: members = [] } = usePremiereMembers(params.id ?? null);
  const [coHostSheetOpen, setCoHostSheetOpen] = useState(false);
  const [coHostedIds, setCoHostedIds] = useState<Set<string>>(new Set());

  const rsvpCounts = {
    attending: members.filter((m) => m.rsvp_status === 'attending').length,
    maybe: members.filter((m) => m.rsvp_status === 'maybe').length,
    invited: members.filter((m) => m.rsvp_status === 'invited').length,
    not_attending: members.filter((m) => m.rsvp_status === 'not_attending').length,
  };

  // Merge DB messages with any realtime extras not yet in DB result
  const messages = [
    ...dbMessages,
    ...extraMessages.filter((m) => !dbMessages.some((d) => d.id === m.id)),
  ];

  // Join on mount
  useEffect(() => {
    if (params.id) joinPremiere.mutate(params.id);
  }, [params.id]);

  // Countdown tick → redirect at 0
  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      router.replace({ pathname: '/premiere-live', params: { id: params.id, fromWaiting: 'true' } });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // Redirect ended parties straight to replay — handles stale-cache navigation landing here
  useEffect(() => {
    if (premiere?.status === 'ended') {
      router.replace({ pathname: '/premiere-replay', params: { id: params.id } });
    }
  }, [premiere?.status]);

  // Fallback redirect: usePremiere polls every 5s — catch the live status even if realtime missed it
  useEffect(() => {
    if (premiere?.status === 'live' && !redirectedRef.current) {
      redirectedRef.current = true;
      setCountdown(3);
    }
  }, [premiere?.status]);

  // Scroll to bottom when messages first load
  const didScrollRef = useRef(false);
  useEffect(() => {
    if (dbMessages.length > 0 && !didScrollRef.current) {
      didScrollRef.current = true;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [dbMessages.length]);

  // Realtime: new waiting room messages written to DB
  useEffect(() => {
    if (!params.id) return;
    setChannelError(false);
    const channel = supabase
      .channel(`waiting-msgs-${params.id}`)
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
          if (msg.relative_ms === null) {
            // Invalidate so React Query picks it up on next poll
            queryClient.invalidateQueries({ queryKey: ['waiting-room-messages', params.id] });
            setExtraMessages((prev) => {
              // Already have the real row in extras
              if (prev.some((m) => m.id === msg.id)) return prev;
              // Already in DB query cache (realtime replayed an existing message on connect)
              const cached = queryClient.getQueryData<PremiereMessage[]>(['waiting-room-messages', params.id]);
              if (cached?.some((d) => d.id === msg.id)) return prev;
              // Replace our own optimistic entry with the real one; append others' messages
              if (msg.user_id === user?.id) {
                const idx = prev.findIndex((m) => m.id.startsWith('optimistic-') && m.user_id === user.id);
                if (idx !== -1) {
                  const next = [...prev];
                  next[idx] = msg;
                  return next;
                }
              }
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setChannelError(false);
          if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
          reconnectTimerRef.current = setTimeout(() => setRetryKey((k) => k + 1), 3000);
        } else if (status === 'CHANNEL_ERROR') {
          setChannelError(true);
        }
      });
    return () => {
      supabase.removeChannel(channel);
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    };
  }, [params.id, retryKey]);

  // Realtime: redirect participants when host starts premiere
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`premiere-status-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'premieres',
          filter: `id=eq.${params.id}`,
        },
        (payload) => {
          if (payload.new.status === 'live' && !redirectedRef.current) {
            redirectedRef.current = true;
            setCountdown(3);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'TIMED_OUT' || status === 'CLOSED') {
          reconnectTimerRef.current = setTimeout(() => setRetryKey((k) => k + 1), 3000);
        } else if (status === 'CHANNEL_ERROR') {
          setChannelError(true);
        }
      });
    return () => { supabase.removeChannel(channel); };
  }, [params.id, retryKey]);

  // Countdown to air time
  useEffect(() => {
    if (!premiere?.air_date) return;
    const timeSuffix = (() => {
      const raw = premiere.air_time;
      if (!raw) return null;
      // Match formats like "8:00 PM", "8:00 PM ET", "20:00"
      const ampm = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (ampm) {
        let h = parseInt(ampm[1], 10);
        const min = ampm[2];
        const period = ampm[3].toUpperCase();
        if (period === 'PM' && h !== 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        return `T${String(h).padStart(2, '0')}:${min}:00`;
      }
      const h24 = raw.match(/^(\d{1,2}):(\d{2})/);
      if (h24) return `T${String(parseInt(h24[1], 10)).padStart(2, '0')}:${h24[2]}:00`;
      return null;
    })();
    if (!timeSuffix) return;
    const target = new Date(premiere.air_date + timeSuffix).getTime();
    if (isNaN(target)) return;
    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [premiere?.air_date, premiere?.air_time]);

  function sendMessage() {
    if (!text.trim() || !params.id) return;
    const content = text.trim();
    setText('');
    const optimistic: PremiereMessage = {
      id: `optimistic-${Date.now()}`,
      premiere_id: params.id,
      user_id: user?.id ?? '',
      user_name: premiere?.host_name ?? 'You',
      user_avatar_url: null,
      content,
      relative_ms: null,
      created_at: new Date().toISOString(),
    };
    setExtraMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    sendMsg.mutate({ premiereId: params.id, content, relativeMs: null }, {
      onError: () => setExtraMessages((prev) => prev.filter((m) => m.id !== optimistic.id)),
    });
  }

  async function goLive() {
    if (!params.id) return;
    Alert.alert('Start Premiere?', 'This will open the live chat for everyone in the room.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start!',
        onPress: async () => {
          redirectedRef.current = true;
          // Start countdown immediately for the host, then update DB
          setCountdown(3);
          await supabase
            .from('premieres')
            .update({ status: 'live', live_started_at: new Date().toISOString() })
            .eq('id', params.id);
        },
      },
    ]);
  }

  function formatCountdown(secs: number) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  }

  if (premiereLoading && !premiere) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color="#fff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingWrapper>

        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => {
              Alert.alert(
                'Leave waiting room?',
                "You'll miss the countdown when it goes live.",
                [
                  { text: 'Stay', style: 'cancel' },
                  { text: 'Leave', style: 'destructive', onPress: () => router.back() },
                ],
              );
            }}
            hitSlop={16}
          >
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{premiere?.show_title ?? '...'}</Text>
            <Text style={styles.headerSub}>
              S{premiere?.season_number} E{premiere?.episode_number}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 60, justifyContent: 'flex-end' }}>
            {isHostOrCoHost && (
              <Pressable style={styles.goLiveBtn} onPress={goLive}>
                <Text style={styles.goLiveBtnText}>Go Live</Text>
              </Pressable>
            )}
            {isHost && (
              <Pressable onPress={() => setCoHostSheetOpen(true)} hitSlop={16}>
                <Text style={styles.addBtn}>👑</Text>
              </Pressable>
            )}
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={16}>
              <Text style={styles.addBtn}>＋</Text>
            </Pressable>
          </View>
        </View>

        {/* Co-host invite banner */}
        {myCoHostInvite && myCoHostInvite.status === 'pending' && (
          <View style={styles.coHostBanner}>
            <Text style={styles.coHostBannerText}>👑 You've been invited to co-host this party</Text>
            <View style={styles.coHostBannerBtns}>
              <Pressable
                style={[styles.coHostBannerBtn, { backgroundColor: Brand.trust }]}
                onPress={() => respondToCoHostInvite.mutate({ inviteId: myCoHostInvite.id, premiereId: myCoHostInvite.premiere_id, accept: true })}>
                <Text style={[styles.coHostBannerBtnText, { color: '#fff' }]}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.coHostBannerBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: Brand.border }]}
                onPress={() => respondToCoHostInvite.mutate({ inviteId: myCoHostInvite.id, premiereId: myCoHostInvite.premiere_id, accept: false })}>
                <Text style={[styles.coHostBannerBtnText, { color: Brand.muted }]}>Decline</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Countdown */}
        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>Starts in</Text>
          <Text style={styles.countdownTimer}>
            {secondsLeft !== null ? formatCountdown(secondsLeft) : '–'}
          </Text>
          <Text style={styles.countdownSub}>
            {premiere?.tagline ? `"${premiere.tagline}"` : 'Waiting room is open 🍿'}
          </Text>
        </View>

        {/* RSVP counts strip */}
        <View style={styles.rsvpStrip}>
          {([
            { key: 'attending', label: 'Going', count: rsvpCounts.attending },
            { key: 'maybe', label: 'Maybe', count: rsvpCounts.maybe },
            { key: 'not_attending', label: "Can't", count: rsvpCounts.not_attending },
            { key: 'invited', label: 'Awaiting', count: rsvpCounts.invited },
          ] as const).map((item, i) => {
            const faces = members
              .filter((m) => m.rsvp_status === item.key)
              .slice(0, 3);
            return (
              <View key={item.key} style={{ flex: 1, flexDirection: 'row' }}>
                {i > 0 && <View style={styles.rsvpDivider} />}
                <Pressable style={styles.rsvpPill} onPress={() => setGuestSheetTab(item.key)}>
                  {faces.length > 0 ? (
                    <View style={styles.rsvpAvatarRow}>
                      {faces.map((m, idx) => (
                        <View key={m.user_id} style={[styles.rsvpAvatarWrap, { marginLeft: idx > 0 ? -6 : 0, zIndex: faces.length - idx }]}>
                          <Avatar
                            name={m.full_name ?? m.username ?? '?'}
                            size={20}
                            avatarUrl={m.avatar_url ?? undefined}
                          />
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.rsvpPillCount}>{item.count}</Text>
                  )}
                  <Text style={styles.rsvpPillLabel}>
                    {item.label}{item.count > 0 ? ` (${item.count})` : ''}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>


        {/* Waiting room chat note */}
        <View style={styles.wipeBanner}>
          <Text style={styles.wipeBannerText}>
            💬 Chat is open. Messages clear when the show starts.
          </Text>
        </View>

        {/* Channel error banner */}
        {channelError ? (
          <View style={styles.channelErrorBanner}>
            <Text style={styles.channelErrorText}>⚠️ Chat disconnected</Text>
            <Pressable onPress={() => setRetryKey((k) => k + 1)} style={styles.retryBtn} hitSlop={16}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => (
            <View style={styles.messageRow}>
              <Avatar name={item.user_name} size={28} avatarUrl={item.user_avatar_url} />
              <View style={styles.messageBubble}>
                <Text style={styles.messageName}>{item.user_name}</Text>
                <Text style={styles.messageText}>{item.content}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <Text style={styles.emptyChat}>Be the first to say something 👋</Text>
          }
        />

        {/* Input */}
        <View style={[styles.inputWrap, { paddingBottom: bottomInset > 0 ? bottomInset - 4 : 10 }]}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Say something…"
              placeholderTextColor={Brand.muted}
              value={text}
              onChangeText={setText}
              onSubmitEditing={sendMessage}
              returnKeyType="send"
            />
            <Pressable style={styles.sendBtn} onPress={sendMessage} disabled={!text.trim()} hitSlop={8}>
              <Text style={styles.sendBtnText}>↑</Text>
            </Pressable>
          </View>
        </View>

      </KeyboardAvoidingWrapper>

      {/* Guest list sheet */}
      <Modal visible={guestSheetTab !== null} transparent animationType="slide" onRequestClose={() => setGuestSheetTab(null)}>
        <Pressable style={styles.inviteBackdrop} onPress={() => setGuestSheetTab(null)}>
          <Pressable style={styles.inviteSheet} onPress={() => {}}>
            <View style={styles.inviteGrabber} />
            <Text style={styles.inviteTitle}>
              {guestSheetTab === 'attending' ? '✓ Going' :
               guestSheetTab === 'maybe' ? '? Maybe' :
               guestSheetTab === 'invited' ? '⏳ Awaiting' : "✕ Can't"}
            </Text>
            <FlatList
              data={members.filter((m) => m.rsvp_status === guestSheetTab)}
              keyExtractor={(m) => m.user_id}
              style={styles.inviteList}
              renderItem={({ item }) => {
                const resent = resentIds.has(item.user_id);
                return (
                  <View style={styles.inviteRow}>
                    <Avatar name={item.full_name ?? item.username ?? '?'} size={36} avatarUrl={item.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inviteName}>{item.full_name ?? item.username ?? 'Unknown'}</Text>
                      {item.username ? <Text style={[styles.inviteAction, { color: Brand.muted }]}>@{item.username}</Text> : null}
                    </View>
                    {guestSheetTab === 'invited' && isHost && (
                      <Pressable
                        hitSlop={8}
                        disabled={resent || resendInvite.isPending}
                        onPress={async () => {
                          if (!params.id || !premiere) return;
                          await resendInvite.mutateAsync({ premiereId: params.id, friendId: item.user_id, showTitle: premiere.show_title });
                          setResentIds((prev) => new Set([...prev, item.user_id]));
                        }}>
                        <Text style={[styles.inviteAction, resent && styles.inviteActionSent]}>
                          {resent ? 'Sent ✓' : 'Remind'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={styles.inviteEmpty}>Nobody here yet.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Go-live countdown overlay */}
      {countdown !== null && (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownOverlayLabel}>Going live</Text>
          <Text style={styles.countdownOverlayNum}>{countdown === 0 ? '🎬' : countdown}</Text>
        </View>
      )}

      {/* Co-host management sheet */}
      <Modal visible={coHostSheetOpen} transparent animationType="slide" onRequestClose={() => setCoHostSheetOpen(false)}>
        <Pressable style={styles.inviteBackdrop} onPress={() => setCoHostSheetOpen(false)}>
          <Pressable style={styles.inviteSheet} onPress={() => {}}>
            <View style={styles.inviteGrabber} />
            <Text style={styles.inviteTitle}>👑 Co-hosts</Text>

            {/* Current co-hosts */}
            {cohosts.length > 0 && (
              <FlatList
                data={cohosts}
                keyExtractor={(c) => c.id}
                style={[styles.inviteList, { maxHeight: 160 }]}
                renderItem={({ item }: { item: PremiereCoHost }) => (
                  <View style={styles.inviteRow}>
                    <Avatar name={item.full_name ?? item.username ?? '?'} size={36} avatarUrl={item.avatar_url ?? undefined} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.inviteName}>{item.full_name ?? item.username ?? 'Unknown'}</Text>
                      <Text style={[styles.inviteAction, { color: item.status === 'accepted' ? '#10B981' : Brand.muted }]}>
                        {item.status === 'accepted' ? '✓ Accepted' : item.status === 'declined' ? 'Declined' : 'Pending…'}
                      </Text>
                    </View>
                    <Pressable
                      hitSlop={8}
                      onPress={() => removeCoHost.mutate({ id: item.id, premiereId: item.premiere_id })}>
                      <Text style={{ color: '#E84F4F', fontFamily: BrandFonts.syneBold, fontSize: 13 }}>Remove</Text>
                    </Pressable>
                  </View>
                )}
              />
            )}

            {cohosts.length > 0 && <View style={{ height: 1, backgroundColor: Brand.border, marginHorizontal: 16, marginVertical: 8 }} />}

            <Text style={[styles.inviteTitle, { fontSize: 13, color: Brand.muted, marginBottom: 4 }]}>Add a co-host</Text>
            <FlatList
              data={dmThreads.filter((t) => !cohosts.some((c) => c.user_id === t.friendId))}
              keyExtractor={(t) => t.friendId}
              style={styles.inviteList}
              renderItem={({ item }) => {
                const sent = coHostedIds.has(item.friendId);
                return (
                  <Pressable
                    style={styles.inviteRow}
                    onPress={async () => {
                      if (sent || !params.id) return;
                      // Mark as sent before awaiting: this used to be set only
                      // after the request resolved, so a second tap during that
                      // window still saw sent === false and sent a duplicate.
                      setCoHostedIds((prev) => new Set([...prev, item.friendId]));
                      try {
                        await inviteCoHost.mutateAsync({ premiereId: params.id, friendId: item.friendId });
                      } catch {
                        setCoHostedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(item.friendId);
                          return next;
                        });
                      }
                    }}>
                    <Avatar name={item.name} size={36} avatarUrl={item.avatarUrl} />
                    <Text style={styles.inviteName}>{item.name}</Text>
                    <Text style={[styles.inviteAction, sent && styles.inviteActionSent]}>
                      {sent ? '✓ Invited' : 'Make co-host'}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.inviteEmpty}>No friends to add.</Text>}
            />
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
        <Pressable style={styles.inviteBackdrop} onPress={() => setInviteOpen(false)}>
          <Pressable style={styles.inviteSheet} onPress={() => {}}>
            <View style={styles.inviteGrabber} />
            <Text style={styles.inviteTitle}>Invite friends</Text>
            <FlatList
              data={dmThreads}
              keyExtractor={(t) => t.friendId}
              style={styles.inviteList}
              renderItem={({ item }) => {
                const sent = invitedIds.has(item.friendId);
                return (
                  <Pressable
                    style={styles.inviteRow}
                    onPress={async () => {
                      if (sent || !params.id || !premiere) return;
                      // Set before awaiting — otherwise a second tap during the
                      // request sent a duplicate invite.
                      setInvitedIds((prev) => new Set([...prev, item.friendId]));
                      try {
                        await inviteToPremiere.mutateAsync({ premiereId: params.id, friendId: item.friendId, showTitle: premiere.show_title });
                      } catch {
                        setInvitedIds((prev) => {
                          const next = new Set(prev);
                          next.delete(item.friendId);
                          return next;
                        });
                      }
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

function createStyles(Brand: BrandPalette, isDark: boolean) {
  const bg      = isDark ? '#0F0D1A' : Brand.paper;
  const surface = isDark ? '#1A1629' : Brand.card;
  const border  = isDark ? 'rgba(255,255,255,0.07)' : Brand.border;
  const ink     = isDark ? '#fff' : Brand.ink;
  const muted   = isDark ? 'rgba(255,255,255,0.4)' : Brand.muted;
  const accent  = isDark ? '#A78BFA' : Brand.trust;
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: bg },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: border,
    },
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: accent, width: 60 },
    addBtn: { fontFamily: BrandFonts.syneBold, fontSize: 22, color: accent },
    inviteBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    inviteSheet: { backgroundColor: Brand.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingBottom: 32, maxHeight: '70%' },
    inviteGrabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 16 },
    inviteTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, textAlign: 'center', marginBottom: 12 },
    inviteList: { paddingHorizontal: 16 },
    inviteRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12 },
    inviteName: { flex: 1, fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.ink },
    inviteAction: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },
    inviteActionSent: { color: Brand.muted },
    inviteEmpty: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', padding: 24 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: muted },
    goLiveBtn: {
      backgroundColor: '#7C3AED',
      borderRadius: 10,
      paddingVertical: 6,
      paddingHorizontal: 12,
      width: 60,
      alignItems: 'center',
    },
    goLiveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    countdownBox: {
      alignItems: 'center',
      paddingVertical: 20,
      paddingHorizontal: 24,
      backgroundColor: bg,
    },
    countdownLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11.5,
      color: muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    countdownTimer: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 38,
      color: ink,
      letterSpacing: -1,
    },
    countdownSub: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: muted,
      marginTop: 6,
      textAlign: 'center',
    },
    rsvpStrip: {
      flexDirection: 'row',
      backgroundColor: bg,
      borderTopWidth: 1,
      borderTopColor: border,
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    rsvpPill: { flex: 1, alignItems: 'center', gap: 2 },
    rsvpPillCount: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: ink,
    },
    rsvpPillLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
    },
    rsvpDivider: {
      width: 1,
      backgroundColor: border,
      marginVertical: 4,
    },
    rsvpAvatarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    rsvpAvatarWrap: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.3)',
      overflow: 'hidden',
    },
    countdownOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: '#0F0D1A',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
    },
    countdownOverlayLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: 'rgba(255,255,255,0.5)',
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: 16,
    },
    countdownOverlayNum: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 96,
      color: '#fff',
      lineHeight: 110,
    },
    calendarBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
      backgroundColor: '#0F0D1A',
    },
    calendarBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
      color: '#A78BFA',
    },
    channelErrorBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      backgroundColor: '#FEF2F2',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    channelErrorText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: '#B91C1C',
    },
    retryBtn: {
      borderRadius: 6,
      paddingVertical: 4,
      paddingHorizontal: 10,
      backgroundColor: '#B91C1C',
    },
    retryBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12,
      color: '#fff',
    },
    coHostBanner: {
      backgroundColor: isDark ? 'rgba(167,139,250,0.15)' : '#F5F3FF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(167,139,250,0.2)' : '#DDD6FE',
      paddingVertical: 12,
      paddingHorizontal: 16,
      gap: 8,
    },
    coHostBannerText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: isDark ? '#A78BFA' : '#7C3AED',
      textAlign: 'center',
    },
    coHostBannerBtns: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
    },
    coHostBannerBtn: {
      borderRadius: 20,
      paddingHorizontal: 20,
      paddingVertical: 7,
    },
    coHostBannerBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
    },
    wipeBanner: {
      backgroundColor: isDark ? 'rgba(167,139,250,0.1)' : Brand.tlight,
      paddingVertical: 7,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    wipeBannerText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: accent,
    },
    messageList: { padding: 16, gap: 12, flexGrow: 1 },
    messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    messageBubble: {
      flex: 1,
      backgroundColor: surface,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: border,
    },
    messageName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: accent,
      marginBottom: 2,
    },
    messageText: { fontFamily: BrandFonts.interRegular, fontSize: 13.5, color: ink },
    emptyChat: {
      textAlign: 'center',
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: muted,
      marginTop: 40,
    },
    inputWrap: {
      backgroundColor: bg,
      borderTopWidth: 1,
      borderTopColor: border,
      paddingHorizontal: Spacing.three,
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
      borderColor: isDark ? 'rgba(255,255,255,0.12)' : Brand.border,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 11,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14.5,
      color: ink,
      backgroundColor: surface,
    },
    sendBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
