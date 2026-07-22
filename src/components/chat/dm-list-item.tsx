import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { DmThread } from '@/features/dms/api';
import { parseRec, recPreviewText } from '@/features/dms/rec';
import { timeAgo } from '@/features/feed/time-ago';
import { formatLastSeen, isOnline } from '@/features/presence/api';
import { useBrand } from '@/hooks/use-brand';

const ONLINE_COLOR = '#3DDC84';

export function DmListItem({ thread, onPress }: { thread: DmThread; onPress: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const online = isOnline(thread.lastSeenAt);
  const lastSeenLabel = formatLastSeen(thread.lastSeenAt);

  return (
    <Pressable style={[styles.card, thread.isRequest && styles.cardRequest]} onPress={onPress}>
      <View style={styles.avatarWrap}>
        <Avatar name={thread.name} size={48} avatarUrl={thread.avatarUrl} />
        {online && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {thread.name}
          </Text>
          <Text style={styles.time}>{timeAgo(thread.lastTime)}</Text>
        </View>
        {thread.isRequest ? (
          <Text style={styles.previewRequest} numberOfLines={1}>
            🔒 Wants to send you a message
          </Text>
        ) : (
          <Text style={styles.preview} numberOfLines={1}>
            {thread.lastIsMine ? <Text style={styles.previewUser}>You: </Text> : null}
            {(() => {
              const rec = parseRec(thread.lastText);
              return rec ? recPreviewText(rec) : thread.lastText;
            })()}
          </Text>
        )}
        {!thread.isRequest && !online && lastSeenLabel ? (
          <Text style={styles.lastSeen} numberOfLines={1}>{lastSeenLabel}</Text>
        ) : null}
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
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: Brand.border,
    },
    cardRequest: { opacity: 0.75 },
    avatarWrap: { position: 'relative' },
    onlineDot: {
      position: 'absolute',
      bottom: 1,
      right: 1,
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: ONLINE_COLOR,
      borderWidth: 2,
      borderColor: Brand.paper,
    },
    body: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    title: { flex: 1, fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    time: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginLeft: 8 },
    preview: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    previewUser: { color: Brand.ink, fontFamily: BrandFonts.interMedium },
    previewRequest: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.trust },
    lastSeen: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 3 },
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
