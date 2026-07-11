import { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { BlockableUser } from '@/features/blocks/api';
import { useSetBlockMute } from '@/features/blocks/api';
import { useBrand } from '@/hooks/use-brand';

export function BlockMuteSheet({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: BlockableUser | undefined;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const setBlockMute = useSetBlockMute();

  if (!profile) return null;
  const name = profile.full_name || profile.username || 'Someone';

  function toggleBlocked(value: boolean) {
    if (!profile) return;
    setBlockMute.mutate({ targetUserId: profile.id, isBlocked: value, isMuted: profile.isMuted });
  }

  function toggleMuted(value: boolean) {
    if (!profile) return;
    setBlockMute.mutate({ targetUserId: profile.id, isBlocked: profile.isBlocked, isMuted: value });
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.identity}>
            <Avatar name={name} size={48} avatarUrl={profile.avatar_url} />
            <View style={styles.identityInfo}>
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

          <View style={styles.row}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Block</Text>
              <Text style={styles.rowSub}>They won&rsquo;t be able to follow you or interact with you. Any existing follow is removed.</Text>
            </View>
            <Switch
              value={profile.isBlocked}
              onValueChange={toggleBlocked}
              disabled={setBlockMute.isPending}
              trackColor={{ false: Brand.border, true: '#E84F4F' }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.row, styles.rowDivider]}>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Mute</Text>
              <Text style={styles.rowSub}>Their posts and activity are hidden from you. They won&rsquo;t know they&rsquo;re muted.</Text>
            </View>
            <Switch
              value={profile.isMuted}
              onValueChange={toggleMuted}
              disabled={setBlockMute.isPending}
              trackColor={{ false: Brand.border, true: Brand.trust }}
              thumbColor="#fff"
            />
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Done</Text>
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
    },
    grabber: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center',
      marginBottom: 18,
    },
    identity: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    identityInfo: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginTop: 2 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      gap: 14,
    },
    rowDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 3 },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, lineHeight: 16.5 },
    closeBtn: {
      marginTop: 16,
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: Brand.card,
      alignItems: 'center',
    },
    closeText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
