import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { VideoPlayer, type VideoPlayerHandle } from '@/components/screening-room/video-player';
import { BrandFonts } from '@/constants/theme';
import {
  useEndScreeningRoom,
  useGoLiveScreeningRoom,
  useJoinScreeningRoom,
  usePushPlaybackState,
  useScreeningRoom,
  useScreeningRoomMessages,
  useScreeningRoomViewerCount,
  useSendScreeningRoomMessage,
  type ScreeningRoomMessage,
} from '@/features/screening-rooms/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

// How often (ms) the host persists playback state to DB for late joiners
const HEARTBEAT_INTERVAL = 8_000;

function formatTime(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ScreeningRoomLive() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const insets = useSafeAreaInsets();

  const { data: room, isLoading } = useScreeningRoom(id ?? null);
  const { data: initialMessages = [], isSuccess: messagesLoaded } = useScreeningRoomMessages(id ?? null);
  const { data: viewerCount = 0 } = useScreeningRoomViewerCount(id ?? null);

  const joinRoom = useJoinScreeningRoom();
  const sendMsg = useSendScreeningRoomMessage();
  const goLive = useGoLiveScreeningRoom();
  const endRoom = useEndScreeningRoom();
  const pushState = usePushPlaybackState();

  const isHost = room?.host_user_id === user?.id;
  const isEnded = room?.status === 'ended';
  const isLive = room?.status === 'live';

  const videoRef = useRef<VideoPlayerHandle>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);

  const [messages, setMessages] = useState<ScreeningRoomMessage[]>([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const initializedRef = useRef(false);

  // Realtime broadcast channel for playback sync
  const syncChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Heartbeat interval ref (host only)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Join on mount
  useEffect(() => {
    if (id) joinRoom.mutate(id);
  }, [id]);

  // Seed messages once
  useEffect(() => {
    if (messagesLoaded && !initializedRef.current) {
      initializedRef.current = true;
      setMessages(initialMessages);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, [messagesLoaded]);

  // Realtime: new chat messages via postgres_changes
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`screening-msgs-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'screening_room_messages', filter: `room_id=eq.${id}` }, (payload) => {
        const msg = payload.new as ScreeningRoomMessage;
        setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // Realtime broadcast channel for playback sync
  useEffect(() => {
    if (!id || !isLive) return;

    const channel = supabase.channel(`screening-sync-${id}`, { config: { broadcast: { self: false } } });

    if (!isHost) {
      // Viewers listen for sync events from host
      channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
        const { isPlaying: hostPlaying, positionMs: hostPos, serverTime } = payload;
        // Compensate for network latency
        const latency = Date.now() - serverTime;
        const adjustedPos = hostPlaying ? hostPos + latency : hostPos;
        videoRef.current?.seekTo(adjustedPos);
        if (hostPlaying) {
          videoRef.current?.play();
        } else {
          videoRef.current?.pause();
        }
        setIsPlaying(hostPlaying);
        setPositionMs(adjustedPos);
      });
    }

    channel.subscribe();
    syncChannelRef.current = channel;

    // If viewer, sync to host's current state once video is ready
    if (!isHost && room && videoReady) {
      const elapsed = room.is_playing && room.live_started_at
        ? room.playback_position_ms + (Date.now() - new Date(room.live_started_at).getTime())
        : room.playback_position_ms;
      videoRef.current?.seekTo(elapsed);
      if (room.is_playing) videoRef.current?.play();
    }

    return () => {
      if (syncChannelRef.current) supabase.removeChannel(syncChannelRef.current);
    };
  }, [id, isLive, isHost, videoReady]);

  // Host heartbeat — persist state to DB so late joiners can sync
  useEffect(() => {
    if (!isHost || !isLive) return;
    heartbeatRef.current = setInterval(() => {
      if (!id) return;
      videoRef.current?.getPosition(); // triggers onPosition → persists to DB
    }, HEARTBEAT_INTERVAL);
    return () => { if (heartbeatRef.current) clearInterval(heartbeatRef.current); };
  }, [isHost, isLive, id]);

  // Broadcast sync event when host changes playback state
  const broadcastSync = useCallback((playing: boolean, pos: number) => {
    if (!isHost || !syncChannelRef.current) return;
    syncChannelRef.current.send({
      type: 'broadcast',
      event: 'sync',
      payload: { isPlaying: playing, positionMs: pos, serverTime: Date.now() },
    });
    pushState.mutate({ roomId: id!, isPlaying: playing, positionMs: pos });
  }, [isHost, id]);

  // Host position callback (from heartbeat or getPosition calls)
  const handlePosition = useCallback((pos: number) => {
    setPositionMs(pos);
    if (isHost) pushState.mutate({ roomId: id!, isPlaying: isPlaying, positionMs: pos });
  }, [isHost, id, isPlaying]);

  // Host: video state changed locally
  const handleStateChange = useCallback((playing: boolean, pos: number) => {
    setIsPlaying(playing);
    setPositionMs(pos);
    if (isHost) broadcastSync(playing, pos);
  }, [isHost, broadcastSync]);

  function handlePlayPause() {
    if (!isHost) return;
    if (isPlaying) {
      videoRef.current?.pause();
    } else {
      videoRef.current?.play();
    }
    // Optimistic UI — actual state comes back via onStateChange
    setIsPlaying(!isPlaying);
  }

  function handleSkip(deltaMs: number) {
    if (!isHost) return;
    const newPos = Math.max(0, positionMs + deltaMs);
    videoRef.current?.seekTo(newPos);
    broadcastSync(isPlaying, newPos);
    setPositionMs(newPos);
  }

  function handleSend() {
    if (!text.trim() || !id) return;
    const relativeMs = room?.live_started_at ? Date.now() - new Date(room.live_started_at).getTime() : null;
    const content = text.trim();
    setText('');
    const optimistic: ScreeningRoomMessage = {
      id: `optimistic-${Date.now()}`,
      room_id: id,
      user_id: user?.id ?? '',
      user_name: room?.host_name ?? 'You',
      user_avatar_url: null,
      content,
      relative_ms: relativeMs,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    sendMsg.mutate({ roomId: id, content, relativeMs }, {
      onError: () => setMessages((prev) => prev.filter((m) => m.id !== optimistic.id)),
    });
  }

  async function handleGoLive() {
    if (!id) return;
    await goLive.mutateAsync(id);
    setIsPlaying(false);
    setPositionMs(0);
  }

  function handleEnd() {
    Alert.alert('End screening?', 'This will close the room for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End it', style: 'destructive', onPress: () => endRoom.mutate(id!) },
    ]);
  }

  async function handleShare() {
    try {
      await Share.share({ message: `Join my Screening Room on Clique: "${room?.title}" — clique://screening-room/${id}` });
    } catch {}
  }

  if (isEnded) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.endedWrap}>
          <Text style={styles.endedEmoji}>🎬</Text>
          <Text style={styles.endedTitle}>That's a wrap!</Text>
          <Text style={styles.endedSub}>{room?.title}</Text>
          <Pressable style={styles.leaveBtn} onPress={() => router.back()}>
            <Text style={styles.leaveBtnText}>Leave</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {isLive ? (
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>● LIVE</Text>
            </View>
          ) : (
            <View style={styles.waitingBadge}>
              <Text style={styles.waitingBadgeText}>WAITING</Text>
            </View>
          )}
          <View>
            <Text style={styles.roomTitle} numberOfLines={1}>{room?.title ?? '…'}</Text>
            {viewerCount > 0 && (
              <Text style={styles.viewerCount}>{viewerCount} watching</Text>
            )}
          </View>
        </View>
        <View style={styles.headerRight}>
          {isHost && (
            <Pressable onPress={handleShare} hitSlop={12}>
              <SymbolView name="square.and.arrow.up" size={18} tintColor="rgba(255,255,255,0.6)" type="monochrome" />
            </Pressable>
          )}
          {isHost ? (
            <Pressable onPress={handleEnd} hitSlop={12}>
              <Text style={styles.endText}>End</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.leaveText}>Leave</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Video player */}
      <View style={styles.videoWrap}>
        {room && (
          <VideoPlayer
            ref={videoRef}
            videoUrl={room.video_url}
            videoType={room.video_type}
            isHost={isHost}
            onReady={() => setVideoReady(true)}
            onStateChange={handleStateChange}
            onPosition={handlePosition}
          />
        )}

        {/* Viewer sync overlay — shown until user taps to allow autoplay */}
        {!isHost && !videoReady && isLive && (
          <Pressable
            style={styles.syncOverlay}
            onPress={() => {
              // First interaction unlocks iOS autoplay
              videoRef.current?.play();
              setTimeout(() => videoRef.current?.pause(), 100);
            }}>
            <SymbolView name="play.circle.fill" size={52} tintColor="rgba(255,255,255,0.85)" type="monochrome" />
            <Text style={styles.syncOverlayText}>Tap to join the stream</Text>
          </Pressable>
        )}
      </View>

      {/* Host controls */}
      {isHost && (
        <View style={styles.controls}>
          {!isLive ? (
            <Pressable style={styles.goLiveBtn} onPress={handleGoLive} disabled={goLive.isPending}>
              <Text style={styles.goLiveBtnText}>🔴  Start Screening</Text>
            </Pressable>
          ) : (
            <View style={styles.playbackControls}>
              <Pressable style={styles.controlBtn} onPress={() => handleSkip(-15_000)} hitSlop={8}>
                <SymbolView name="gobackward.15" size={22} tintColor="#fff" type="monochrome" />
              </Pressable>
              <Pressable style={styles.playPauseBtn} onPress={handlePlayPause}>
                <SymbolView name={isPlaying ? 'pause.fill' : 'play.fill'} size={26} tintColor="#fff" type="monochrome" />
              </Pressable>
              <Pressable style={styles.controlBtn} onPress={() => handleSkip(15_000)} hitSlop={8}>
                <SymbolView name="goforward.15" size={22} tintColor="#fff" type="monochrome" />
              </Pressable>
              <Text style={styles.timeCode}>{formatTime(positionMs)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Chat */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.chatList}
        ListEmptyComponent={
          <Text style={styles.chatEmpty}>
            {isLive ? 'Chat is open — say something! 🍿' : 'Chat opens when the screening starts.'}
          </Text>
        }
        onContentSizeChange={() => {
          if (messages.length > 0) flatListRef.current?.scrollToEnd({ animated: false });
        }}
        renderItem={({ item }) => {
          const isMine = item.user_id === user?.id;
          return (
            <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
              {!isMine && <Avatar name={item.user_name} size={26} avatarUrl={item.user_avatar_url} />}
              <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
                {!isMine && <Text style={styles.bubbleName}>{item.user_name}</Text>}
                <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{item.content}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Message input */}
      <View style={[styles.inputRow, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          placeholder={isLive ? 'Say something…' : 'Chat while you wait…'}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={text}
          onChangeText={setText}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          editable={!!id}
        />
        <Pressable style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]} onPress={handleSend} disabled={!text.trim()}>
          <SymbolView name="arrow.up" size={16} tintColor="#fff" type="monochrome" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0A0A12' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  liveBadge: { backgroundColor: '#EF4444', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  liveBadgeText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 9, color: '#fff', letterSpacing: 0.5 },
  waitingBadge: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 8 },
  waitingBadgeText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.5 },
  roomTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff', flex: 1 },
  viewerCount: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  endText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#EF4444' },
  leaveText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: 'rgba(255,255,255,0.4)' },

  videoWrap: { height: 220, backgroundColor: '#000', position: 'relative' },
  syncOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  syncOverlayText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },

  // Host controls
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0F0D1A',
  },
  goLiveBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  goLiveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
  playbackControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  controlBtn: { padding: 4 },
  playPauseBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeCode: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: 'rgba(255,255,255,0.5)', marginLeft: 'auto' },

  // Chat
  chatList: { padding: 12, gap: 8, flexGrow: 1 },
  chatEmpty: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: 'rgba(255,255,255,0.25)',
    textAlign: 'center',
    marginTop: 30,
  },
  msgRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  msgRowMine: { flexDirection: 'row-reverse' },
  bubble: { maxWidth: '75%', borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12 },
  bubbleOther: { backgroundColor: 'rgba(255,255,255,0.08)', borderTopLeftRadius: 4 },
  bubbleMine: { backgroundColor: '#7C3AED', borderBottomRightRadius: 4 },
  bubbleName: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: '#A78BFA', marginBottom: 2 },
  bubbleText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: 'rgba(255,255,255,0.88)' },
  bubbleTextMine: { color: '#fff' },

  // Input
  inputRow: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    backgroundColor: '#0A0A12',
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 9,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: '#fff',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },

  // Ended
  endedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  endedEmoji: { fontSize: 52, marginBottom: 4 },
  endedTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: '#fff' },
  endedSub: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },
  leaveBtn: { marginTop: 16, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 14, paddingVertical: 13, paddingHorizontal: 28 },
  leaveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: 'rgba(255,255,255,0.6)' },
});
