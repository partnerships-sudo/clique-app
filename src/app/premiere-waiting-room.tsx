import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { usePremiere, useJoinPremiere } from '@/features/premieres/api';
import { addPremiereToCalendar } from '@/features/premieres/use-add-to-calendar';
import { useProfile } from '@/features/profile/api';
import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';
import { supabase } from '@/lib/supabase';

interface WaitingMessage {
  id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  created_at: string;
}

export default function PremiereWaitingRoom() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { data: profile } = useProfile();
  const params = useLocalSearchParams<{ id: string }>();

  const { data: premiere } = usePremiere(params.id ?? null);
  const joinPremiere = useJoinPremiere();

  const [messages, setMessages] = useState<WaitingMessage[]>([]);
  const [text, setText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const isHost = premiere?.host_user_id === user?.id;

  // Join on mount
  useEffect(() => {
    if (params.id) joinPremiere.mutate(params.id);
  }, [params.id]);

  // Countdown to air time
  useEffect(() => {
    if (!premiere?.air_date) return;
    const airTime = new Date(premiere.air_date + 'T20:00:00').getTime();
    const tick = () => {
      const diff = Math.max(0, Math.floor((airTime - Date.now()) / 1000));
      setSecondsLeft(diff);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [premiere?.air_date]);

  // Realtime waiting room chat
  useEffect(() => {
    if (!params.id) return;
    const channel = supabase
      .channel(`waiting-${params.id}`)
      .on('broadcast', { event: 'waiting_message' }, ({ payload }) => {
        setMessages((prev) => [...prev, payload as WaitingMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [params.id]);

  async function sendMessage() {
    if (!text.trim() || !params.id) return;
    const msg: WaitingMessage = {
      id: Math.random().toString(),
      user_name: profile?.full_name ?? profile?.username ?? 'You',
      user_avatar_url: profile?.avatar_url ?? null,
      content: text.trim(),
      created_at: new Date().toISOString(),
    };
    setText('');
    setMessages((prev) => [...prev, msg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

    await supabase.channel(`waiting-${params.id}`).send({
      type: 'broadcast',
      event: 'waiting_message',
      payload: msg,
    });
  }

  async function goLive() {
    if (!params.id) return;
    Alert.alert('Start Premiere?', 'This will wipe the waiting room chat and open the live chat.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Start!',
        onPress: async () => {
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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

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

      </KeyboardAvoidingView>
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
