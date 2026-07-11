import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { MutualConnectionsSheet } from '@/components/friends/mutual-connections-sheet';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import type { Profile } from '@/features/follows/api';

export function SuggestedUserCard({
  profile,
  onAdd,
  onDismiss,
  isAdding,
  mutualCount,
}: {
  profile: Profile;
  onAdd: () => void;
  onDismiss: () => void;
  isAdding: boolean;
  mutualCount?: number;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile.full_name || profile.username || 'Someone';
  const [sent, setSent] = useState(false);
  const [mutualSheetVisible, setMutualSheetVisible] = useState(false);

  return (
    <View style={styles.card}>
      <Pressable style={styles.dismissBtn} hitSlop={8} onPress={onDismiss}>
        <Text style={styles.dismissText}>✕</Text>
      </Pressable>
      <Pressable
        style={styles.identity}
        onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: profile.id } })}>
        <View style={styles.topRow}>
          <Avatar name={name} size={44} avatarUrl={profile.avatar_url} />
          <View style={styles.nameCol}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {profile.username ? (
              <Text style={styles.handle} numberOfLines={1}>
                @{profile.username}
              </Text>
            ) : null}
          </View>
        </View>
        {mutualCount ? (
          <Pressable
            style={styles.mutualPill}
            hitSlop={6}
            onPress={() => setMutualSheetVisible(true)}>
            <Text style={styles.mutualIcon}>👥</Text>
            <Text style={styles.mutual} numberOfLines={1}>
              {mutualCount} mutual {mutualCount === 1 ? 'connection' : 'connections'}
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
      <MutualConnectionsSheet
        visible={mutualSheetVisible}
        onClose={() => setMutualSheetVisible(false)}
        targetUserId={profile.id}
        targetName={name}
      />
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
            {sent ? 'Requested' : '+ Follow'}
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
      borderRadius: 16,
      padding: 13,
      width: 198,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    dismissBtn: {
      position: 'absolute',
      top: 9,
      right: 9,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    dismissText: { fontSize: 10, color: Brand.trust, fontFamily: BrandFonts.syneBold },
    identity: { alignItems: 'stretch' },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingRight: 20 },
    nameCol: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, marginTop: 1 },
    mutualPill: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 4,
      backgroundColor: Brand.tlight,
      borderRadius: 20,
      paddingVertical: 3,
      paddingHorizontal: 8,
      marginTop: 9,
    },
    mutualIcon: { fontSize: 9 },
    mutual: { fontFamily: BrandFonts.interMedium, fontSize: 10, color: Brand.trust },
    addBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 6,
      paddingHorizontal: 14,
      marginTop: 9,
      alignSelf: 'flex-start',
      alignItems: 'center',
    },
    addBtnSent: { backgroundColor: Brand.tlight },
    addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },
    addBtnTextSent: { color: Brand.trust },
  });
}
