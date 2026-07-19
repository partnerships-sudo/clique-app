import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { type ActivityItem, useInbox, useMarkAllRead } from '@/features/notifications/inbox';
import { useBrand } from '@/hooks/use-brand';

type KindSymbol = { name: string; color: string };
const KIND_SYMBOL: Record<string, KindSymbol> = {
  new_follower:    { name: 'person.fill',    color: '#5B8DEF' },
  follow_request:  { name: 'bell.fill',      color: '#F4A340' },
  follow_accepted: { name: 'checkmark',      color: '#34D399' },
  reaction:        { name: 'heart.fill',     color: '#E84F4F' },
  story_like:      { name: 'heart.fill',     color: '#E84F4F' },
  message:         { name: 'message.fill',   color: '#8C82FF' },
  rate_reminder:   { name: 'star.fill',      color: '#F4A340' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function NotifRow({ item, styles, Brand }: { item: ActivityItem; styles: ReturnType<typeof createStyles>; Brand: BrandPalette }) {
  const sym = KIND_SYMBOL[item.kind] ?? { name: 'bell.fill', color: Brand.trust };

  function handlePress() {
    if (item.kind === 'rate_reminder' && item.postTitle) {
      router.back();
      router.push({
        pathname: '/log-modal',
        params: {
          title: item.postTitle,
          type: item.postType ?? 'watch',
          poster: item.postPoster ?? undefined,
        },
      });
    } else if (item.kind === 'message') {
      router.back();
      router.push({ pathname: '/chat-modal', params: { friendId: item.fromUserId } });
    } else if ((item.kind === 'reaction' || item.kind === 'story_like') && item.postTitle) {
      router.back();
      router.push({
        pathname: '/content-detail-modal',
        params: {
          title: item.postTitle,
          type: item.postType ?? 'watch',
          poster: item.postPoster ?? undefined,
        },
      });
    } else if (item.kind === 'reaction' || item.kind === 'story_like') {
      // reaction with no post info — open the sender's profile
      router.back();
      router.push({ pathname: '/friend-profile-modal', params: { userId: item.fromUserId } });
    } else if (
      item.kind === 'new_follower' ||
      item.kind === 'follow_request' ||
      item.kind === 'follow_accepted'
    ) {
      router.back();
      router.push({ pathname: '/friend-profile-modal', params: { userId: item.fromUserId } });
    }
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.row, !item.read && styles.rowUnread, pressed && styles.rowPressed]}
      onPress={handlePress}>
      <View style={styles.avatarWrap}>
        <Avatar name={item.fromUserName} avatarUrl={item.fromAvatarUrl} size={40} />
        <View style={[styles.iconBadge, { backgroundColor: sym.color }]}>
          <SymbolView name={sym.name} size={11} tintColor="#fff" type="monochrome" />
        </View>
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
        <Text style={styles.time}>{timeAgo(item.createdAt)}</Text>
      </View>
      {item.postPoster ? (
        <Image source={{ uri: item.postPoster }} style={styles.postThumb} resizeMode="cover" />
      ) : item.postTitle && !item.postPoster ? (
        <View style={[styles.postThumb, styles.postThumbFallback]}>
          <Text style={styles.postThumbEmoji}>🎬</Text>
        </View>
      ) : !item.read ? (
        <View style={styles.unreadDot} />
      ) : null}
      {item.postPoster || item.postTitle ? (
        !item.read ? <View style={styles.unreadDotSmall} /> : null
      ) : null}
    </Pressable>
  );
}

export default function NotificationsModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: items, isLoading } = useInbox();
  const markAllRead = useMarkAllRead();

  const unreadCount = (items ?? []).filter((i) => !i.read).length;

  useEffect(() => {
    if (unreadCount > 0) markAllRead.mutate();
  // Only fire once when the screen first has unread items loaded
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount > 0]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.closeBtn}>Done</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Brand.trust} />
        </View>
      ) : !items?.length ? (
        <View style={styles.centered}>
          <SymbolView name="bell" size={40} tintColor={Brand.muted} type="monochrome" />
          <Text style={styles.emptyTitle}>No activity yet</Text>
          <Text style={styles.emptySub}>When people follow you or react to your posts, you'll see it here.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NotifRow item={item} styles={styles} Brand={Brand} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.ink,
      letterSpacing: -0.3,
    },
    closeBtn: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.trust,
    },
    list: { paddingVertical: 6 },
    separator: { height: 1, backgroundColor: Brand.border, marginLeft: 68 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      gap: 12,
    },
    rowUnread: { backgroundColor: Brand.tlight },
    rowPressed: { opacity: 0.7 },
    avatarWrap: { position: 'relative' },
    iconBadge: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: Brand.paper,
    },
    rowBody: { flex: 1, minWidth: 0 },
    message: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      lineHeight: 20,
    },
    postTitle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      marginTop: 2,
    },
    time: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginTop: 3,
    },
    postThumb: {
      width: 44,
      height: 62,
      borderRadius: 8,
      backgroundColor: Brand.border,
      overflow: 'hidden',
    },
    postThumbFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    postThumbEmoji: { fontSize: 20 },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Brand.trust,
    },
    unreadDotSmall: {
      position: 'absolute',
      top: 14,
      right: Spacing.three,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: Brand.trust,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.four,
    },
    emptyIcon: { fontSize: 40, marginBottom: 12 },
    emptyTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 18,
      color: Brand.ink,
      marginBottom: 6,
    },
    emptySub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
