import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { DmListItem } from '@/components/chat/dm-list-item';
import { GroupListItem } from '@/components/chat/group-list-item';
import { FilterChips } from '@/components/feed/filter-chips';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useChatThreads, type ChatThread } from '@/features/chats/api';
import { useDmThreads, type DmThread } from '@/features/dms/api';
import { type FeedFilterValue } from '@/features/feed/api';
import { useGroupThreads, type GroupThread } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';

type ChatsMode = 'content' | 'private';

type PrivateItem =
  | { kind: 'dm'; data: DmThread }
  | { kind: 'group'; data: GroupThread };

export default function ChatsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [mode, setMode] = useState<ChatsMode>('content');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [query, setQuery] = useState('');
  const { threads, isLoading, isFetching, refetch, markRead } = useChatThreads();
  const { threads: dmThreads, requestThreads, markRead: markDmRead } = useDmThreads();
  const { threads: groupThreads, markRead: markGroupRead } = useGroupThreads();
  const trimmedQuery = query.trim().toLowerCase();
  const filteredThreads = threads
    .filter((t) => filter === 'all' || t.type === filter)
    .filter(
      (t) =>
        !trimmedQuery ||
        t.title.toLowerCase().includes(trimmedQuery) ||
        t.lastUser.toLowerCase().includes(trimmedQuery) ||
        t.lastText.toLowerCase().includes(trimmedQuery),
    );
  const isPrivate = mode === 'private';

  const contentUnread = threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const privateUnread =
    dmThreads.reduce((sum, t) => sum + t.unreadCount, 0) +
    groupThreads.reduce((sum, t) => sum + t.unreadCount, 0);

  // Merge DMs + groups sorted by most recent activity
  const privateItems: PrivateItem[] = [
    ...(dmThreads ?? []).map((d): PrivateItem => ({ kind: 'dm', data: d })),
    ...(groupThreads ?? []).map((g): PrivateItem => ({ kind: 'group', data: g })),
  ]
    .filter((item) => {
      if (!trimmedQuery) return true;
      if (item.kind === 'dm') {
        return (
          item.data.name.toLowerCase().includes(trimmedQuery) ||
          item.data.lastText.toLowerCase().includes(trimmedQuery)
        );
      }
      return (
        (item.data.name ?? '').toLowerCase().includes(trimmedQuery) ||
        (item.data.lastText ?? '').toLowerCase().includes(trimmedQuery)
      );
    })
    .sort((a, b) => {
      const ta = a.kind === 'dm' ? a.data.lastTime : a.data.lastTime;
      const tb = b.kind === 'dm' ? b.data.lastTime : b.data.lastTime;
      return tb.localeCompare(ta);
    });
  const filteredRequestThreads = requestThreads.filter(
    (t) =>
      !trimmedQuery ||
      t.name.toLowerCase().includes(trimmedQuery) ||
      t.lastText.toLowerCase().includes(trimmedQuery),
  );

  function openThread(thread: ChatThread) {
    markRead(thread.title);
    router.push({
      pathname: '/chat-modal',
      params: { title: thread.title, type: thread.type, poster: thread.poster ?? undefined },
    });
  }

  function openDm(thread: DmThread) {
    markDmRead(thread.friendId);
    router.push({
      pathname: '/chat-modal',
      params: { friendId: thread.friendId, friendName: thread.name, friendAvatar: thread.avatarUrl ?? undefined },
    });
  }

  function openGroup(thread: GroupThread) {
    markGroupRead(thread.id);
    router.push({
      pathname: '/chat-modal',
      params: { groupId: thread.id, groupName: thread.name ?? 'Group Chat' },
    });
  }

  const headerContent = (
    <View>
      <View style={styles.titleRow}>
        <View>
          <Text style={styles.screenTitle}>Chats</Text>
          <Text style={styles.screenSub}>Your conversations</Text>
        </View>
        <Pressable style={styles.composeBtn} onPress={() => router.push('/new-chat-modal')} hitSlop={8}>
          <Text style={styles.composeBtnText}>＋</Text>
        </Pressable>
      </View>
      <View style={styles.modeRow}>
        <Pressable
          style={[styles.modeBtn, !isPrivate && styles.modeBtnActive]}
          onPress={() => setMode('content')}>
          <Text style={[styles.modeBtnText, !isPrivate && styles.modeBtnTextActive]}>💬 Content Chats</Text>
          {contentUnread > 0 && (
            <View style={[styles.modeBadge, !isPrivate && styles.modeBadgeActive]}>
              <Text style={[styles.modeBadgeText, !isPrivate && styles.modeBadgeTextActive]}>
                {contentUnread > 99 ? '99+' : String(contentUnread)}
              </Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.modeBtn, isPrivate && styles.modeBtnActive]}
          onPress={() => setMode('private')}>
          <Text style={[styles.modeBtnText, isPrivate && styles.modeBtnTextActive]}>🔒 Private Chats</Text>
          {privateUnread > 0 && (
            <View style={[styles.modeBadge, isPrivate && styles.modeBadgeActive]}>
              <Text style={[styles.modeBadgeText, isPrivate && styles.modeBadgeTextActive]}>
                {privateUnread > 99 ? '99+' : String(privateUnread)}
              </Text>
            </View>
          )}
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={isPrivate ? 'Search private chats…' : 'Search content chats…'}
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8}>
            <Text style={styles.searchClear}>✕</Text>
          </Pressable>
        ) : null}
      </View>
      {!isPrivate && <FilterChips value={filter} onChange={setFilter} />}
    </View>
  );

  const privateHeaderContent = (
    <View>
      {headerContent}
      {filteredRequestThreads.length > 0 ? (
        <View style={styles.requestsSection}>
          <Text style={styles.requestsSectionTitle}>Message Requests ({filteredRequestThreads.length})</Text>
          {filteredRequestThreads.map((t) => (
            <DmListItem key={t.friendId} thread={t} onPress={() => openDm(t)} />
          ))}
          <View style={styles.requestsDivider} />
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {isPrivate ? (
        <FlatList
          contentContainerStyle={styles.content}
          data={privateItems}
          keyExtractor={(item) =>
            item.kind === 'dm' ? `dm-${item.data.friendId}` : `group-${item.data.id}`
          }
          ListHeaderComponent={privateHeaderContent}
          renderItem={({ item }) =>
            item.kind === 'dm' ? (
              <DmListItem thread={item.data} onPress={() => openDm(item.data)} />
            ) : (
              <GroupListItem thread={item.data} onPress={() => openGroup(item.data)} />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{trimmedQuery ? '🔍' : '🔒'}</Text>
              <Text style={styles.emptyTitle}>
                {trimmedQuery ? `No matches for "${query.trim()}"` : 'No private chats yet'}
              </Text>
              <Text style={styles.emptyBody}>
                {trimmedQuery
                  ? 'Try a different name or search term.'
                  : 'Tap ＋ above to start a direct message or create a group chat.'}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={filteredThreads}
          keyExtractor={(item) => item.title}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Brand.trust} />
          }
          ListHeaderComponent={headerContent}
          renderItem={({ item }) => <ChatListItem thread={item} onPress={() => openThread(item)} />}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>{trimmedQuery ? '🔍' : '💬'}</Text>
                <Text style={styles.emptyTitle}>
                  {trimmedQuery
                    ? `No matches for "${query.trim()}"`
                    : threads.length && filter !== 'all'
                      ? 'No chats in this category'
                      : 'No channels yet'}
                </Text>
                <Text style={styles.emptyBody}>
                  {trimmedQuery
                    ? 'Try a different name or search term.'
                    : threads.length && filter !== 'all'
                      ? 'Try a different filter, or tap "All" to see every channel.'
                      : 'Channels appear here when you or a friend logs something and starts chatting.'}
                </Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: Spacing.three,
    },
    screenTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, marginBottom: 2 },
    screenSub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    composeBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    composeBtnText: { color: '#fff', fontSize: 20, fontFamily: BrandFonts.syneBold, lineHeight: 24 },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderRadius: 26,
      paddingLeft: 16,
      paddingRight: 16,
      marginBottom: Spacing.three,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    searchIcon: { fontSize: 15, marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
    },
    searchClear: { fontSize: 13, color: Brand.muted, padding: 4 },
    modeRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.three },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingVertical: 11,
      gap: 6,
    },
    modeBtnActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    modeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    modeBtnTextActive: { color: '#fff' },
    modeBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
    },
    modeBadgeActive: { backgroundColor: '#fff' },
    modeBadgeText: { color: '#fff', fontSize: 10, fontFamily: BrandFonts.syneBold, lineHeight: 20 },
    modeBadgeTextActive: { color: Brand.trust },
    requestsSection: { marginBottom: 6 },
    requestsSectionTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12.5,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    requestsDivider: { height: 1, backgroundColor: Brand.border, marginTop: 6, marginBottom: 12 },
    empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, marginBottom: 8 },
    emptyBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 19,
    },
  });
}
