import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { compatColor, compatLabel } from '@/features/friends/compatibility';
import type { Post } from '@/features/feed/api';
import { useBrand } from '@/hooks/use-brand';
import type { Profile } from '@/features/follows/api';

export function FriendCard({
  profile,
  compatibility,
  hasUnread,
  currentlyWatching,
  isTopMatch = false,
}: {
  profile: Profile;
  compatibility: number;
  hasUnread?: boolean;
  currentlyWatching?: Post | null;
  isTopMatch?: boolean;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const color = compatColor(compatibility);
  const { emoji, label } = compatLabel(compatibility);

  return (
    <View style={[styles.card, isTopMatch && styles.cardTopMatch]}>
      {isTopMatch ? (
        <View style={styles.topMatchBanner}>
          <Text style={styles.topMatchLabel}>⭐ YOUR TOP MATCH</Text>
        </View>
      ) : null}

      <View style={[styles.cardBody, styles.row]}>
        {/* Left: avatar + % badge */}
        <Pressable
          style={styles.avatarWrap}
          onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
          <View style={[styles.avatarRing, { borderColor: color }]}>
            <Avatar name={name} size={52} avatarUrl={profile.avatar_url} />
          </View>
          <View style={[styles.pctBadge, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
            <Text style={[styles.pctText, { color }]}>{compatibility}%</Text>
          </View>
        </Pressable>

        {/* Middle: name, handle, label — flex so it takes remaining space */}
        <Pressable
          style={styles.info}
          onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          {profile.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          <Text style={styles.compatLabel}>{emoji} <Text style={[styles.compatLabelText, { color }]}>{label}</Text></Text>
        </Pressable>

        {/* Right column: currently watching + chat button */}
        <View style={styles.rightCol}>
          {currentlyWatching ? (
            <View style={styles.watching}>
              <Text style={styles.watchingLabel}>CURRENTLY WATCHING</Text>
              <View style={styles.watchingRow}>
                {currentlyWatching.poster ? (
                  <Image source={{ uri: currentlyWatching.poster }} style={styles.watchingPoster} resizeMode="cover" />
                ) : null}
                <Text style={styles.watchingTitle} numberOfLines={3}>{currentlyWatching.title}</Text>
              </View>
            </View>
          ) : null}
          <Pressable
            style={styles.chatBtn}
            hitSlop={8}
            onPress={() =>
              router.push({
                pathname: '/chat-modal',
                params: { friendId: profile.id, friendName: name, friendAvatar: profile.avatar_url ?? undefined },
              })
            }>
            <SymbolView name="bubble.left" size={16} tintColor={Brand.trust} style={{ width: 18, height: 18 }} />
            {hasUnread ? <View style={styles.unreadDot} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: Brand.border,
      marginBottom: 12,
      overflow: 'hidden',
    },
    cardTopMatch: {
      borderColor: '#5B4FE8',
    },
    topMatchBanner: {
      backgroundColor: '#EEEAFF',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    topMatchLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: '#5B4FE8',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    cardBody: {
      padding: 16,
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    avatarWrap: { alignItems: 'center', position: 'relative', marginBottom: 4 },
    avatarRing: {
      width: 62,
      height: 62,
      borderRadius: 31,
      borderWidth: 2.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pctBadge: {
      position: 'absolute',
      bottom: -8,
      alignSelf: 'center',
      borderRadius: 10,
      borderWidth: 1,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    pctText: { fontFamily: BrandFonts.syneBold, fontSize: 10 },
    info: { flex: 1, minWidth: 0, paddingTop: 4 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 2 },
    compatLabel: { marginTop: 5, fontSize: 12 },
    compatLabelText: { fontFamily: BrandFonts.syneBold, fontSize: 12 },
    rightCol: { width: 100, alignItems: 'flex-end', gap: 8 },
    watching: { width: '100%' },
    watchingLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 7.5,
      color: Brand.muted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    watchingRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start' },
    watchingPoster: { width: 32, height: 44, borderRadius: 5, backgroundColor: Brand.border },
    watchingTitle: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.ink, lineHeight: 14 },
    chatBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unreadDot: {
      position: 'absolute',
      top: 2,
      right: 2,
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor: Brand.trust,
      borderWidth: 1.5,
      borderColor: Brand.card,
    },
  });
}
