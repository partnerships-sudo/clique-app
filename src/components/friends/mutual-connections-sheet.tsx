import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useMutualConnections } from '@/features/follows/api';
import { useBrand } from '@/hooks/use-brand';

export function MutualConnectionsSheet({
  visible,
  onClose,
  targetUserId,
  targetName,
}: {
  visible: boolean;
  onClose: () => void;
  targetUserId: string | undefined;
  targetName: string;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: mutuals, isLoading } = useMutualConnections(visible ? targetUserId : undefined);

  function openProfile(userId: string) {
    onClose();
    router.push({ pathname: '/friend-profile-modal', params: { userId } });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Mutual connections</Text>
          <Text style={styles.subtitle}>People you follow who also follow {targetName}</Text>

          {isLoading ? (
            <ActivityIndicator color={Brand.trust} style={styles.spinner} />
          ) : (
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {(mutuals ?? []).length === 0 ? (
                <Text style={styles.empty}>No mutual connections found.</Text>
              ) : (
                (mutuals ?? []).map((profile) => {
                  const name = profile.full_name || profile.username || 'Someone';
                  return (
                    <Pressable key={profile.id} style={styles.row} onPress={() => openProfile(profile.id)}>
                      <Avatar name={name} size={44} avatarUrl={profile.avatar_url} />
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {name}
                        </Text>
                        {profile.username ? (
                          <Text style={styles.rowHandle} numberOfLines={1}>
                            @{profile.username}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: Brand.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 24,
      maxHeight: '75%',
    },
    grabber: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.ink,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 4,
      marginBottom: 18,
    },
    spinner: { paddingVertical: 30 },
    list: { marginBottom: 12 },
    empty: {
      textAlign: 'center',
      paddingVertical: 24,
      color: Brand.muted,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Brand.card,
      borderRadius: 16,
      padding: 11,
      marginBottom: 8,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    rowHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    closeBtn: {
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: Brand.card,
      alignItems: 'center',
    },
    closeText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
