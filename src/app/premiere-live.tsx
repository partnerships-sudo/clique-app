import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
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
  useJoinPremiere,
  useInviteToPremiere,
  useSendPremiereMessage,
  useEndPremiere,
  usePremiereViewerCount,
  type PremiereMessage,
} from '@/features/premieres/api';
import { useDmThreads } from '@/features/dms/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

function formatRelativeTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PremiereLive() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const { data: premiere, isLoading: premiereLoading, isError: premiereError } = usePremiere(params.id ?? null);
  const { data: initialMessages = [], isSuccess: messagesLoaded } = usePremiereMessages(params.id ?? null);
  const joinPremiere = useJoinPremiere();
  const sendMsg = useSendPremiereMessage();
  const endPremiere = useEndPremiere();
  const { data: viewerCount = 0 } = usePremiereViewerCount(params.id ?? null);

  const [messages, setMessages] = useState<PremiereMessage[]>([]);
  const [text, setText] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const flatListRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);
  const { threads: dmThreads } = useDmThreads();
  const inviteToPremiere = useInviteToPremiere();

  const isHost = premiere?.host_user_id === user?.id;
  const isEnded = premiere?.status === 'ended';

  // Join on mount
  useEffect(() => {
    if (params.id) joinPremiere.mutate(params.id);
  }, [params.id]);

  // Seed messages from DB once
  useEffect(() => {
    if (messagesLoaded && !initializedRef.current) {
      initializedRef.current = true;
      setMessages(initialMessages);
      if (initialMessages.length > 0) {
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
      }
    }
  }, [messagesLoaded]);

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
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.endedContainer}>
          <Text style={styles.endedTitle}>That's a wrap! 🎬</Text>
          <Text style={styles.endedSub}>
            {premiere?.show_title} · S{premiere?.season_number} E{premiere?.episode_number}
          </Text>
          <Pressable
            style={styles.rateBtn}
            onPress={() =>
              router.push({
                pathname: '/log-modal',
                params: {
                  prefillTitle: premiere?.show_title,
                  prefillType: 'tv',
                  prefillSub: `S${premiere?.season_number} E${premiere?.episode_number}${premiere?.episode_name ? ` · ${premiere.episode_name}` : ''}`,
                  prefillPoster: premiere?.show_poster ?? '',
                  prefillExternalId: premiere?.external_id ?? '',
                },
              })
            }
          >
            <Text style={styles.rateBtnText}>Rate the Episode</Text>
          </Pressable>
          <Pressable style={styles.leaveEndedBtn} onPress={() => router.back()}>
            <Text style={styles.leaveEndedText}>Leave</Text>
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
            {viewerCount > 0 && (
              <Text style={styles.viewerCount}>{viewerCount} watching</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <Pressable onPress={() => setInviteOpen(true)} hitSlop={16}>
              <Text style={styles.addBtn}>＋</Text>
            </Pressable>
            {isHost ? (
              <>
                <Pressable onPress={() => router.back()} hitSlop={16}>
                  <Text style={styles.leaveText}>Back</Text>
                </Pressable>
                <Pressable onPress={handleEnd} hitSlop={16}>
                  <Text style={styles.endText}>End</Text>
                </Pressable>
              </>
            ) : (
              <Pressable onPress={() => router.back()} hitSlop={16}>
                <Text style={styles.leaveText}>Leave</Text>
              </Pressable>
            )}
          </View>
        </View>

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
            return (
              <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                {!isMine && (
                  <Avatar name={item.user_name} size={28} avatarUrl={item.user_avatar_url} />
                )}
                <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                  {!isMine && (
                    <Text style={styles.bubbleName}>{item.user_name}</Text>
                  )}
                  <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
                    {item.content}
                  </Text>
                  {item.relative_ms !== null && (
                    <Text style={[styles.bubbleTime, isMine && styles.bubbleTimeMine]}>
                      {formatRelativeTime(item.relative_ms)}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        {/* Input */}
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
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
            <Text style={styles.sendBtnText}>Send</Text>
          </Pressable>
        </View>

      </KeyboardAvoidingWrapper>

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
  endText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#EF4444' },
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
    marginBottom: 2,
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
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0F0D1A',
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sendBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 22,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  sendBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#fff' },

  // Ended state
  endedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  endedTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 32,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  endedSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 15,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginBottom: 40,
  },
  rateBtn: {
    backgroundColor: '#7C3AED',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  rateBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  leaveEndedBtn: { paddingVertical: 14 },
  leaveEndedText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
  },
});
