import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  usePremiere,
  useJoinPremiere,
  useSendPremiereMessage,
  useWaitingRoomMessages,
  type PremiereMessage,
} from '@/features/premieres/api';
import { addPremiereToCalendar } from '@/features/premieres/use-add-to-calendar';
import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';
import { supabase } from '@/lib/supabase';

export default function PremiereWaitingRoom() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const params = useLocalSearchParams<{ id: string }>();

  const { data: premiere } = usePremiere(params.id ?? null);
  const joinPremiere = useJoinPremiere();
  const sendMsg = useSendPremiereMessage();
  const { data: dbMessages = [], isSuccess: messagesLoaded } = useWaitingRoomMessages(params.id ?? null);

  const [messages, setMessages] = useState<PremiereMessage[]>([]);
  const [text, setText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [channelError, setChannelError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);
  const redirectedRef = useRef(false);
  const isHost = premiere?.host_user_id === user?.id;

  // Join on mount
  useEffect(() => {
    if (params.id) joinPremiere.mutate(params.id);
  }, [params.id]);

  // Seed messages from DB once on first load
  useEffect(() => {
    if (messagesLoaded && !initializedRef.current) {
      initializedRef.current = true;
      setMessages(dbMessages);
      if (dbMessages.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      }
    }
  }, [messagesLoaded]);

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
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setChannelError(true);
        }
      });
    return () => { supabase.removeChannel(channel); };
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
            router.replace({ pathname: '/premiere-live', params: { id: params.id } });
          }
        },
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
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
      if (!raw) return 'T20:00:00';
      const m = raw.match(/^(\d+):(\d+)\s*(AM|PM)/i);
      if (!m) return 'T20:00:00';
      let h = parseInt(m[1], 10);
      const min = m[2];
      const period = m[3].toUpperCase();
      if (period === 'PM' && h !== 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      return `T${String(h).padStart(2, '0')}:${min}:00`;
    })();
    const target = new Date(premiere.air_date + timeSuffix).getTime();
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
    sendMsg.mutate({ premiereId: params.id, content, relativeMs: null });
  }

  async function goLive() {
    if (!params.id) return;
    Alert.alert('Start Premiere?', 'This will open the live chat for everyone in the room.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start!',
        onPress: async () => {
          redirectedRef.current = true;
          await supabase
            .from('premieres')
            .update({ status: 'live', live_started_at: new Date().toISOString() })
            .eq('id', params.id);
          router.replace({ pathname: '/premiere-live', params: { id: params.id } });
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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingWrapper>

        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>{premiere?.show_title ?? '...'}</Text>
            <Text style={styles.headerSub}>
              S{premiere?.season_number} E{premiere?.episode_number}
            </Text>
          </View>
          {isHost ? (
            <Pressable style={styles.goLiveBtn} onPress={goLive}>
              <Text style={styles.goLiveBtnText}>Go Live</Text>
            </Pressable>
          ) : <View style={{ width: 60 }} />}
        </View>

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

        {/* Add to calendar */}
        {premiere && (
          <Pressable
            style={styles.calendarBtn}
            onPress={() => addPremiereToCalendar({
              showTitle: premiere.show_title,
              episodeName: premiere.episode_name,
              episodeNumber: premiere.episode_number,
              seasonNumber: premiere.season_number,
              airDate: premiere.air_date,
              hostName: premiere.host_name,
              premiereId: premiere.id,
            })}>
            <Text style={styles.calendarBtnText}>📅  Add to Calendar</Text>
          </Pressable>
        )}

        {/* Waiting room chat note */}
        <View style={styles.wipeBanner}>
          <Text style={styles.wipeBannerText}>
            💬 Chat opens now — clears when the show starts
          </Text>
        </View>

        {/* Channel error banner */}
        {channelError ? (
          <View style={styles.channelErrorBanner}>
            <Text style={styles.channelErrorText}>⚠️ Chat disconnected</Text>
            <Pressable onPress={() => setRetryKey((k) => k + 1)} style={styles.retryBtn} hitSlop={8}>
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
          <Pressable style={styles.sendBtn} onPress={sendMessage} disabled={!text.trim()}>
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 60 },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted },
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
      backgroundColor: '#0F0D1A',
    },
    countdownLabel: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11.5,
      color: 'rgba(255,255,255,0.4)',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    countdownTimer: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 38,
      color: '#fff',
      letterSpacing: -1,
    },
    countdownSub: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: 'rgba(255,255,255,0.45)',
      marginTop: 6,
      textAlign: 'center',
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
    wipeBanner: {
      backgroundColor: Brand.tlight,
      paddingVertical: 7,
      paddingHorizontal: 16,
      alignItems: 'center',
    },
    wipeBannerText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.trust,
    },
    messageList: { padding: 16, gap: 12, flexGrow: 1 },
    messageRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    messageBubble: {
      flex: 1,
      backgroundColor: Brand.card,
      borderRadius: 12,
      padding: 10,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    messageName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.trust,
      marginBottom: 2,
    },
    messageText: { fontFamily: BrandFonts.interRegular, fontSize: 13.5, color: Brand.ink },
    emptyChat: {
      textAlign: 'center',
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      marginTop: 40,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 8,
      padding: 12,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      backgroundColor: Brand.paper,
    },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 22,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      backgroundColor: Brand.card,
    },
    sendBtn: {
      backgroundColor: '#7C3AED',
      borderRadius: 22,
      paddingHorizontal: 16,
      justifyContent: 'center',
    },
    sendBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#fff' },
  });
}
