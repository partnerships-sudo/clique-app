import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { GroupThread } from '@/features/groups/api';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand } from '@/hooks/use-brand';

export function GroupListItem({ thread, onPress }: { thread: GroupThread; onPress: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>👥</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.name ?? 'Group Chat'}
          </Text>
          {thread.lastTime ? (
            <Text style={styles.time}>{timeAgo(thread.lastTime)}</Text>
          ) : null}
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {thread.lastText ?? `${thread.memberCount} members`}
        </Text>
      </View>
      {thread.unreadCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {thread.unreadCount > 99 ? '99+' : String(thread.unreadCount)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    icon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    iconText: { fontSize: 22 },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    title: { flex: 1, fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginLeft: 8 },
    preview: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    badge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 5,
      flexShrink: 0,
    },
    badgeText: { color: '#fff', fontSize: 11, fontFamily: BrandFonts.syneBold, lineHeight: 22 },
  });
}
