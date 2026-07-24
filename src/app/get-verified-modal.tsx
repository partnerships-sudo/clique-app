import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStripeIdentity } from '@stripe/stripe-react-native';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { VerifiedBadge } from '@/components/verified-badge';
import { useBrand } from '@/hooks/use-brand';
import { useProfile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

async function fetchClientSecret(): Promise<{ clientSecret: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await supabase.functions.invoke('create-verification-session', {
    headers: { Authorization: `Bearer ${session?.access_token}` },
  });
  if (res.error) throw res.error;
  return { clientSecret: res.data.clientSecret };
}

export default function GetVerifiedModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile } = useProfile();

  const { status, present, loading } = useStripeIdentity(
    useCallback(fetchClientSecret, []),
  );

  const alreadyVerified = (profile?.verified_tier ?? 0) >= 1;
  const submitted = status === 'FlowCompleted';
  const cancelled = status === 'FlowCanceled';
  const failed = status === 'FlowFailed';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="xmark" size={18} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>

        {/* Badge preview */}
        <View style={styles.badgePreview}>
          <View style={styles.badgeRow}>
            <Text style={styles.previewName}>Your Name</Text>
            <VerifiedBadge tier={1} size={22} />
          </View>
          <Text style={styles.previewHandle}>@yourhandle</Text>
        </View>

        <Text style={styles.title}>Get Verified on Clique</Text>
        <Text style={styles.subtitle}>
          Verify your identity to receive the blue checkmark — a signal to others that your account is authentic.
        </Text>

        <View style={styles.points}>
          {[
            { icon: 'checkmark.seal.fill', text: 'Blue checkmark on your profile and posts' },
            { icon: 'person.fill.checkmark', text: 'Confirmed as a real, unique person' },
            { icon: 'lock.shield.fill', text: 'ID verified securely by Stripe — Clique never sees your documents' },
          ].map(({ icon, text }) => (
            <View key={icon} style={styles.point}>
              <SymbolView name={icon} size={20} tintColor={Brand.trust} type="monochrome" />
              <Text style={styles.pointText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* State-dependent bottom section */}
        {alreadyVerified ? (
          <View style={styles.successBox}>
            <VerifiedBadge tier={1} size={20} />
            <Text style={styles.successText}>You're already verified.</Text>
          </View>
        ) : submitted ? (
          <View style={styles.successBox}>
            <SymbolView name="clock.fill" size={20} tintColor="#22C55E" type="monochrome" />
            <Text style={styles.successText}>
              Verification submitted! Your checkmark will appear once Stripe confirms your identity — usually within a few minutes.
            </Text>
          </View>
        ) : (
          <>
            {failed && (
              <Text style={styles.errorText}>
                Verification couldn't be completed. Please try again or use a different document.
              </Text>
            )}
            {cancelled && (
              <Text style={styles.errorText}>Verification was cancelled. Tap below to try again.</Text>
            )}
            <Pressable
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={present}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>
                  {cancelled || failed ? 'Try Again' : 'Start Verification'}
                </Text>
              )}
            </Pressable>
            <Text style={styles.disclaimer}>
              You'll be asked to take a photo of a government-issued ID and a selfie. Powered by Stripe Identity.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.one,
    },
    content: {
      paddingHorizontal: Spacing.three,
      paddingBottom: 40,
      alignItems: 'center',
    },
    badgePreview: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      width: '100%',
      marginBottom: Spacing.three,
      marginTop: Spacing.two,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    previewName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink },
    previewHandle: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.ink,
      textAlign: 'center',
      marginBottom: 10,
    },
    subtitle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: Spacing.three,
    },
    points: { width: '100%', gap: 14, marginBottom: Spacing.three },
    point: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
    pointText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      flex: 1,
      lineHeight: 20,
    },
    btn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      width: '100%',
      marginBottom: 14,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
    disclaimer: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 17,
    },
    successBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: Brand.card,
      borderRadius: 12,
      padding: 14,
      width: '100%',
    },
    successText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      flex: 1,
      lineHeight: 20,
    },
    errorText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: '#E05252',
      textAlign: 'center',
      marginBottom: 14,
      lineHeight: 18,
    },
  });
}
