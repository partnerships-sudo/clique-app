import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';
import type { Profile } from '@/features/friends/api';

export function FriendCard({ profile, compatibility }: { profile: Profile; compatibility: number }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const color = compatColor(compatibility);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.identity}
        onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
        <Avatar name={name} size={46} avatarUrl={profile.avatar_url} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          <View style={styles.compatRow}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${compatibility}%`, backgroundColor: color }]} />
            </View>
            <Text style={[styles.score, { color }]}>
              {compatEmoji(compatibility)} {compatibility}%
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable
        style={styles.chatBtn}
        hitSlop={8}
        onPress={() =>
          router.push({
            pathname: '/chat-modal',
            params: {
              friendId: profile.id,
              friendName: name,
              friendAvatar: profile.avatar_url ?? undefined,
            },
          })
        }>
        <Text style={styles.chatBtnIcon}>💬</Text>
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
      padding: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
    info: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    compatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
    track: { flex: 1, height: 5, backgroundColor: Brand.border, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    score: { fontFamily: BrandFonts.syneBold, fontSize: 11.5 },
    chatBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatBtnIcon: { fontSize: 17 },
  });
}
