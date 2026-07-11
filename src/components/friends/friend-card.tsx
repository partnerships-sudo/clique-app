import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';
import type { Profile } from '@/features/follows/api';

export function FriendCard({
  profile,
  compatibility,
  hasUnread,
}: {
  profile: Profile;
  compatibility: number;
  hasUnread?: boolean;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const color = compatColor(compatibility);
  const isHot = compatibility >= 90;

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
              {isHot ? (
                <LinearGradient
                  colors={['#E84F4F', '#F4A340']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.fill, { width: `${compatibility}%` }]}
                />
              ) : (
                <View style={[styles.fill, { width: `${compatibility}%`, backgroundColor: color }]} />
              )}
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
        {hasUnread ? <View style={styles.unreadDot} /> : null}
      </Pressable>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderRadius: 18,
      padding: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    identity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
    info: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 15.5, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    compatRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    track: { flex: 1, height: 6, backgroundColor: Brand.tlight, borderRadius: 3, overflow: 'hidden' },
    fill: { height: '100%', borderRadius: 3 },
    score: { fontFamily: BrandFonts.syneBold, fontSize: 11.5 },
    chatBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chatBtnIcon: { fontSize: 17 },
    unreadDot: {
      position: 'absolute',
      top: 1,
      right: 1,
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: Brand.trust,
      borderWidth: 2,
      borderColor: Brand.card,
    },
  });
}
