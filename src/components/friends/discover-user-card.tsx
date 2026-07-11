import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { MutualConnectionsSheet } from '@/components/friends/mutual-connections-sheet';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { DiscoverProfile } from '@/features/follows/api';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';

export function DiscoverUserCard({
  profile,
  onFollow,
  isAdding,
}: {
  profile: DiscoverProfile;
  onFollow: () => void;
  isAdding: boolean;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const [requested, setRequested] = useState(false);
  const [mutualSheetVisible, setMutualSheetVisible] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.identity}
        onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
        <Avatar name={name} size={48} avatarUrl={profile.avatar_url} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {profile.username ? (
            <Text style={styles.handle} numberOfLines={1}>
              @{profile.username}
            </Text>
          ) : null}
          {profile.location ? (
            <Text style={styles.location} numberOfLines={1}>
              📍 {profile.location}
            </Text>
          ) : null}
          {profile.compatibility !== undefined ? (
            <View style={[styles.statPill, { backgroundColor: compatColor(profile.compatibility) + '1A' }]}>
              <Text style={[styles.statText, { color: compatColor(profile.compatibility) }]}>
                {compatEmoji(profile.compatibility)} {profile.compatibility}% compatible
              </Text>
            </View>
          ) : profile.mutualCount !== undefined ? (
            <Pressable style={styles.statPill} hitSlop={6} onPress={() => setMutualSheetVisible(true)}>
              <Text style={styles.statText}>
                👥 {profile.mutualCount} mutual {profile.mutualCount === 1 ? 'connection' : 'connections'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>
      <Pressable
        style={[styles.followBtn, requested && styles.followBtnDone]}
        disabled={requested}
        onPress={() => {
          setRequested(true);
          onFollow();
        }}>
        {isAdding ? (
          <ActivityIndicator color={requested ? Brand.trust : '#fff'} size="small" />
        ) : (
          <Text style={[styles.followBtnText, requested && styles.followBtnTextDone]}>
            {requested ? (profile.is_private ? 'Requested ✓' : 'Following ✓') : '+ Follow'}
          </Text>
        )}
      </Pressable>
      <MutualConnectionsSheet
        visible={mutualSheetVisible}
        onClose={() => setMutualSheetVisible(false)}
        targetUserId={profile.id}
        targetName={name}
      />
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
    location: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 3 },
    statPill: {
      alignSelf: 'flex-start',
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 8,
      marginTop: 6,
    },
    statText: { fontFamily: BrandFonts.syneBold, fontSize: 10.5, color: Brand.trust },
    followBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: 14,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 92,
    },
    followBtnDone: { backgroundColor: Brand.tlight },
    followBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    followBtnTextDone: { color: Brand.trust },
  });
}
