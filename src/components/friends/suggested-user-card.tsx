import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import type { Profile } from '@/features/friends/api';

export function SuggestedUserCard({
  profile,
  onAdd,
  isAdding,
  mutualCount,
}: {
  profile: Profile;
  onAdd: () => void;
  isAdding: boolean;
  mutualCount?: number;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const [sent, setSent] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.identity}
        onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
        <Avatar name={name} size={50} avatarUrl={profile.avatar_url} />
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {profile.username ? (
          <Text style={styles.handle} numberOfLines={1}>
            @{profile.username}
          </Text>
        ) : null}
        {mutualCount ? (
          <Text style={styles.mutual} numberOfLines={1}>
            {mutualCount} mutual {mutualCount === 1 ? 'friend' : 'friends'}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        style={[styles.addBtn, sent && styles.addBtnSent]}
        disabled={isAdding || sent}
        onPress={() => {
          setSent(true);
          onAdd();
        }}>
        {isAdding ? (
          <ActivityIndicator color={sent ? Brand.trust : '#fff'} size="small" />
        ) : (
          <Text style={[styles.addBtnText, sent && styles.addBtnTextSent]}>
            {sent ? 'Requested' : '+ Add'}
          </Text>
        )}
      </Pressable>
    </View>
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
      alignItems: 'center',
      width: 120,
    },
    identity: { alignItems: 'center' },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.ink, marginTop: 8 },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 1 },
    mutual: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.trust, marginTop: 3, textAlign: 'center' },
    addBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 7,
      paddingHorizontal: 14,
      marginTop: 10,
      minWidth: 76,
      alignItems: 'center',
    },
    addBtnSent: { backgroundColor: Brand.tlight },
    addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: '#fff' },
    addBtnTextSent: { color: Brand.trust },
  });
}
