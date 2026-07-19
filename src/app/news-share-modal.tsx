import { router, useLocalSearchParams } from 'expo-router';
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
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useSendDm } from '@/features/dms/api';
import { useFriends } from '@/features/friends/api';
import { useBrand } from '@/hooks/use-brand';

const icons = {
  light: {
    messages: require('@/assets/logos/messages_light.png'),
    mail:     require('@/assets/logos/mail_light.png'),
    airdrop:  require('@/assets/logos/airdrop_light.png'),
    whatsapp: require('@/assets/logos/whatsapp_App_Icon_Light_2026.png'),
  },
  dark: {
    messages: require('@/assets/logos/messages_dark.png'),
    mail:     require('@/assets/logos/mail_dark.png'),
    airdrop:  require('@/assets/logos/airdrop_dark.png'),
    whatsapp: require('@/assets/logos/whatsapp_App_Icon_Dark_2026.png'),
  },
};

export default function NewsShareModal() {
  const params = useLocalSearchParams<{ title: string; url: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const scheme = useColorScheme();
  const ic = scheme === 'dark' ? icons.dark : icons.light;

  const { data: friends = [] } = useFriends();
  const sendDm = useSendDm();
  const [sent, setSent] = useState(new Set<string>());
  const [sending, setSending] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredFriends = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        (f.full_name ?? '').toLowerCase().includes(q) ||
        (f.username ?? '').toLowerCase().includes(q),
    );
  }, [friends, search]);

  const shareText = `${params.title}\n${params.url}`;

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
    router.back();
    const url = `sms:&body=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Can't open Messages", "Messages isn't available on this device.");
  }

  async function openMail() {
    router.back();
    const url = `mailto:?subject=${encodeURIComponent(params.title)}&body=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert("Can't open Mail", 'No mail account is set up on this device.');
  }

  async function openAirDrop() {
    router.back();
    try { await Share.share({ message: shareText, url: params.url }); } catch { /* dismissed */ }
  }

  async function openWhatsApp() {
    router.back();
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(url);
    if (can) Linking.openURL(url);
    else Alert.alert('WhatsApp not installed', 'Install WhatsApp to share this way.');
  }

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      <Pressable style={styles.sheet} onPress={() => {}}>
        <View style={styles.grabber} />
        <Text style={styles.title}>Share article</Text>

        {friends.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Send in Clique</Text>
            <View style={styles.searchWrap}>
              <SymbolView name="magnifyingglass" size={14} tintColor={Brand.muted} type="monochrome" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search"
                placeholderTextColor={Brand.muted}
                value={search}
                onChangeText={setSearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.friendsRow}
              style={styles.friendsScroll}>
              {filteredFriends.map((f) => {
                const isSent = sent.has(f.id);
                const isSending = sending === f.id;
                return (
                  <Pressable
                    key={f.id}
                    style={styles.friendItem}
                    onPress={() => sendToFriend(f.id)}
                    disabled={isSent || !!sending}>
                    <View style={styles.avatarWrap}>
                      <Avatar
                        avatarUrl={f.avatar_url}
                        name={f.full_name ?? f.username ?? '?'}
                        size={52}
                      />
                      {(isSending || isSent) && (
                        <View style={styles.avatarOverlay}>
                          {isSending
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <SymbolView name="checkmark" size={20} tintColor="#fff" type="monochrome" />}
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

        <Text style={styles.sectionLabel}>Share via</Text>
        <View style={styles.iconRow}>
          <Pressable style={styles.iconItem} onPress={openSms}>
            <Image source={ic.messages} style={styles.iconImg} />
            <Text style={styles.iconLabel}>Messages</Text>
          </Pressable>
          <Pressable style={styles.iconItem} onPress={openMail}>
            <Image source={ic.mail} style={styles.iconImg} />
            <Text style={styles.iconLabel}>Mail</Text>
          </Pressable>
          <Pressable style={styles.iconItem} onPress={openAirDrop}>
            <Image source={ic.airdrop} style={styles.iconImg} />
            <Text style={styles.iconLabel}>AirDrop</Text>
          </Pressable>
          <Pressable style={styles.iconItem} onPress={openWhatsApp}>
            <Image source={ic.whatsapp} style={styles.iconImg} />
            <Text style={styles.iconLabel}>WhatsApp</Text>
          </Pressable>
        </View>

        <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </Pressable>
    </Pressable>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
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
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Brand.card,
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 7,
      marginBottom: 14,
    },
    searchInput: {
      flex: 1,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
    },
    friendsScroll: { marginBottom: 20 },
    friendsRow: { gap: 14 },
    friendItem: { alignItems: 'center', width: 62 },
    avatarWrap: { borderRadius: 30, overflow: 'hidden' },
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
    iconImg: { width: 58, height: 58, borderRadius: 16, overflow: 'hidden' },
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
