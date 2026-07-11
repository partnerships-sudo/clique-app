import { useMemo } from 'react';
import { Alert, Linking, Modal, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

// TODO: swap in the real App Store link once Clique is live.
const APP_STORE_URL = 'https://apps.apple.com/app/id0000000000';
const INVITE_MESSAGE = `Hey, join my clique! Download it here: ${APP_STORE_URL}`;

export function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  async function openSms() {
    onClose();
    const url = `sms:&body=${encodeURIComponent(INVITE_MESSAGE)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Can't open Messages", "Messages isn't available on this device.");
  }

  async function openMail() {
    onClose();
    const url = `mailto:?subject=${encodeURIComponent('Join me on Clique')}&body=${encodeURIComponent(INVITE_MESSAGE)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Can't open Mail", 'No mail account is set up on this device.');
  }

  async function openAirDrop() {
    onClose();
    // iOS only exposes AirDrop through the system share sheet — there's no
    // URL scheme that opens AirDrop alone with a prefilled message, so this
    // hands off to the native sheet (AirDrop will be one of the options).
    try {
      await Share.share({ message: INVITE_MESSAGE });
    } catch {
      // user dismissed the sheet
    }
  }

  async function openWhatsApp() {
    onClose();
    const url = `whatsapp://send?text=${encodeURIComponent(INVITE_MESSAGE)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert('WhatsApp not installed', 'Install WhatsApp to invite friends this way.');
  }

  const options = [
    { key: 'sms', label: 'Messages', bg: '#34C759', glyph: '💬', onPress: openSms },
    { key: 'mail', label: 'Mail', bg: '#3B82F6', glyph: '✉️', onPress: openMail },
    { key: 'airdrop', label: 'AirDrop', bg: '#0EA5E9', glyph: '📡', onPress: openAirDrop },
    { key: 'whatsapp', label: 'WhatsApp', bg: '#25D366', glyph: 'W', onPress: openWhatsApp, isLetter: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Invite friends</Text>
          <View style={styles.iconGrid}>
            {options.map((opt) => (
              <Pressable key={opt.key} style={styles.iconItem} onPress={opt.onPress}>
                <View style={[styles.iconWrap, { backgroundColor: opt.bg }]}>
                  <Text style={opt.isLetter ? styles.iconLetter : styles.iconGlyph}>{opt.glyph}</Text>
                </View>
                <Text style={styles.iconLabel}>{opt.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
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
      marginBottom: 14,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15,
      color: Brand.ink,
      textAlign: 'center',
      marginBottom: 18,
    },
    iconGrid: {
      flexDirection: 'row',
      justifyContent: 'space-evenly',
      marginBottom: 16,
    },
    iconItem: { alignItems: 'center', width: 68 },
    iconWrap: {
      width: 58,
      height: 58,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconGlyph: { fontSize: 26 },
    iconLetter: { fontSize: 24, color: '#fff', fontFamily: BrandFonts.syneExtraBold },
    iconLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11.5,
      color: Brand.ink,
      marginTop: 7,
      textAlign: 'center',
    },
    cancelBtn: {
      paddingVertical: 13,
      borderRadius: 16,
      backgroundColor: Brand.card,
      alignItems: 'center',
    },
    cancelText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
