import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
import { useBrand } from '@/hooks/use-brand';

export default function NewChatModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: friends } = useFriends();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>New Chat</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* New Group Chat */}
        <Pressable
          style={styles.actionRow}
          onPress={() => router.push('/new-group-modal')}>
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>👥</Text>
          </View>
          <View style={styles.actionBody}>
            <Text style={styles.actionLabel}>New Group Chat</Text>
            <Text style={styles.actionSub}>Create a named group with multiple friends</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.divider} />

        {/* Friends for DM */}
        <Text style={styles.sectionLabel}>Friends</Text>

        {(friends ?? []).length === 0 && (
          <Text style={styles.empty}>Add some friends to start a direct message.</Text>
        )}

        {(friends ?? []).map((friend) => (
          <Pressable
            key={friend.id}
            style={styles.friendRow}
            onPress={() => {
              router.back();
              router.push({
                pathname: '/chat-modal',
                params: {
                  friendId: friend.id,
                  friendName: friend.full_name ?? friend.username ?? 'Friend',
                  friendAvatar: friend.avatar_url ?? undefined,
                },
              });
            }}>
            <Avatar
              name={friend.full_name ?? friend.username ?? 'F'}
              size={46}
              avatarUrl={friend.avatar_url}
            />
            <View style={styles.friendBody}>
              <Text style={styles.friendName}>
                {friend.full_name ?? friend.username ?? 'Friend'}
              </Text>
              {friend.username ? (
                <Text style={styles.friendSub}>@{friend.username}</Text>
              ) : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
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
    cancel: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 50 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    content: { paddingBottom: Spacing.six },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 16,
      backgroundColor: Brand.card,
    },
    actionIcon: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIconText: { fontSize: 22 },
    actionBody: { flex: 1 },
    actionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink, marginBottom: 2 },
    actionSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    chevron: { fontSize: 20, color: Brand.muted },
    divider: { height: 8, backgroundColor: Brand.paper },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: Spacing.three,
      paddingTop: 18,
      paddingBottom: 10,
    },
    empty: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    friendBody: { flex: 1 },
    friendName: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    friendSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 1 },
  });
}
