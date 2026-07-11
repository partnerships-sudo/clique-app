import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useMemo, useState } from 'react';
import { Image, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import type { Profile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

export function ShareProfileModal({
  visible,
  onClose,
  profile,
}: {
  visible: boolean;
  onClose: () => void;
  profile: Profile | null | undefined;
}) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [copied, setCopied] = useState(false);
  const name = profile?.full_name || profile?.username || 'Someone';

  const link = profile?.id
    ? Linking.createURL('friend-profile-modal', { queryParams: { userId: profile.id } })
    : '';

  async function handleCopy() {
    if (!link) return;
    await Clipboard.setStringAsync(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  async function handleShare() {
    if (!link) return;
    try {
      await Share.share({
        message: `Add me on Clique! ${link}`,
        url: link,
      });
    } catch {
      // user cancelled — nothing to do
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.avRing}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avImg} />
            ) : (
              <View style={styles.avFallback}>
                <Text style={styles.avFallbackText}>{name[0]?.toUpperCase() ?? '?'}</Text>
              </View>
            )}
          </View>

          <Text style={styles.name}>{name}</Text>
          {profile?.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
          <Text style={styles.tagline}>Add me on Clique!</Text>

          <View style={styles.linkPill}>
            <Text style={styles.linkText} numberOfLines={1}>
              {link}
            </Text>
          </View>

          <View style={styles.btnRow}>
            <Pressable style={styles.secondaryBtn} onPress={handleCopy}>
              <Text style={styles.secondaryBtnText}>{copied ? '✓ Copied' : '📋 Copy Link'}</Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={handleShare}>
              <Text style={styles.primaryBtnText}>📤 Share</Text>
            </Pressable>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: Brand.border,
      padding: 26,
      alignItems: 'center',
      width: '100%',
      maxWidth: 340,
    },
    avRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 2,
      borderColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    avImg: { width: 64, height: 64, borderRadius: 32 },
    avFallback: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avFallbackText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 19, color: Brand.ink, textAlign: 'center' },
    handle: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted, marginTop: 2 },
    tagline: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 13.5,
      color: Brand.trust,
      marginTop: 12,
    },
    linkPill: {
      backgroundColor: Brand.tlight,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      marginTop: 16,
      alignSelf: 'stretch',
    },
    linkText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, textAlign: 'center' },
    btnRow: { flexDirection: 'row', gap: 10, marginTop: 18, alignSelf: 'stretch' },
    secondaryBtn: {
      flex: 1,
      backgroundColor: Brand.tlight,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    secondaryBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    primaryBtn: {
      flex: 1,
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
    },
    primaryBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
    closeBtn: { marginTop: 16 },
    closeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
  });
}
