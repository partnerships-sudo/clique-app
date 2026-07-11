import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { CloseFriendCandidate } from '@/features/close-friends/api';
import { useBrand } from '@/hooks/use-brand';

export function CloseFriendRow({
  profile,
  onToggle,
  disabled,
}: {
  profile: CloseFriendCandidate;
  onToggle: () => void;
  disabled: boolean;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';

  return (
    <View style={styles.row}>
      <Avatar name={name} size={46} avatarUrl={profile.avatar_url} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {profile.username ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.username}
          </Text>
        ) : null}
      </View>
      <Pressable
        style={[styles.circle, profile.isCloseFriend && styles.circleActive]}
        disabled={disabled}
        hitSlop={10}
        onPress={onToggle}>
        {profile.isCloseFriend ? <Text style={styles.checkmark}>✓</Text> : null}
      </Pressable>
    </View>
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
    name: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    circle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleActive: { backgroundColor: '#34C759', borderColor: '#34C759' },
    checkmark: { color: '#fff', fontSize: 14, fontFamily: BrandFonts.syneBold },
  });
}
