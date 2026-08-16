import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { KeyboardAvoidingWrapper } from '@/components/keyboard-avoiding-wrapper';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { MessageBubble } from '@/components/chat/message-bubble';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useSendMessage, useThreadMessages } from '@/features/chats/api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
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
import { useGroupInfo, useGroupMembers, useGroupMessages, useSendGroupMessage } from '@/features/groups/api';
import { searchGifs, type GiphyResult } from '@/features/chat-media/giphy';
import { pickAndUploadImage } from '@/features/chat-media/upload';
import { formatLastSeen, useMarkDmReadReceipt, useDmReadReceipt } from '@/features/presence/api';
import { useProfileById } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { parseWatchPartyInvite, type WatchPartyInvitePayload } from '@/features/dms/watch-party-invite';

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
  parent_id?: string | null;
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
  const { data: groupInfo } = useGroupInfo(isGroup ? params.groupId! : null);
  const { data: groupMembers = [] } = useGroupMembers(isGroup ? params.groupId! : null);
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
  const [membersVisible, setMembersVisible] = useState(false);
  const listRef = useRef<FlatList>(null);
  const queryClient = useQueryClient();
  const deleteMyMessages = useMutation({
    mutationFn: async () => {
      if (!user || !params.title) return;
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('title', params.title)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', params.title] });
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      router.back();
    },
  });
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
  const isGateVisible = !isContentChat && needsSpoilerGuard && checkpointLoaded && (!checkpoint || forceShowGate) && !searchVisible;

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

  // Pinned watch party invite — most recent invite in this DM thread
  let pinnedInvite: WatchPartyInvitePayload | null = null;
  if (isDm) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const parsed = parseWatchPartyInvite(messages[i].content);
      if (parsed) { pinnedInvite = parsed; break; }
    }
  }

  useEffect(() => {
    if (isGroup && params.groupId) {
      const latest = groupMessages.data?.at(-1)?.created_at;
      markGroupRead(params.groupId, latest);
    } else if (isDm && params.friendId) {
      // Pass the latest message's server timestamp so the read pointer is
      // anchored to the DB clock, not the client clock (avoids skew ghosts).
      const latest = dmMessages.data?.at(-1)?.created_at;
      markDmRead(params.friendId, latest);
      markDmReadReceipt(params.friendId);
    } else if (params.title) {
      markChatRead(params.title);
    }
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

  function handleSendReply(parentId: string, content: string) {
    if (!params.title) return;
    sendMessage.mutate({
      title: params.title,
      type: params.type as EntryType,
      content,
      parentId,
    });
  }

  const uniqueUsers = useMemo(() => new Set(messages.map((m) => m.user_id)).size, [messages]);
  const [threadFilter, setThreadFilter] = useState<ThreadFilter>('All');

  const topLevelPosts = useMemo(() => messages.filter((m) => !m.parent_id), [messages]);
  const uniqueMemberMessages = useMemo(
    () => Array.from(new Map(messages.map((m) => [m.user_id, m])).values()),
    [messages],
  );
  const repliesByParent = useMemo(() => {
    const map = new Map<string, RawMessage[]>();
    for (const m of messages) {
      if (m.parent_id) {
        const arr = map.get(m.parent_id) ?? [];
        arr.push(m);
        map.set(m.parent_id, arr);
      }
    }
    return map;
  }, [messages]);

  const filteredPosts = useMemo(() => {
    if (!isContentChat) return topLevelPosts;
    if (threadFilter === 'Mine') return topLevelPosts.filter((m) => m.user_id === user?.id);
    if (threadFilter === 'Recent') return [...topLevelPosts].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return topLevelPosts;
  }, [topLevelPosts, threadFilter, isContentChat, user?.id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingWrapper style={styles.sheet}>
        {/* Compact header for DMs and group chats only */}
        {!isContentChat && (
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={16}>
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
                  : () => isDm && router.push({ pathname: '/friend-profile-modal', params: { userId: params.friendId! } })
              }>
              {isDm ? (
                <Avatar name={params.friendName ?? 'Friend'} size={34} avatarUrl={params.friendAvatar} />
              ) : groupInfo?.photo_url ? (
                <Image source={{ uri: groupInfo.photo_url }} style={styles.headerGroupPhoto} />
              ) : (
                <View style={[styles.headerIconBox, { backgroundColor: Brand.tlight }]}>
                  <Text style={styles.headerIcon}>👥</Text>
                </View>
              )}
              <Text style={styles.headerTitle} numberOfLines={1}>
                {isGroup
                  ? (groupInfo?.name ?? params.groupName ?? 'Group Chat')
                  : friendProfile?.username
                    ? `@${friendProfile.username} (${params.friendName ?? 'Friend'})`
                    : (params.friendName ?? 'Friend')}
              </Text>
            </Pressable>
            <View style={styles.headerRight}>
              {isGroup && groupMembers.length > 0 ? (
                <Pressable
                  hitSlop={8}
                  style={styles.memberAvatarStack}
                  onPress={() => router.push({ pathname: '/group-info-modal', params: { groupId: params.groupId!, groupName: groupInfo?.name ?? params.groupName ?? 'Group Chat' } })}>
                  {groupMembers.slice(0, 4).map((m, i) => (
                    <View key={m.userId} style={[styles.memberAvatarWrap, { zIndex: 4 - i, marginLeft: i === 0 ? 0 : -8 }]}>
                      <Avatar name={m.name} size={24} avatarUrl={m.avatarUrl} />
                    </View>
                  ))}
                </Pressable>
              ) : null}
              <Pressable onPress={toggleSearch} hitSlop={10} style={styles.searchToggleBtn}>
                <SymbolView
                  name={searchVisible ? 'xmark' : 'magnifyingglass'}
                  size={16}
                  tintColor={searchVisible ? Brand.trust : Brand.muted}
                  type="monochrome"
                  style={{ width: 18, height: 18 }}
                />
              </Pressable>
            </View>
          </View>
        )}

        {searchVisible && (
          <View style={[styles.searchBar, isContentChat && { backgroundColor: Brand.paper }]}>
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

        {isContentChat && (
          <View style={[cb.topBar, { position: 'relative', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: Brand.paper }]}>
            <Pressable onPress={() => router.back()} hitSlop={16} style={[cb.iconBtn, { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border }]}>
              <SymbolView name="chevron.left" size={16} tintColor={Brand.ink} type="monochrome" style={{ width: 16, height: 16 }} />
            </Pressable>
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
                      hitSlop={16}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </Pressable>
                    <Text style={styles.stepValue}>{episode}</Text>
                    <Pressable style={styles.stepBtn} onPress={() => setEpisode((e) => e + 1)} hitSlop={16}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.gateField}>
                    <Text style={styles.gateLabel}>Season{maxSeason ? ` (of ${maxSeason})` : ''}</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => stepSeason(-1)} hitSlop={16}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepValue}>{season}</Text>
                      <Pressable style={styles.stepBtn} onPress={() => stepSeason(1)} hitSlop={16}>
                        <Text style={styles.stepBtnText}>+</Text>
                      </Pressable>
                    </View>
                  </View>
                  <View style={styles.gateField}>
                    <Text style={styles.gateLabel}>Episode{maxEpisode ? ` (of ${maxEpisode})` : ''}</Text>
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => stepEpisode(-1)} hitSlop={16}>
                        <Text style={styles.stepBtnText}>−</Text>
                      </Pressable>
                      <Text style={styles.stepValue}>{episode}</Text>
                      <Pressable style={styles.stepBtn} onPress={() => stepEpisode(1)} hitSlop={16}>
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
          <>
{pinnedInvite && (
              <Pressable
                style={styles.pinnedInvite}
                onPress={() => router.push({ pathname: '/premiere-waiting-room', params: { id: pinnedInvite.id } })}>
                {pinnedInvite.poster ? (
                  <Image source={{ uri: pinnedInvite.poster }} style={styles.pinnedInvitePoster} resizeMode="cover" />
                ) : (
                  <View style={[styles.pinnedInvitePoster, { alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ fontSize: 16 }}>🎬</Text>
                  </View>
                )}
                <View style={styles.pinnedInviteBody}>
                  <Text style={styles.pinnedInviteLabel}>📌 Watch Party</Text>
                  <Text style={styles.pinnedInviteTitle} numberOfLines={1}>{pinnedInvite.title}</Text>
                  {pinnedInvite.date ? (
                    <Text style={styles.pinnedInviteMeta} numberOfLines={1}>
                      {pinnedInvite.date}{pinnedInvite.time ? ` · ${pinnedInvite.time}` : ''}
                    </Text>
                  ) : null}
                </View>
                <SymbolView name="chevron.right" size={12} tintColor="#999" type="monochrome" style={{ width: 12, height: 12 }} />
              </Pressable>
            )}
          <FlatList
            ref={listRef}
            style={styles.messages}
            contentContainerStyle={isContentChat ? { paddingTop: 12, paddingBottom: 20 } : styles.messagesContent}
            data={isContentChat ? filteredPosts.map((m) => ({ kind: 'message' as const, data: m })) : displayItems}
            keyExtractor={(item) => (item.kind === 'divider' ? '__spoiler_divider__' : item.data.id)}
            ListHeaderComponent={isContentChat ? (
              <ContentBanner
                poster={params.poster}
                title={params.title}
                type={type}
                messageCount={messages.length}
                uniqueUsers={uniqueUsers}
                onBack={() => router.back()}
                onSearch={toggleSearch}
                onMembers={() => setMembersVisible(true)}
                filter={threadFilter}
                onFilter={setThreadFilter}
              />
            ) : null}
            renderItem={({ item }) => {
              if (item.kind === 'divider') {
                return (
                  <SpoilerDivider
                    checkpoint={checkpoint!}
                    isBookChat={isBookChat}
                    count={item.count}
                    onExpand={() => {
                      setCautionExpanded(true);
                      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
                    }}
                  />
                );
              }
              const isMine = item.data.user_id === user?.id;
              if (isContentChat) {
                return (
                  <ContentPost
                    post={item.data}
                    replies={repliesByParent.get(item.data.id) ?? []}
                    isMine={isMine}
                    onSendReply={handleSendReply}
                  />
                );
              }
              const showRead = isDm && item.data.id === lastSentId && lastSentReadByFriend;
              return (
                <View>
                  <MessageBubble
                    message={item.data}
                    isMine={isMine}
                    avatarUrl={item.data.avatar_url}
                    userHandle={item.data.user_handle}
                    isSpoiler={
                      needsSpoilerGuard &&
                      !isMine &&
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
            ItemSeparatorComponent={isContentChat ? null : () => <View style={{ height: 14 }} />}
            onContentSizeChange={() => { if (!searchActive) listRef.current?.scrollToEnd({ animated: false }); }}
            ListEmptyComponent={
              !isLoading ? (
                <Text style={[styles.empty, isContentChat && { marginTop: 40 }]}>
                  Say something to kick off the chat.
                </Text>
              ) : null
            }
          />
          </>
        )}

        {!isDmLocked ? (
          <View style={[styles.inputWrap, { paddingBottom: 10 + bottomInset }]}>
            <View style={styles.inputRow}>
              <Pressable
                style={[styles.plusBtn, mediaExpanded && styles.plusBtnActive]}
                onPress={() => setMediaExpanded((v) => !v)}
                hitSlop={16}>
                <Text style={styles.plusText}>{mediaExpanded ? '✕' : '+'}</Text>
              </Pressable>
              <TextInput
                style={styles.input}
                placeholder={isContentChat ? 'Write a post…' : 'Say something…'}
                placeholderTextColor={Brand.muted}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSend}
                returnKeyType="send"
              />
              <Pressable style={styles.sendBtn} onPress={handleSend} hitSlop={16}>
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

        <Modal visible={membersVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMembersVisible(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: Brand.paper }} edges={['top']}>
            <View style={styles.membersHeader}>
              <Text style={styles.membersTitle}>Members</Text>
              <Pressable onPress={() => setMembersVisible(false)} hitSlop={16} style={styles.gifCloseBtn}>
                <Text style={styles.gifCloseText}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.membersList}>
              {uniqueMemberMessages.map((m) => (
                <View key={m.user_id} style={styles.memberRow}>
                  <Avatar
                    name={m.user_handle ?? m.user_name}
                    size={36}
                    avatarUrl={m.avatar_url}
                  />
                  <Text style={styles.memberName}>
                    {m.user_id === user?.id ? 'You' : (m.user_handle ?? m.user_name)}
                  </Text>
                  {m.user_id === user?.id && (
                    <Text style={styles.memberYouBadge}>you</Text>
                  )}
                </View>
              ))}
            </ScrollView>
            <View style={[styles.membersFooter, { paddingBottom: 24 }]}>
              <Pressable
                style={styles.leaveBtn}
                onPress={() => {
                  Alert.alert(
                    'Leave chat?',
                    undefined,
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Leave',
                        onPress: () => {
                          setMembersVisible(false);
                          router.back();
                        },
                      },
                      {
                        text: 'Leave & delete my messages',
                        style: 'destructive',
                        onPress: () => {
                          setMembersVisible(false);
                          deleteMyMessages.mutate();
                        },
                      },
                    ],
                  );
                }}
                disabled={deleteMyMessages.isPending}>
                <Text style={styles.leaveBtnText}>Leave Chat</Text>
              </Pressable>
            </View>
          </SafeAreaView>
        </Modal>

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
              <Pressable onPress={() => setGifPickerOpen(false)} hitSlop={16} style={styles.gifCloseBtn}>
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
      </KeyboardAvoidingWrapper>
    </SafeAreaView>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const THREAD_FILTERS = ['All', 'Recent', 'Mine'] as const;
type ThreadFilter = typeof THREAD_FILTERS[number];

function ContentBanner({
  poster, title, type, messageCount, uniqueUsers,
  onBack, onSearch, onMembers, filter, onFilter,
}: {
  poster?: string; title?: string; type: ReturnType<typeof useTypeColors>[keyof ReturnType<typeof useTypeColors>];
  messageCount: number; uniqueUsers: number;
  onBack: () => void; onSearch: () => void; onMembers: () => void;
  filter: ThreadFilter; onFilter: (f: ThreadFilter) => void;
}) {
  const Brand = useBrand();
  return (
    <View>
      {/* Compact card-style header */}
      <View style={[cb.header, { backgroundColor: Brand.card, borderBottomColor: Brand.border }]}>
        <Pressable onPress={onBack} hitSlop={16} style={cb.backBtn}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.ink} type="monochrome" style={{ width: 18, height: 18 }} />
        </Pressable>

        {/* Poster thumbnail */}
        <View style={[cb.thumb, { borderColor: Brand.border }]}>
          {poster ? (
            <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: type.bg, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ fontSize: 22 }}>{type.icon}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={cb.info}>
          <Text style={[cb.titleText, { color: Brand.ink }]} numberOfLines={2}>{title}</Text>
          <View style={cb.metaRow}>
            <View style={[cb.typeBadge, { backgroundColor: type.color + '18', borderColor: type.color + '55' }]}>
              <Text style={[cb.typeBadgeText, { color: type.color }]}>{type.label}</Text>
            </View>
            <Text style={[cb.statText, { color: Brand.muted }]}>
              {uniqueUsers} {uniqueUsers === 1 ? 'member' : 'members'} · {messageCount} posts
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={cb.actions}>
          <Pressable onPress={onMembers} hitSlop={10} style={cb.actionBtn}>
            <SymbolView name="person.2" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 20, height: 16 }} />
          </Pressable>
          <Pressable onPress={onSearch} hitSlop={10} style={cb.actionBtn}>
            <SymbolView name="magnifyingglass" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16 }} />
          </Pressable>
        </View>
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[cb.filterRow, { backgroundColor: Brand.paper, borderBottomColor: Brand.border }]} contentContainerStyle={cb.filterContent}>
        {THREAD_FILTERS.map((f) => {
          const active = filter === f;
          return (
            <Pressable key={f} onPress={() => onFilter(f)} style={[cb.filterChip, active && { backgroundColor: Brand.trust, borderColor: Brand.trust }, !active && { backgroundColor: Brand.card, borderColor: Brand.border }]}>
              <Text style={[cb.filterChipText, { color: active ? '#fff' : Brand.muted }]}>{f}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const cb = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  thumb: {
    width: 42, height: 56, borderRadius: 8,
    overflow: 'hidden', borderWidth: 1, flexShrink: 0,
  },
  info: { flex: 1, minWidth: 0, gap: 5 },
  titleText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14, lineHeight: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  typeBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeBadgeText: { fontFamily: BrandFonts.interMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 },
  statText: { fontFamily: BrandFonts.interRegular, fontSize: 11 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  actionBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  filterRow: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  filterContent: { gap: 8, paddingHorizontal: 16 },
  filterChip: { height: 32, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  filterChipText: { fontFamily: BrandFonts.interMedium, fontSize: 13 },
  topBar: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});

function PostAvatar({ handle, size = 34, bg, color }: { handle: string; size?: number; bg: string; color: string }) {
  const letter = handle.replace(/^@/, '')[0]?.toUpperCase() ?? '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: size * 0.4, color }}>{letter}</Text>
    </View>
  );
}

function ReplyRow({ reply, isMine, Brand }: { reply: RawMessage; isMine: boolean; Brand: BrandPalette }) {
  const isImg = reply.content.startsWith('__img:');
  const isGif = reply.content.startsWith('__gif:');
  const mediaUrl = isImg ? reply.content.slice(6) : isGif ? reply.content.slice(6, -2) : null;
  const displayContent = isImg || isGif ? null : reply.content;
  const handle = reply.user_handle ?? reply.user_name;

  return (
    <View style={[cp.replyRow, { borderLeftColor: Brand.trust + '55', borderBottomColor: Brand.border }]}>
      <PostAvatar handle={handle} size={26} bg={Brand.tlight} color={Brand.trust} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={cp.meta}>
          <Text style={[cp.username, { color: isMine ? Brand.trust : Brand.ink, fontSize: 12 }]}>
            {isMine ? 'You' : handle}
          </Text>
          <Text style={[cp.time, { color: Brand.muted }]}>{timeAgo(reply.created_at)}</Text>
        </View>
        {displayContent ? (
          <Text style={[cp.content, { color: Brand.ink, fontSize: 13 }]}>{displayContent}</Text>
        ) : mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={[cp.mediaImg, { marginTop: 4 }]} resizeMode="cover" />
        ) : null}
      </View>
    </View>
  );
}

function ContentPost({
  post, replies, isMine, onSendReply,
}: {
  post: RawMessage;
  replies: RawMessage[];
  isMine: boolean;
  onSendReply: (parentId: string, content: string) => void;
}) {
  const Brand = useBrand();
  const { user } = useSession();
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyInputRef = useRef<TextInput>(null);

  const isImg = post.content.startsWith('__img:');
  const isGif = post.content.startsWith('__gif:');
  const mediaUrl = isImg ? post.content.slice(6) : isGif ? post.content.slice(6, -2) : null;
  const displayContent = isImg || isGif ? null : post.content;
  const handle = post.user_handle ?? post.user_name;

  function openReplies() {
    setRepliesOpen(true);
    setTimeout(() => replyInputRef.current?.focus(), 80);
  }

  function submitReply() {
    const text = replyText.trim();
    if (!text) return;
    onSendReply(post.id, text);
    setReplyText('');
  }

  return (
    <View style={[cp.post, { borderBottomColor: Brand.border, backgroundColor: Brand.card }]}>
      <View style={cp.postInner}>
        <View style={cp.meta}>
          <PostAvatar handle={handle} size={32} bg={Brand.tlight} color={Brand.trust} />
          <Text style={[cp.username, { color: isMine ? Brand.trust : Brand.ink }]}>
            {isMine ? 'You' : handle}
          </Text>
          <Text style={[cp.time, { color: Brand.muted }]}>{timeAgo(post.created_at)}</Text>
        </View>
        {displayContent ? (
          <Text style={[cp.content, { color: Brand.ink }]}>{displayContent}</Text>
        ) : mediaUrl ? (
          <Image source={{ uri: mediaUrl }} style={cp.mediaImg} resizeMode="cover" />
        ) : null}
        <View style={[cp.actions, { borderTopColor: Brand.border }]}>
          <Pressable
            style={cp.actionBtn}
            onPress={repliesOpen ? () => setRepliesOpen(false) : openReplies}>
            <SymbolView name="bubble.left" size={14} tintColor={repliesOpen ? Brand.trust : Brand.muted} type="monochrome" style={{ width: 14, height: 14 }} />
            <Text style={[cp.actionText, { color: repliesOpen ? Brand.trust : Brand.muted }]}>
              {replies.length > 0 ? `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}` : 'Reply'}
            </Text>
          </Pressable>
        </View>
      </View>

      {repliesOpen && (
        <View style={[cp.repliesSection, { borderTopColor: Brand.border }]}>
          {replies.map((r) => (
            <ReplyRow key={r.id} reply={r} isMine={r.user_id === user?.id} Brand={Brand} />
          ))}
          <View style={[cp.replyInputRow, { borderTopColor: Brand.border }]}>
            <PostAvatar handle="You" size={26} bg={Brand.tlight} color={Brand.trust} />
            <TextInput
              ref={replyInputRef}
              style={[cp.replyInput, { color: Brand.ink, borderColor: Brand.border, backgroundColor: Brand.paper }]}
              placeholder="Write a reply…"
              placeholderTextColor={Brand.muted}
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={submitReply}
              returnKeyType="send"
              multiline={false}
            />
            {replyText.trim().length > 0 && (
              <Pressable onPress={submitReply} style={[cp.replySubmit, { backgroundColor: Brand.trust }]}>
                <SymbolView name="arrow.up" size={12} tintColor="#fff" type="monochrome" style={{ width: 12, height: 12 }} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const cp = StyleSheet.create({
  post: {
    borderWidth: 1,
    borderRadius: 16,
    marginHorizontal: 14,
    marginBottom: 10,
    overflow: 'hidden',
  },
  postInner: {
    padding: 14, gap: 10,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  username: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
  time: { fontFamily: BrandFonts.interRegular, fontSize: 11 },
  content: { fontFamily: BrandFonts.interRegular, fontSize: 14.5, lineHeight: 21 },
  mediaImg: { width: '100%', aspectRatio: 16 / 9, borderRadius: 10 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionText: { fontFamily: BrandFonts.interMedium, fontSize: 12.5 },
  repliesSection: { borderTopWidth: StyleSheet.hairlineWidth },
  replyRow: {
    flexDirection: 'row', gap: 9,
    paddingVertical: 10, paddingRight: 14,
    paddingLeft: 14,
    borderLeftWidth: 2.5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  replyInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 10, paddingLeft: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyInput: {
    flex: 1, borderWidth: 1, borderRadius: 18,
    paddingHorizontal: 12, paddingVertical: 7,
    fontFamily: BrandFonts.interRegular, fontSize: 13,
  },
  replySubmit: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
});

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
    headerInfo: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 1 },
    headerIconBox: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerGroupPhoto: { width: 34, height: 34, borderRadius: 17 },
    memberAvatarStack: { flexDirection: 'row', alignItems: 'center' },
    memberAvatarWrap: { borderWidth: 1.5, borderColor: Brand.card, borderRadius: 12 },
    headerIcon: { fontSize: 18 },
    messages: { flex: 1 },
    messagesContent: { padding: Spacing.three },
    pinnedInvite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.tlight,
    },
    pinnedInvitePoster: { width: 36, height: 48, borderRadius: 6, backgroundColor: Brand.border },
    pinnedInviteBody: { flex: 1, minWidth: 0 },
    pinnedInviteLabel: { fontFamily: BrandFonts.interMedium, fontSize: 10, color: Brand.trust, letterSpacing: 0.3, marginBottom: 1 },
    pinnedInviteTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    pinnedInviteMeta: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 1 },
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

    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    headerHandle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
    },
    searchToggleBtn: {
      width: 30,
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Members sheet
    membersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    membersTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 16,
      color: Brand.ink,
    },
    membersList: {
      paddingVertical: 8,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 11,
    },
    memberName: {
      flex: 1,
      fontFamily: BrandFonts.interMedium,
      fontSize: 14.5,
      color: Brand.ink,
    },
    memberYouBadge: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
      backgroundColor: Brand.border,
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    membersFooter: {
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      paddingHorizontal: 16,
      paddingTop: 14,
    },
    leaveBtn: {
      backgroundColor: '#FF3B3020',
      borderWidth: 1.5,
      borderColor: '#FF3B30',
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
    },
    leaveBtnText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: '#FF3B30',
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
