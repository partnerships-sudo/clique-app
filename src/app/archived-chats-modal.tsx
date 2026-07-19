import { router } from 'expo-router';
import { useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChatListItem } from '@/components/chat/chat-list-item';
import { DmListItem } from '@/components/chat/dm-list-item';
import { GroupListItem } from '@/components/chat/group-list-item';
import { SwipeableChatRow } from '@/components/chat/swipeable-chat-row';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useChatThreads } from '@/features/chats/api';
import { useArchivedChats } from '@/features/chats/archive';
import { useDmThreads } from '@/features/dms/api';
import { useGroupThreads } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';

export default function ArchivedChatsModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const { threads: contentThreads, markRead: markContentRead } = useChatThreads();
  const { threads: dmThreads, markRead: markDmRead } = useDmThreads();
  const { threads: groupThreads, markRead: markGroupRead } = useGroupThreads();
  const { archived, unarchive, softDelete } = useArchivedChats();

  const archivedContent = contentThreads.filter((t) => archived.has(`content:${t.title}`));
  const archivedDms = dmThreads.filter((t) => archived.has(`dm:${t.friendId}`));
  const archivedGroups = groupThreads.filter((t) => archived.has(`group:${t.id}`));

  const isEmpty = archivedContent.length === 0 && archivedDms.length === 0 && archivedGroups.length === 0;

  type Row =
    | { kind: 'header'; label: string }
    | { kind: 'content'; id: string }
    | { kind: 'dm'; id: string }
    | { kind: 'group'; id: string };

  const rows: Row[] = [
    ...(archivedContent.length > 0 ? [{ kind: 'header' as const, label: 'Content' }] : []),
    ...archivedContent.map((t) => ({ kind: 'content' as const, id: t.title })),
    ...(archivedDms.length > 0 ? [{ kind: 'header' as const, label: 'Direct Messages' }] : []),
    ...archivedDms.map((t) => ({ kind: 'dm' as const, id: t.friendId })),
    ...(archivedGroups.length > 0 ? [{ kind: 'header' as const, label: 'Groups' }] : []),
    ...archivedGroups.map((t) => ({ kind: 'group' as const, id: t.id })),
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Archived</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      {isEmpty ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Nothing archived</Text>
          <Text style={styles.emptySub}>Swipe left on any chat and tap Archive to move it here.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.kind === 'header' ? `hdr-${r.label}` : `${r.kind}-${r.id}`}
          contentContainerStyle={styles.list}
          renderItem={({ item: row }) => {
            if (row.kind === 'header') {
              return <Text style={styles.sectionLabel}>{row.label}</Text>;
            }

            if (row.kind === 'content') {
              const thread = archivedContent.find((t) => t.title === row.id)!;
              return (
                <SwipeableChatRow
                  onArchive={() => unarchive(`content:${thread.title}`)}
                  onDelete={() => softDelete(`content:${thread.title}`)}>
                  <ChatListItem
                    thread={thread}
                    onPress={() => {
                      markContentRead(thread.title);
                      router.push({ pathname: '/chat-modal', params: { title: thread.title, type: thread.type, poster: thread.poster ?? undefined } });
                    }}
                  />
                </SwipeableChatRow>
              );
            }

            if (row.kind === 'dm') {
              const thread = archivedDms.find((t) => t.friendId === row.id)!;
              return (
                <SwipeableChatRow
                  onArchive={() => unarchive(`dm:${thread.friendId}`)}
                  onDelete={() => softDelete(`dm:${thread.friendId}`)}>
                  <DmListItem
                    thread={thread}
                    onPress={() => {
                      markDmRead(thread.friendId);
                      router.push({ pathname: '/chat-modal', params: { friendId: thread.friendId, friendName: thread.name, friendAvatar: thread.avatarUrl ?? undefined } });
                    }}
                  />
                </SwipeableChatRow>
              );
            }

            const thread = archivedGroups.find((t) => t.id === row.id)!;
            return (
              <SwipeableChatRow
                onArchive={() => unarchive(`group:${thread.id}`)}
                onDelete={() => softDelete(`group:${thread.id}`)}>
                <GroupListItem
                  thread={thread}
                  onPress={() => {
                    markGroupRead(thread.id);
                    router.push({ pathname: '/chat-modal', params: { groupId: thread.id, groupName: thread.name ?? 'Group Chat' } });
                  }}
                />
              </SwipeableChatRow>
            );
          }}
        />
      )}
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
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, letterSpacing: -0.3 },
    done: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    list: { paddingBottom: 40 },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      paddingHorizontal: Spacing.three,
      paddingTop: 20,
      paddingBottom: 8,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 18, color: Brand.ink, marginBottom: 8 },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
  });
}
