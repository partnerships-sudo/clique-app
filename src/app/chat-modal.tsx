import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { MessageBubble } from '@/components/chat/message-bubble';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useSendMessage, useThreadMessages } from '@/features/chats/api';
import { useChatReadState, useDmReadState, useGroupReadState } from '@/features/chats/read-state';
import { isAhead, useEpisodeCheckpoint, type EpisodeCheckpoint } from '@/features/chats/spoiler-guard';
import { useContentDetails } from '@/features/content/api';
import {
  useAcceptDmRequest,
  useDeclineDmRequest,
  useDmMessages,
  useDmThreadState,
  useSendDm,
} from '@/features/dms/api';
import { useExtendedNetworkProfiles } from '@/features/follows/api';
import { useGroupMessages, useSendGroupMessage } from '@/features/groups/api';
import { searchGifs, type GiphyResult } from '@/features/chat-media/giphy';
import { pickAndUploadImage } from '@/features/chat-media/upload';
import { formatLastSeen, useMarkDmReadReceipt, useDmReadReceipt } from '@/features/presence/api';
import { useProfileById } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

type RawMessage = {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  content: string;
  post_type: EntryType;
  ep_season: number | null;
  ep_episode: number | null;
  created_at: string;
  avatar_url?: string | null;
  user_handle?: string;
};

type ListItem =
  | { kind: 'message'; data: RawMessage }
  | { kind: 'divider'; count: number };

