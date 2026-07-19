import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useAcceptDmRequest, useDeclineDmRequest, useDmThreads } from '@/features/dms/api';
import { useSetBlockMute } from '@/features/blocks/api';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand } from '@/hooks/use-brand';

export default function DmRequestsModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { requestThreads, markRead } = useDmThreads();
  const acceptRequest = useAcceptDmRequest();
  const declineRequest = useDeclineDmRequest();
  const setBlockMute = useSetBlockMute();

  function openRequest(friendId: string, friendName: string, friendAvatar: string | null) {
    markRead(friendId);
    router.push({
      pathname: '/chat-modal',
      params: { friendId, friendName, friendAvatar: friendAvatar ?? undefined },
    });
  }

  function handleBlock(friendId: string, friendName: string) {
    Alert.alert(
      `Block ${friendName}?`,
      "They won't be able to message you and you won't see each other's content.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            declineRequest.mutate(friendId);
            setBlockMute.mutate({ targetUserId: friendId, isBlocked: true, isMuted: true });
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Message Requests</Text>
        <View style={{ width: 50 }} />
      </View>

      <FlatList
        contentContainerStyle={styles.content}
        data={requestThreads}
        keyExtractor={(t) => t.friendId}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SymbolView name="envelope" size={44} tintColor={Brand.muted} type="outlined" style={styles.emptyIcon} />
            <Text style={styles.emptyTitle}>No requests</Text>
            <Text style={styles.emptyBody}>Message requests from people you don't follow will appear here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.cardMain}
              onPress={() => openRequest(item.friendId, item.name, item.avatarUrl)}>
              <Avatar name={item.name} size={52} avatarUrl={item.avatarUrl} />
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.preview}>Wants to send you a message</Text>
                <Text style={styles.time}>{timeAgo(item.lastTime)}</Text>
              </View>
            </Pressable>

            <View style={styles.actions}>
              <Pressable
                style={styles.acceptBtn}
                disabled={acceptRequest.isPending}
                onPress={() => acceptRequest.mutate(item.friendId)}>
                <Text style={styles.acceptText}>Accept</Text>
              </Pressable>
              <Pressable
                style={styles.declineBtn}
                disabled={declineRequest.isPending}
                onPress={() => {
                  declineRequest.mutate(item.friendId);
                }}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
              <Pressable
                style={styles.blockBtn}
                onPress={() => handleBlock(item.friendId, item.name)}>
                <Text style={styles.blockText}>Block</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 50 },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    content: { padding: Spacing.three, gap: 12 },
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    cardMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
    },
    cardBody: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink, marginBottom: 2 },
    preview: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginBottom: 2 },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted },
    actions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    acceptBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: Brand.trust,
    },
    acceptText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#fff' },
    declineBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderLeftWidth: 1,
      borderLeftColor: Brand.border,
    },
    declineText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.muted },
    blockBtn: {
      flex: 1,
      paddingVertical: 12,
      alignItems: 'center',
      borderLeftWidth: 1,
      borderLeftColor: Brand.border,
    },
    blockText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#E84F4F' },
    empty: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 24 },
    emptyIcon: { marginBottom: 14 },
    emptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink, marginBottom: 8 },
    emptyBody: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
  });
}
