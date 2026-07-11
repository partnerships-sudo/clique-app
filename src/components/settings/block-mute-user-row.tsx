import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { BlockableUser } from '@/features/blocks/api';
import { useBrand } from '@/hooks/use-brand';

export function BlockMuteUserRow({ profile, onPress }: { profile: BlockableUser; onPress: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';

  return (
    <Pressable style={styles.row} onPress={onPress}>
      <Avatar name={name} size={46} avatarUrl={profile.avatar_url} />
      <View style={styles.info}>
        <View style={styles.nameLine}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {profile.isFriend ? (
            <View style={styles.friendPill}>
              <Text style={styles.friendPillText}>Friend</Text>
            </View>
          ) : null}
        </View>
        {profile.username ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.username}
          </Text>
        ) : null}
        {profile.isBlocked || profile.isMuted ? (
          <View style={styles.statusRow}>
            {profile.isBlocked ? (
              <View style={[styles.statusPill, styles.blockedPill]}>
                <Text style={[styles.statusPillText, styles.blockedPillText]}>🚫 Blocked</Text>
              </View>
            ) : null}
            {profile.isMuted ? (
              <View style={[styles.statusPill, styles.mutedPill]}>
                <Text style={[styles.statusPillText, styles.mutedPillText]}>🔇 Muted</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Brand.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 10,
    },
    info: { flex: 1, minWidth: 0 },
    nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, flexShrink: 1 },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    friendPill: {
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 2,
      paddingHorizontal: 7,
    },
    friendPillText: { fontFamily: BrandFonts.syneBold, fontSize: 9.5, color: Brand.trust },
    statusRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
    statusPill: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 7 },
    statusPillText: { fontFamily: BrandFonts.syneBold, fontSize: 9.5 },
    blockedPill: { backgroundColor: '#FBDEDE' },
    blockedPillText: { color: '#C23434' },
    mutedPill: { backgroundColor: Brand.border },
    mutedPillText: { color: Brand.muted },
    chevron: { fontSize: 22, color: Brand.muted },
  });
}
