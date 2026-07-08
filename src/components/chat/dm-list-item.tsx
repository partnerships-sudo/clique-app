import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { DmThread } from '@/features/dms/api';
import { parseRec, recPreviewText } from '@/features/dms/rec';
import { timeAgo } from '@/features/feed/time-ago';
import { useBrand } from '@/hooks/use-brand';

export function DmListItem({ thread, onPress }: { thread: DmThread; onPress: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Avatar name={thread.name} size={48} avatarUrl={thread.avatarUrl} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.name}
          </Text>
          <Text style={styles.time}>{timeAgo(thread.lastTime)}</Text>
        </View>
        <Text style={styles.preview} numberOfLines={1}>
          {thread.lastIsMine ? <Text style={styles.previewUser}>You: </Text> : null}
          {(() => {
            const rec = parseRec(thread.lastText);
            return rec ? recPreviewText(rec) : thread.lastText;
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
      marginBottom: 10,
    },
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
