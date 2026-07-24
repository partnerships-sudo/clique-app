import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useSendDm } from '@/features/dms/api';
import { useFriends } from '@/features/friends/api';
import { useBrand } from '@/hooks/use-brand';
import { useShareIcons } from '@/hooks/use-share-icons';

interface Props {
  visible: boolean;
  onClose: () => void;
  title: string;
  url: string;
}

export function NewsShareSheet({ visible, onClose, title, url }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const ic = useShareIcons();

  const { data: friends = [] } = useFriends();
  const sendDm = useSendDm();
  const [sent, setSent] = useState(new Set<string>());
  const [sending, setSending] = useState<string | null>(null);

  const shareText = `${title}\n${url}`;

  async function sendToFriend(friendId: string) {
    if (sent.has(friendId) || sending) return;
    setSending(friendId);
    try {
      await sendDm.mutateAsync({ friendId, content: shareText });
      setSent((prev) => new Set([...prev, friendId]));
    } finally {
      setSending(null);
    }
  }

  async function openSms() {
    onClose();
    const smsUrl = `sms:&body=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(smsUrl);
    if (can) Linking.openURL(smsUrl);
    else Alert.alert("Can't open Messages", "Messages isn't available on this device.");
  }

  async function openMail() {
    onClose();
    const mailUrl = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(mailUrl);
    if (can) Linking.openURL(mailUrl);
    else Alert.alert("Can't open Mail", 'No mail account is set up on this device.');
  }

  async function openAirDrop() {
    onClose();
    try { await Share.share({ message: shareText, url }); } catch { /* dismissed */ }
  }

  async function openWhatsApp() {
    onClose();
    const waUrl = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(waUrl);
    if (can) Linking.openURL(waUrl);
    else Alert.alert('WhatsApp not installed', 'Install WhatsApp to share this way.');
  }

  if (!visible) return null;

  return (
    <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Share article</Text>

          {/* In-app friends row */}
          {friends.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Send in Clique</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.friendsRow}>
                {friends.map((f) => {
                  const isSent = sent.has(f.id);
                  const isSending = sending === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      style={styles.friendItem}
                      onPress={() => sendToFriend(f.id)}
                      disabled={isSent || !!sending}>
                      <View style={[styles.avatarWrap, isSent && styles.avatarSent]}>
                        <Avatar
                          avatarUrl={f.avatar_url}
                          name={f.full_name ?? f.username ?? '?'}
                          size={52}
                        />
                        {isSending && (
                          <View style={styles.avatarOverlay}>
                            <ActivityIndicator size="small" color="#fff" />
                          </View>
                        )}
                        {isSent && (
                          <View style={styles.avatarOverlay}>
                            <SymbolView name="checkmark" size={20} tintColor="#fff" type="monochrome" />
                          </View>
                        )}
                      </View>
                      <Text style={styles.friendName} numberOfLines={1}>
                        {isSent ? 'Sent!' : (f.full_name ?? f.username ?? '?')}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          )}

          {/* Platform icons */}
          <Text style={styles.sectionLabel}>Share via</Text>
          <View style={styles.iconRow}>
            <Pressable style={styles.iconItem} onPress={openSms}>
              <Image source={ic.messages} style={styles.iconWrap} />
              <Text style={styles.iconLabel}>Messages</Text>
            </Pressable>
            <Pressable style={styles.iconItem} onPress={openMail}>
              <Image source={ic.mail} style={styles.iconWrap} />
              <Text style={styles.iconLabel}>Mail</Text>
            </Pressable>
            <Pressable style={styles.iconItem} onPress={openAirDrop}>
              <Image source={ic.airdrop} style={styles.iconWrap} />
              <Text style={styles.iconLabel}>AirDrop</Text>
            </Pressable>
            <Pressable style={styles.iconItem} onPress={openWhatsApp}>
              <Image source={ic.whatsapp} style={styles.iconWrap} />
              <Text style={styles.iconLabel}>WhatsApp</Text>
            </Pressable>
          </View>

          <Pressable style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    backdrop: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: Brand.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 34,
    },
    grabber: {
      width: 40, height: 4, borderRadius: 2,
      backgroundColor: Brand.border,
      alignSelf: 'center', marginBottom: 14,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15, color: Brand.ink,
      textAlign: 'center', marginBottom: 16,
    },
    sectionLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11, color: Brand.muted,
      textTransform: 'uppercase', letterSpacing: 0.5,
      marginBottom: 12,
    },
    friendsRow: { gap: 14, paddingBottom: 20 },
    friendItem: { alignItems: 'center', width: 62 },
    avatarWrap: { borderRadius: 30, overflow: 'hidden' },
    avatarSent: { opacity: 0.85 },
    avatarOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center', justifyContent: 'center',
    },
    friendName: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11, color: Brand.ink,
      marginTop: 6, textAlign: 'center',
    },
    iconRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 20,
    },
    iconItem: { alignItems: 'center', width: 72 },
    iconWrap: { width: 58, height: 58, borderRadius: 16, overflow: 'hidden' },
    iconLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11, color: Brand.ink,
      marginTop: 7, textAlign: 'center',
    },
    cancelBtn: {
      paddingVertical: 13, borderRadius: 16,
      backgroundColor: Brand.card, alignItems: 'center',
    },
    cancelText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
