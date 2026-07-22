import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SymbolView } from 'expo-symbols';

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

type ChatsMode = 'content' | 'private' | 'requests';

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
  const isRequests = mode === 'requests';

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
        <View style={styles.headerActions}>
          <Pressable onPress={() => router.push('/archived-chats-modal')} hitSlop={8} style={styles.archivedBtn}>
            <Text style={styles.archivedBtnText}>Archived</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/new-chat-modal')} hitSlop={8}>
            <SymbolView name="square.and.pencil" size={22} tintColor={Brand.ink} style={{ width: 24, height: 24 }} />
          </Pressable>
        </View>
      </View>
      <View style={styles.modeRow}>
        <Pressable style={styles.modeTab} onPress={() => setMode('content')}>
          <Text style={[styles.modeTabText, mode === 'content' && styles.modeTabTextActive]}>
            Content
          </Text>
          {contentUnread > 0 && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{contentUnread > 99 ? '99+' : String(contentUnread)}</Text>
            </View>
          )}
          {mode === 'content' && <View style={styles.modeTabUnderline} />}
        </Pressable>
        <Pressable style={styles.modeTab} onPress={() => setMode('private')}>
          <Text style={[styles.modeTabText, mode === 'private' && styles.modeTabTextActive]}>
            Private
          </Text>
          {privateUnread > 0 && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{privateUnread > 99 ? '99+' : String(privateUnread)}</Text>
            </View>
          )}
          {mode === 'private' && <View style={styles.modeTabUnderline} />}
        </Pressable>
        <View style={styles.modeTabSpacer} />
        <Pressable style={[styles.modeTab, { marginRight: 0 }]} onPress={() => setMode('requests')}>
          <Text style={[styles.modeTabText, mode === 'requests' && styles.modeTabTextActive]}>
            Requests
          </Text>
          {filteredRequestThreads.length > 0 && (
            <View style={styles.modeBadge}>
              <Text style={styles.modeBadgeText}>{filteredRequestThreads.length}</Text>
            </View>
          )}
          {mode === 'requests' && <View style={styles.modeTabUnderline} />}
        </Pressable>
      </View>
      <View style={styles.searchRow}>
        <SymbolView name="magnifyingglass" size={15} tintColor="#999" style={{ width: 16, height: 16, marginRight: 8 }} />
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
      {mode === 'content' && <FilterChips value={filter} onChange={setFilter} compact />}
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
          ListHeaderComponent={headerContent}
          renderItem={({ item }) =>
            item.kind === 'dm' ? (
              <DmListItem thread={item.data} onPress={() => openDm(item.data)} />
            ) : (
              <GroupListItem thread={item.data} onPress={() => openGroup(item.data)} />
            )
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              {trimmedQuery
                ? <SymbolView name="magnifyingglass" size={40} tintColor="#999" style={{ width: 44, height: 44, marginBottom: 12 }} />
                : <Text style={styles.emptyEmoji}>🔒</Text>}
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
      ) : isRequests ? (
        <FlatList
          contentContainerStyle={styles.content}
          data={filteredRequestThreads}
          keyExtractor={(item) => item.friendId}
          ListHeaderComponent={headerContent}
          renderItem={({ item }) => (
            <DmListItem thread={item} onPress={() => openDm(item)} />
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>📬</Text>
              <Text style={styles.emptyTitle}>No message requests</Text>
              <Text style={styles.emptyBody}>When someone you don't follow messages you, it'll show up here.</Text>
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
                {trimmedQuery
                  ? <SymbolView name="magnifyingglass" size={40} tintColor="#999" style={{ width: 44, height: 44, marginBottom: 12 }} />
                  : <Text style={styles.emptyEmoji}>💬</Text>}
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
    modeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Brand.border,
      marginBottom: Spacing.three,
    },
    modeTab: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 4,
      marginRight: 20,
      gap: 5,
      position: 'relative',
    },
    modeTabText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.muted,
    },
    modeTabTextActive: { color: Brand.ink },
    modeTabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      borderRadius: 2,
      backgroundColor: Brand.trust,
    },
    modeTabSpacer: { flex: 1 },
    modeBadge: {
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    modeBadgeText: { color: '#fff', fontSize: 10, fontFamily: BrandFonts.syneBold, lineHeight: 18 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
    archivedBtn: {
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    archivedBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
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
