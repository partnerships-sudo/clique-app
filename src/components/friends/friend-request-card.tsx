import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import type { FriendRequest } from '@/features/friends/api';

export function FriendRequestCard({
  request,
  onAccept,
  onDecline,
}: {
  request: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = request.profile.full_name || request.profile.username || 'Someone';

  return (
    <View style={styles.card}>
      <Avatar name={name} size={46} avatarUrl={request.profile.avatar_url} />
      <View style={styles.info}>
        <Text style={styles.name}>{name}</Text>
        {request.profile.username ? <Text style={styles.handle}>@{request.profile.username}</Text> : null}
        <Text style={styles.wants}>Wants to be your friend</Text>
      </View>
      <View style={styles.actions}>
        <Pressable style={styles.acceptBtn} onPress={onAccept}>
          <Text style={styles.acceptText}>✓ Accept</Text>
        </Pressable>
        <Pressable style={styles.declineBtn} onPress={onDecline}>
          <Text style={styles.declineText}>✕ Decline</Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderLeftWidth: 3,
      borderLeftColor: Brand.trust,
      borderRadius: 16,
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 10,
    },
    info: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    wants: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.trust, marginTop: 3 },
    actions: { gap: 5 },
    acceptBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    acceptText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    declineBtn: {
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 11,
    },
    declineText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
  });
}
