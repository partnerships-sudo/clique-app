import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { ChatThread } from '@/features/chats/api';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

export function ChatListItem({ thread, onPress }: { thread: ChatThread; onPress: () => void }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const type = TypeColors[thread.type];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      {thread.poster ? (
        <Image source={{ uri: thread.poster }} style={styles.icon} />
      ) : (
        <View style={[styles.icon, { backgroundColor: type.bg }]}>
          <Text style={styles.iconText}>{type.icon}</Text>
        </View>
      )}
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.title}
          </Text>
          <Text style={styles.time}>{timeAgo(thread.lastTime)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          <Text style={styles.previewUser}>{thread.lastUser}: </Text>
          {(() => {
            try {
              const parsed = JSON.parse(thread.lastText);
              if (parsed.__chatGif) return 'GIF';
            } catch {}
            return thread.lastText;
          })()}
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
      marginBottom: 4,
    },
    icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    iconText: { fontSize: 20 },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    title: { flex: 1, fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginLeft: 8 },
    preview: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    previewUser: { color: Brand.ink, fontFamily: BrandFonts.interMedium },
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
