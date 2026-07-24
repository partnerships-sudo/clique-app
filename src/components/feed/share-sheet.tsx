import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { Alert, Image, Linking, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { useShareIcons } from '@/hooks/use-share-icons';

export interface ShareSheetPost {
  title: string;
  type: string;
  sub?: string;
  poster?: string;
  rating?: number;
  note?: string;
  date?: string;
  extRating?: number;
  mediaType?: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  post: ShareSheetPost;
  isMine?: boolean;
  onWatchlist?: () => void;
}

export function ShareSheet({ visible, onClose, post, isMine, onWatchlist }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const ic = useShareIcons();

  function close() { onClose(); }

  function handleRecommend() {
    close();
    router.push({ pathname: '/recommend-modal', params: { title: post.title, type: post.type, sub: post.sub, poster: post.poster, extRating: post.extRating != null ? String(post.extRating) : undefined, mediaType: post.mediaType } });
  }

  function handleLogIt() {
    close();
    router.push({ pathname: '/log-modal', params: { intent: 'log', prefillTitle: post.title, prefillType: post.type, prefillSub: post.sub, prefillPoster: post.poster } });
  }

  function handleWatchlist() {
    close();
    onWatchlist?.();
  }

  function shareText() {
    return `Check out ${post.title} on Clique!${post.sub ? ` (${post.sub})` : ''}`;
  }

  async function handleMessages() {
    close();
    try {
      await Share.share({ message: shareText() });
    } catch {}
  }

  async function handleMail() {
    close();
    const subject = encodeURIComponent(`Check out ${post.title} on Clique`);
    const body = encodeURIComponent(shareText());
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
  }

  async function handleWhatsApp() {
    close();
    const text = encodeURIComponent(shareText());
    const url = `whatsapp://send?text=${text}`;
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp not installed', 'Install WhatsApp to share via WhatsApp.');
    }
  }

  async function handleAirDrop() {
    close();
    try {
      await Share.share({ message: shareText() });
    } catch {}
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.title}>{post.title}</Text>

          {/* Primary actions */}
          <View style={styles.actionsRow}>
            <Pressable style={styles.actionBtn} onPress={handleRecommend}>
              <View style={styles.actionIcon}>
                <SymbolView name="person.2.fill" size={22} tintColor={Brand.trust} type="monochrome" />
              </View>
              <Text style={styles.actionLabel}>Recommend</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={handleLogIt}>
              <View style={styles.actionIcon}>
                <SymbolView name="checkmark.circle.fill" size={22} tintColor={Brand.trust} type="monochrome" />
              </View>
              <Text style={styles.actionLabel}>Log it</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={handleWatchlist}>
              <View style={styles.actionIcon}>
                <SymbolView name="bookmark.fill" size={22} tintColor={Brand.trust} type="monochrome" />
              </View>
              <Text style={styles.actionLabel}>Watchlist</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* External share row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.externalRow}>
            <Pressable style={styles.externalItem} onPress={handleMessages}>
              <Image source={ic.messages} style={styles.externalIcon} />
              <Text style={styles.externalLabel}>Messages</Text>
            </Pressable>

            <Pressable style={styles.externalItem} onPress={handleMail}>
              <Image source={ic.mail} style={styles.externalIcon} />
              <Text style={styles.externalLabel}>Mail</Text>
            </Pressable>

            <Pressable style={styles.externalItem} onPress={handleWhatsApp}>
              <Image source={ic.whatsapp} style={styles.externalIcon} />
              <Text style={styles.externalLabel}>WhatsApp</Text>
            </Pressable>

            <Pressable style={styles.externalItem} onPress={handleAirDrop}>
              <Image source={ic.airdrop} style={styles.externalIcon} />
              <Text style={styles.externalLabel}>AirDrop</Text>
            </Pressable>

          </ScrollView>


          <Pressable style={styles.cancelBtn} onPress={close}>
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
      paddingBottom: 28,
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
      marginBottom: 20,
    },
    actionsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: 20,
    },
    actionBtn: { alignItems: 'center', width: 88 },
    actionIcon: {
      width: 58,
      height: 58,
      borderRadius: 16,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 7,
    },
    actionLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.ink,
      textAlign: 'center',
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: Brand.border,
      marginBottom: 20,
    },
    externalRow: {
      gap: 16,
      paddingHorizontal: 4,
      paddingBottom: 4,
      marginBottom: 16,
    },
    externalItem: { alignItems: 'center', width: 72 },
    externalIcon: {
      width: 58,
      height: 58,
      borderRadius: 16,
      marginBottom: 7,
    },
    externalLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.ink,
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
