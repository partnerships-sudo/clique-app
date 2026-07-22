import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { SymbolView } from 'expo-symbols';

import { type RatingIconStyle } from '@/components/rating-icons';
import { InstagramIcon } from '@/components/share/instagram-icon';
import { ShareCard } from '@/components/share/share-card';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useContentDetails } from '@/features/content/api';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

const INSTAGRAM_STORIES_URL = 'instagram-stories://share';

export default function ShareCardModal() {
  const params = useLocalSearchParams<{
    title: string;
    type: EntryType;
    poster?: string;
    sub?: string;
    rating?: string;
    note?: string;
    date?: string;
  }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();
  const ratingIcon = (profile?.rating_icon as RatingIconStyle) ?? 'stars';
  const { data: details } = useContentDetails(params.title, params.type);
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);

  async function captureCard() {
    if (!cardRef.current) throw new Error('no ref');
    return captureRef(cardRef, { format: 'png', quality: 1 });
  }

  async function handleShareInstagram() {
    setIsSharing(true);
    try {
      const base64 = await captureRef(cardRef, { format: 'png', quality: 1, result: 'base64' });
      await Clipboard.setImageAsync(base64);
      await Linking.openURL(`${INSTAGRAM_STORIES_URL}?source_application=com.lanapolitano.thecliqueapp`);
    } catch {
      Alert.alert("Couldn't share", 'Something went wrong generating the share card. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  async function handleShareOther() {
    setIsSharing(true);
    try {
      const uri = await captureCard();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert('Sharing unavailable', "Sharing isn't supported on this device.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png' });
    } catch {
      Alert.alert("Couldn't share", 'Something went wrong generating the share card. Please try again.');
    } finally {
      setIsSharing(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>

      <View style={styles.content}>
        <ShareCard
          ref={cardRef}
          title={params.title}
          sub={params.sub}
          poster={params.poster}
          type={params.type}
          rating={params.rating ? Number(params.rating) : null}
          ratingIcon={ratingIcon}
          note={params.note}
          date={params.date}
          genre={details?.genre}
        />

        <Text style={styles.hint}>
          Share this card to your story or send it anywhere.
        </Text>

        <Pressable style={styles.shareBtn} disabled={isSharing} onPress={handleShareInstagram}>
          {isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={styles.shareBtnContent}>
              <InstagramIcon size={20} />
              <Text style={styles.shareBtnText}>Share to Instagram Stories</Text>
            </View>
          )}
        </Pressable>

        <Pressable style={styles.shareBtnSecondary} disabled={isSharing} onPress={handleShareOther}>
          <View style={styles.shareBtnContent}>
            <SymbolView name="square.and.arrow.up" size={18} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
            <Text style={styles.shareBtnSecondaryText}>Message, WhatsApp, Email…</Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { flex: 1, alignItems: 'center', padding: Spacing.four, paddingTop: Spacing.three },
    hint: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 16,
      marginBottom: 18,
      paddingHorizontal: 20,
    },
    shareBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 28,
      alignItems: 'center',
      alignSelf: 'stretch',
    },
    shareBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
    shareBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    shareBtnSecondary: {
      borderWidth: 1.5,
      borderColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      paddingHorizontal: 28,
      alignItems: 'center',
      alignSelf: 'stretch',
      marginTop: 10,
    },
    shareBtnSecondaryText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
  });
}