export default function ChatModal() {
  const params = useLocalSearchParams<{
    title?: string;
    type?: EntryType;
    poster?: string;
    friendId?: string;
    friendName?: string;
    friendAvatar?: string;
    groupId?: string;
    groupName?: string;
  }>();
  const { user } = useSession();
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { bottom: bottomInset } = useSafeAreaInsets();
  const isGroup = !!params.groupId;
  const isDm = !isGroup && !!params.friendId;

  const threadMessages = useThreadMessages(!isDm && !isGroup ? params.title ?? null : null);
  const dmMessages = useDmMessages(isDm ? params.friendId! : null);
  const groupMessages = useGroupMessages(isGroup ? params.groupId! : null);
  const isLoading = isGroup ? groupMessages.isLoading : isDm ? dmMessages.isLoading : threadMessages.isLoading;
  const { data: dmThreadState } = useDmThreadState(isDm ? params.friendId : undefined);
  const isDmLocked = isDm && dmThreadState?.locked === true;
  const acceptDmRequest = useAcceptDmRequest();
  const declineDmRequest = useDeclineDmRequest();
  const { data: friends } = useExtendedNetworkProfiles();
  const friendAvatarById = useMemo(
    () => new Map((friends ?? []).map((f) => [f.id, f.avatar_url])),
    [friends],
  );
  // Chats show the person's @handle rather than their real name — the
  // full name is still stored on older rows/denormalized fields, so this
  // looks it up fresh from their profile instead of trusting that data.
  const friendHandleById = useMemo(
    () =>
      new Map(
        (friends ?? []).map((f) => [f.id, f.username ? `@${f.username}` : f.full_name || 'Someone']),
      ),
    [friends],
  );

  // Presence: show "Active now / X ago" in DM header, and "Read" under last sent message.
  const { data: friendProfile } = useProfileById(isDm ? params.friendId : undefined);
  const markDmReadReceipt = useMarkDmReadReceipt();
  const { data: counterpartReadAt } = useDmReadReceipt(isDm ? params.friendId : undefined);
  const friendLastSeenLabel = formatLastSeen(friendProfile?.last_seen_at);

  const sendMessage = useSendMessage();
  const sendDm = useSendDm();
  const sendGroupMessage = useSendGroupMessage(isGroup ? params.groupId! : null);
  const [input, setInput] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<TextInput>(null);
  const [mediaExpanded, setMediaExpanded] = useState(false);
  const [gifPickerOpen, setGifPickerOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GiphyResult[]>([]);
  const [gifsLoading, setGifsLoading] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const listRef = useRef<FlatList>(null);
  const isContentChat = !isDm && !isGroup;
  const isBookChat = isContentChat && params.type === 'read';
  // Movies don't have a spoiler-relevant "progress" the way TV shows do, so
  // only gate watch-type chats once we know it's specifically a series —
  // resolved via the same TMDB lookup content-detail-modal uses (and often
  // already cached from a user having viewed that screen first).
  const { data: watchDetails } = useContentDetails(
    isContentChat && params.type === 'watch' ? params.title : undefined,
    isContentChat && params.type === 'watch' ? 'watch' : undefined,
  );
  const isTVChat = isContentChat && params.type === 'watch' && watchDetails?.mediaType === 'tv';
  const needsSpoilerGuard = isTVChat || isBookChat;
  const { loaded: checkpointLoaded, checkpoint, setCheckpoint } = useEpisodeCheckpoint(
    isContentChat ? params.title ?? null : null,
  );
  const [season, setSeason] = useState(1);
  const [episode, setEpisode] = useState(1);
  // Real per-season episode counts straight from TMDB — stays correct as new
  // seasons air with zero upkeep on our side, since we never store this
  // ourselves, just read it live each time.
  const seasons = watchDetails?.seasons ?? [];
  const maxSeason = seasons.length > 0 ? seasons[seasons.length - 1].seasonNumber : undefined;
  const maxEpisode = seasons.find((s) => s.seasonNumber === season)?.episodeCount;

  function stepSeason(delta: number) {
    const next = Math.max(1, maxSeason ? Math.min(maxSeason, season + delta) : season + delta);
    setSeason(next);
    const cap = seasons.find((s) => s.seasonNumber === next)?.episodeCount;
    if (cap && episode > cap) setEpisode(cap);
  }

  function stepEpisode(delta: number) {
    const next = Math.max(1, maxEpisode ? Math.min(maxEpisode, episode + delta) : episode + delta);
    setEpisode(next);
  }
  // forceShowGate: user tapped the checkpoint badge to update their progress
  const [forceShowGate, setForceShowGate] = useState(false);
  // cautionExpanded: user chose to reveal the messages below the spoiler line
  const [cautionExpanded, setCautionExpanded] = useState(false);

  const { markRead: markChatRead } = useChatReadState();
  const { markRead: markDmRead } = useDmReadState();
  const { markRead: markGroupRead } = useGroupReadState();

  const type = TypeColors[params.type as EntryType] ?? TypeColors.watch;

  // Gate visible on first visit (no checkpoint yet) OR when user taps to update
  const isGateVisible = needsSpoilerGuard && checkpointLoaded && (!checkpoint || forceShowGate) && !searchVisible;

  const messages: RawMessage[] = isGroup
    ? (groupMessages.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.user_id,
        user_name: m.user_id === user?.id ? 'You' : m.sender_name,
        title: '',
        content: m.text,
        post_type: 'watch' as EntryType,
        ep_season: null,
        ep_episode: null,
        created_at: m.created_at,
        avatar_url: m.sender_avatar,
        user_handle: friendHandleById.get(m.user_id) ?? m.sender_name,
      }))
    : isDm
    ? (dmMessages.data ?? []).map((m) => ({
        id: m.id,
        user_id: m.sender_id,
        user_name: m.sender_id === user?.id ? 'You' : params.friendName ?? 'Friend',
        title: '',
        content: m.content,
        post_type: 'watch' as EntryType,
        ep_season: null,
        ep_episode: null,
        created_at: m.created_at,
        avatar_url: params.friendAvatar ?? null,
        user_handle: friendHandleById.get(params.friendId!) ?? params.friendName ?? 'Friend',
      }))
    : ((threadMessages.data ?? []) as RawMessage[]).map((m) => ({
        ...m,
        avatar_url: friendAvatarById.get(m.user_id) ?? null,
        user_handle: friendHandleById.get(m.user_id) ?? m.user_name,
      }));

  useEffect(() => {
    if (isGroup && params.groupId) markGroupRead(params.groupId);
    else if (isDm && params.friendId) {
      markDmRead(params.friendId);
      markDmReadReceipt(params.friendId);
    }
    else if (params.title) markChatRead(params.title);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  // Split messages at the checkpoint timestamp.
  // Messages posted before the checkpoint was set = safe zone.
  // Messages posted after = potentially spoilery (sender may have watched further).
  const cautionCutoff =
    needsSpoilerGuard && checkpoint && !checkpoint.finished ? checkpoint.updatedAt : null;
  const safeMessages = cautionCutoff
    ? messages.filter((m) => m.created_at <= cautionCutoff)
    : messages;
  const cautionMessages = cautionCutoff
    ? messages.filter((m) => m.created_at > cautionCutoff)
    : [];

  const listItems: ListItem[] = [
    ...safeMessages.map((m) => ({ kind: 'message' as const, data: m })),
    ...(cautionMessages.length > 0
      ? [{ kind: 'divider' as const, count: cautionMessages.length }]
      : []),
    ...(cautionExpanded
      ? cautionMessages.map((m) => ({ kind: 'message' as const, data: m }))
      : []),
  ];

  const searchActive = searchVisible && searchQuery.trim().length > 0;
  const filteredMessages = searchActive
    ? messages.filter((m) => m.content.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : null;
  const displayItems: ListItem[] = searchActive
    ? (filteredMessages ?? []).map((m) => ({ kind: 'message' as const, data: m }))
    : listItems;

  function toggleSearch() {
    const next = !searchVisible;
    setSearchVisible(next);
    setSearchQuery('');
    if (next) setTimeout(() => searchInputRef.current?.focus(), 80);
  }

  // ID of the last message I sent in this DM (for the "Read" receipt indicator).
  const lastSentId = isDm
    ? [...messages].reverse().find((m) => m.user_id === user?.id)?.id ?? null
    : null;
  const lastSentReadByFriend =
    lastSentId !== null &&
    counterpartReadAt != null &&
    (() => {
      const sentMsg = messages.find((m) => m.id === lastSentId);
      return sentMsg ? counterpartReadAt >= sentMsg.created_at : false;
    })();

  function saveCheckpoint(cp: EpisodeCheckpoint) {
    if (!params.title) return;
    setCheckpoint(params.title, cp);
    setForceShowGate(false);
    setCautionExpanded(false);
  }

  async function handlePickPhoto() {
    if (!user) return;
    setMediaExpanded(false);
    setPhotoUploading(true);
    try {
      const content = await pickAndUploadImage(user.id);
      if (!content) return;
      if (isGroup) { sendGroupMessage.mutate(content); return; }
      if (isDm) { sendDm.mutate({ friendId: params.friendId!, content }); return; }
      if (!params.title) return;
      sendMessage.mutate({ title: params.title, type: params.type as EntryType, content });
    } finally {
      setPhotoUploading(false);
    }
  }

  function openGifPicker() {
    setMediaExpanded(false);
    setGifPickerOpen(true);
    setGifQuery('');
    setGifsLoading(true);
    searchGifs('').then((results) => { setGifs(results); setGifsLoading(false); }).catch(() => setGifsLoading(false));
  }

  function searchGifQuery(q: string) {
    setGifQuery(q);
    setGifsLoading(true);
    searchGifs(q).then((results) => { setGifs(results); setGifsLoading(false); }).catch(() => setGifsLoading(false));
  }

  function sendGif(gif: GiphyResult) {
    setGifPickerOpen(false);
    const content = `__gif:${gif.url}__`;
    if (isGroup) {
      sendGroupMessage.mutate(content);
      return;
    }
    if (isDm) {
      sendDm.mutate({ friendId: params.friendId!, content });
      return;
    }
    if (!params.title) return;
    sendMessage.mutate({
      title: params.title,
      type: params.type as EntryType,
      content,
    });
  }

  function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    if (isGroup) {
      sendGroupMessage.mutate(text);
      return;
    }
    if (isDm) {
      sendDm.mutate({ friendId: params.friendId!, content: text });
      return;
    }
    if (!params.title) return;
    sendMessage.mutate({
      title: params.title,
      type: params.type as EntryType,
      content: text,
      epSeason: checkpoint && !checkpoint.finished ? checkpoint.season : undefined,
      epEpisode: checkpoint && !checkpoint.finished ? checkpoint.episode : undefined,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.sheet}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Pressable
            style={styles.headerInfo}
            onPress={
              isGroup
                ? () =>
                    router.push({
                      pathname: '/group-info-modal',
                      params: { groupId: params.groupId!, groupName: params.groupName ?? 'Group Chat' },
                    })
                : needsSpoilerGuard && checkpoint
                ? () => { setForceShowGate(true); setCautionExpanded(false); }
                : undefined
            }
            disabled={!isGroup && !(needsSpoilerGuard && checkpoint)}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isGroup ? (params.groupName ?? 'Group Chat') : isDm ? (params.friendName ?? 'Friend') : params.title}
            </Text>
            <Text style={styles.headerSub}>
              {isGroup
                ? 'Tap to see members ›'
                : isDm
                ? (friendLastSeenLabel || 'Private chat')
                : needsSpoilerGuard && checkpoint
                ? checkpoint.finished
                  ? 'Fully caught up · tap to update ›'
                  : isBookChat
                    ? `Chapter ${checkpoint.episode} · tap to update ›`
                    : `S${checkpoint.season}E${checkpoint.episode} · tap to update ›`
                : `Chatting about this ${type.label.toLowerCase()}`}
            </Text>
          </Pressable>
          <Pressable onPress={toggleSearch} hitSlop={10} style={styles.searchToggleBtn}>
            <SymbolView
              name={searchVisible ? 'xmark' : 'magnifyingglass'}
              size={16}
              tintColor={searchVisible ? Brand.trust : Brand.muted}
              type="monochrome"
              style={{ width: 18, height: 18 }}
            />
          </Pressable>
          {isGroup ? (
            <View style={[styles.headerIconBox, { backgroundColor: Brand.tlight }]}>
              <Text style={styles.headerIcon}>👥</Text>
            </View>
          ) : isDm ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/friend-profile-modal', params: { userId: params.friendId! } })
              }
              hitSlop={8}>
              <Avatar name={params.friendName ?? 'Friend'} size={38} avatarUrl={params.friendAvatar} />
            </Pressable>
          ) : params.poster ? (
            <Image source={{ uri: params.poster }} style={styles.headerIconBox} />
          ) : (
            <View style={[styles.headerIconBox, { backgroundColor: type.bg }]}>
              <Text style={styles.headerIcon}>{type.icon}</Text>
            </View>
          )}
        </View>

        {searchVisible && (
          <View style={styles.searchBar}>
            <SymbolView
              name="magnifyingglass"
              size={14}
              tintColor={Brand.muted}
              type="monochrome"
              style={{ width: 16, height: 16 }}
            />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search messages…"
              placeholderTextColor={Brand.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <Text style={styles.searchCount}>
                {filteredMessages?.length === 0
                  ? 'No results'
                  : `${filteredMessages?.length} result${filteredMessages?.length === 1 ? '' : 's'}`}
              </Text>
            )}
          </View>
        )}

        {isDmLocked ? (
          <View style={styles.gate}>
            <Avatar name={params.friendName ?? 'Someone'} size={64} avatarUrl={params.friendAvatar} />
            <Text style={[styles.gateTitle, { marginTop: 14 }]}>Message Request</Text>
            <Text style={styles.gateBody}>
              {(params.friendName ?? 'This person')} wants to send you a message. Accept to see it and reply, or
              decline to keep it hidden.
            </Text>
            <Pressable
              style={styles.gateBtn}
              disabled={acceptDmRequest.isPending}
              onPress={() => acceptDmRequest.mutate(params.friendId!)}>
              <Text style={styles.gateBtnText}>Accept</Text>
            </Pressable>
            <Pressable
              style={styles.gateCaughtUp}
              disabled={declineDmRequest.isPending}
              onPress={() => {
                declineDmRequest.mutate(params.friendId!);
                router.back();
              }}>
              <Text style={styles.gateCaughtUpText}>Decline</Text>
            </Pressable>
          </View>
        ) : isGateVisible ? (
          <View style={styles.gate}>
            <Text style={styles.gateEmoji}>🙈</Text>
            <Text style={styles.gateTitle}>Where are you up to?</Text>
            <Text style={styles.gateBody}>
              Messages sent after you set this will be behind a spoiler line — one tap to reveal the whole zone, nothing buried message-by-message.
            </Text>
            <View style={styles.gateRow}>
              {isBookChat ? (
                <View style={styles.gateField}>
                  <Text style={styles.gateLabel}>Chapter</Text>
                  <View style={styles.stepper}>
                    <Pressable
                      style={styles.stepBtn}
                      onPress={() => setEpisode((e) => Math.max(1, e - 1))}
                      hitSlop={8}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{episode}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => setEpisode((e) => e + 1)} hitSlop={8}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.gateField}>
                    <Text style={styles.gateLabel}>Season{maxSeason ? ` (of ${maxSeason})` : ''}</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => stepSeason(-1)} hitSlop={8}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepValue}>{season}</Text>
                      <Pressable style={styles.stepBtn} onPress={() => stepSeason(1)} hitSlop={8}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.gateField}>
                    <Text style={styles.gateLabel}>Episode{maxEpisode ? ` (of ${maxEpisode})` : ''}</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => stepEpisode(-1)} hitSlop={8}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepValue}>{episode}</Text>
                      <Pressable style={styles.stepBtn} onPress={() => stepEpisode(1)} hitSlop={8}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                </>
              )}
            </View>
            <Pressable
              style={styles.gateBtn}
              onPress={() =>
                saveCheckpoint({
                  season: isBookChat ? 1 : season,
                  episode,
                  updatedAt: new Date().toISOString(),
                })
              }>
              <Text style={styles.gateBtnText}>Set progress</Text>
            </Pressable>
            <Pressable
              style={styles.gateCaughtUp}
              onPress={() =>
                saveCheckpoint({ season: 0, episode: 0, updatedAt: new Date().toISOString(), finished: true })
              }>
              <Text style={styles.gateCaughtUpText}>I'm fully caught up — show everything</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={styles.messages}
            contentContainerStyle={styles.messagesContent}
            data={displayItems}
            keyExtractor={(item) => (item.kind === 'divider' ? '__spoiler_divider__' : item.data.id)}
            renderItem={({ item }) => {
              if (item.kind === 'divider') {
                return (
                  <SpoilerDivider
                    checkpoint={checkpoint!}
                    isBookChat={isBookChat}
                    count={item.count}
                    onExpand={() => {
                      setCautionExpanded(true);
                      // scroll to end so the revealed messages are visible
                      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
                    }}
                  />
                );
              }
              const showRead = isDm && item.data.id === lastSentId && lastSentReadByFriend;
              return (
                <View>
                  <MessageBubble
                    message={item.data}
                    isMine={item.data.user_id === user?.id}
                    avatarUrl={item.data.avatar_url}
                    userHandle={item.data.user_handle}
                    isSpoiler={
                      needsSpoilerGuard &&
                      item.data.user_id !== user?.id &&
                      !!checkpoint &&
                      !checkpoint.finished &&
                      isAhead(item.data, checkpoint)
                    }
                  />
                  {showRead && (
                    <Text style={styles.readReceipt}>Read</Text>
                  )}
                </View>
              );
            }}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
            onContentSizeChange={() => { if (!searchActive) listRef.current?.scrollToEnd({ animated: false }); }}
            ListEmptyComponent={
              !isLoading ? <Text style={styles.empty}>Say something to kick off the chat.</Text> : null
            }
          />
        )}

        {!isDmLocked ? (
          <View style={[styles.inputWrap, { paddingBottom: 10 + bottomInset }]}>
            <View style={styles.inputRow}>
              <Pressable
                style={[styles.plusBtn, mediaExpanded && styles.plusBtnActive]}
                onPress={() => setMediaExpanded((v) => !v)}
                hitSlop={8}>
                <Text style={styles.plusText}>{mediaExpanded ? '✕' : '+'}</Text>
              </Pressable>
              <TextInput
                style={styles.input}
                placeholder="Say something…"
                placeholderTextColor={Brand.muted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable style={styles.sendBtn} onPress={handleSend} hitSlop={8}>
                <Text style={styles.sendText}>➤</Text>
              </Pressable>
            </View>
            {mediaExpanded ? (
              <View style={styles.mediaTiles}>
                <Pressable
                  style={[styles.mediaPill, styles.mediaPillPhoto, { opacity: photoUploading ? 0.55 : 1 }]}
                  onPress={handlePickPhoto}
                  disabled={photoUploading}>
                  <SymbolView
                    name={photoUploading ? 'arrow.up.circle' : 'photo'}
                    size={15}
                    tintColor="#5B8DEF"
                    type="monochrome"
                    style={{ width: 16, height: 16 }}
                  />
                  <Text style={[styles.mediaPillLabel, { color: '#5B8DEF' }]}>
                    {photoUploading ? 'Uploading…' : 'Photo'}
                  </Text>
                </Pressable>
                <Pressable style={[styles.mediaPill, styles.mediaPillGif]} onPress={openGifPicker}>
                  <Text style={styles.mediaPillGifText}>GIF</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        <Modal visible={gifPickerOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setGifPickerOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: Brand.paper }} edges={['top']}>
            <View style={styles.gifHeader}>
              <TextInput
                style={styles.gifSearch}
                placeholder="Search GIFs…"
                placeholderTextColor={Brand.muted}
                value={gifQuery}
                onChangeText={searchGifQuery}
                autoFocus
                returnKeyType="search"
              />
              <Pressable onPress={() => setGifPickerOpen(false)} hitSlop={8} style={styles.gifCloseBtn}>
                <Text style={styles.gifCloseText}>✕</Text>
              </Pressable>
            </View>
            {gifsLoading ? (
              <View style={styles.gifLoading}>
                <Text style={{ color: Brand.muted, fontFamily: BrandFonts.interRegular }}>Loading…</Text>
              </View>
            ) : (
              <FlatList
                data={gifs}
                keyExtractor={(g) => g.id}
                numColumns={2}
                contentContainerStyle={styles.gifGrid}
                columnWrapperStyle={{ gap: 4 }}
                renderItem={({ item }) => (
                  <Pressable onPress={() => sendGif(item)} style={styles.gifCell}>
                    <Image source={{ uri: item.preview }} style={styles.gifThumb} resizeMode="cover" />
                  </Pressable>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
              />
            )}
          </SafeAreaView>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SpoilerDivider({
  checkpoint,
  isBookChat,
  count,
  onExpand,
}: {
  checkpoint: EpisodeCheckpoint;
  isBookChat: boolean;
  count: number;
  onExpand: () => void;
}) {
  const Brand = useBrand();
  return (
    <View style={{ marginVertical: 10 }}>
      <View style={{ height: 1, backgroundColor: Brand.warm + '55', marginBottom: 14 }} />
      <View style={{ alignItems: 'center', paddingHorizontal: 24, gap: 6 }}>
        <Text
          style={{
            fontFamily: BrandFonts.syneBold,
            fontSize: 12,
            color: Brand.warm,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
          }}>
          ⚠️{' '}
          {checkpoint.finished
            ? 'Fully caught up'
            : isBookChat
              ? `You're on Chapter ${checkpoint.episode}`
              : `You're on S${checkpoint.season}E${checkpoint.episode}`}
        </Text>
        <Text
          style={{
            fontFamily: BrandFonts.interRegular,
            fontSize: 12.5,
            color: Brand.muted,
            textAlign: 'center',
            lineHeight: 17,
          }}>
          {count} message{count !== 1 ? 's' : ''} below may go further.{'\n'}Read carefully.
        </Text>
        <Pressable
          style={{
            marginTop: 6,
            paddingHorizontal: 22,
            paddingVertical: 10,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: Brand.warm,
          }}
          onPress={onExpand}>
          <Text
            style={{
              fontFamily: BrandFonts.syneBold,
              fontSize: 13,
              color: Brand.warm,
            }}>
            Show {count} message{count !== 1 ? 's' : ''}
          </Text>
        </Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: Brand.warm + '55', marginTop: 14 }} />
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    sheet: { flex: 1, backgroundColor: Brand.paper },
    header: {
      backgroundColor: Brand.card,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backText: { fontSize: 16, color: Brand.ink },
    gate: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    gateEmoji: { fontSize: 36, marginBottom: 10 },
    gateTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
      marginBottom: 8,
    },
    gateBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 19,
      marginBottom: 22,
    },
    gateRow: { flexDirection: 'row', gap: 24, marginBottom: 26 },
    gateField: { alignItems: 'center' },
    gateLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnText: { fontSize: 18, color: Brand.ink, fontFamily: BrandFonts.syneBold },
    stepValue: {
      fontSize: 20,
      fontFamily: BrandFonts.syneExtraBold,
      color: Brand.ink,
      minWidth: 28,
      textAlign: 'center',
    },
    gateBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      paddingHorizontal: 32,
    },
    gateBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    gateCaughtUp: { marginTop: 16, padding: 8 },
    gateCaughtUpText: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: Brand.trust,
      textDecorationLine: 'underline',
    },
    readReceipt: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
      textAlign: 'right',
      marginTop: 3,
      marginRight: 4,
    },
    headerInfo: { flex: 1, minWidth: 0 },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 1 },
    headerIconBox: {
      width: 38,
      height: 38,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerIcon: { fontSize: 18 },
    messages: { flex: 1 },
    messagesContent: { padding: Spacing.three },
    empty: {
      textAlign: 'center',
      paddingVertical: 30,
      color: Brand.muted,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
    },
    inputRow: {
      flexDirection: 'row',
      gap: 10,
      alignItems: 'center',
    },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 24,
      paddingHorizontal: 16,
      paddingVertical: 11,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.paper,
    },
    sendBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sendText: { color: '#fff', fontSize: 13 },

    // Plus / media expand
    inputWrap: {
      backgroundColor: Brand.card,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      paddingHorizontal: Spacing.three,
      paddingTop: 10,
      paddingBottom: 10,
    },
    plusBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    plusBtnActive: { backgroundColor: Brand.muted },
    plusText: { color: '#fff', fontSize: 17, lineHeight: 20 },
    mediaTiles: {
      flexDirection: 'row',
      gap: 8,
      paddingTop: 12,
      paddingBottom: 2,
    },
    mediaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 34,
      borderRadius: 17,
      paddingHorizontal: 14,
      borderWidth: 1.5,
    },
    mediaPillPhoto: {
      backgroundColor: 'rgba(91,141,239,0.08)',
      borderColor: 'rgba(91,141,239,0.28)',
    },
    mediaPillGif: {
      backgroundColor: Brand.tlight,
      borderColor: Brand.trust + '44',
    },
    mediaPillLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13,
    },
    mediaPillGifText: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 13,
      color: Brand.trust,
      letterSpacing: 0.5,
    },

    // GIF picker modal
    gifHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    gifSearch: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 22,
      paddingHorizontal: 16,
      paddingVertical: 10,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.paper,
    },
    gifCloseBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    gifCloseText: { fontSize: 14, color: Brand.ink },
    gifGrid: { padding: 4 },
    gifCell: { flex: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: Brand.border },
    gifThumb: { width: '100%', aspectRatio: 1 },
    gifLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    searchToggleBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.three,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    searchInput: {
      flex: 1,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      paddingVertical: 0,
    },
    searchCount: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      flexShrink: 0,
    },
  });
}
