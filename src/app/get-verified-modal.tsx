import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { VerifiedBadge } from '@/components/verified-badge';
import { useBrand } from '@/hooks/use-brand';
import { useProfile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';
import { purchaseVerified, restorePurchases, isVerifiedEntitled } from '@/features/purchases/api';

const TIERS = [
  {
    id: 1,
    name: 'Verified',
    price: '$2.99',
    period: '/mo',
    color: '#5B8DEF',
    features: [
      'Blue checkmark on your profile and posts',
      'Confirmed as a real, unique person',
      'ID verified securely by Stripe',
    ],
  },
  {
    id: 2,
    name: 'Power',
    price: '$4.99',
    period: '/mo',
    color: '#8B5CF6',
    features: [
      'Everything in Verified',
      'Advanced stats & yearly wrapped',
      'Custom lists & collections',
      'Export your library',
      'Read receipts on recommendations',
    ],
    comingSoon: true,
  },
  {
    id: 3,
    name: 'Taste Maker',
    price: '$9.99',
    period: '/mo',
    color: '#D4AF37',
    features: [
      'Everything in Power',
      'Shareable public profile link',
      'Watch parties',
      'Full taste compatibility breakdown',
      'Ad-free experience',
      'Early access to new features',
    ],
    comingSoon: true,
  },
] as const;

export default function GetVerifiedModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile, refetch: refetchProfile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3>(1);

  const alreadyVerified = (profile?.verified_tier ?? 0) >= 1;
  const tier = TIERS.find((t) => t.id === selectedTier)!;

  async function startVerification() {
    setLoading(true);
    setError(null);
    try {
      const customerInfo = await purchaseVerified();
      if (!isVerifiedEntitled(customerInfo)) {
        throw new Error('Subscription not active. Please try again.');
      }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke('create-verification-session', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (res.error) {
        let message = res.error.message ?? 'Unknown error';
        try {
          const body = await (res.error as any).context?.json?.();
          if (body?.error) message = body.error;
          else if (body?.raw?.message) message = body.raw.message;
        } catch {}
        throw new Error(message);
      }
      const { url } = res.data as { clientSecret: string; url: string };
      if (!url) throw new Error('No verification URL returned');
      await WebBrowser.openBrowserAsync(url);
      await refetchProfile();
      setSubmitted(true);
    } catch (e: any) {
      if (e?.code === 'PURCHASE_CANCELLED') return;
      setError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore() {
    setLoading(true);
    setError(null);
    try {
      const customerInfo = await restorePurchases();
      if (isVerifiedEntitled(customerInfo)) {
        setSuccessMsg('Subscription restored! Tap "Subscribe & Verify" to complete ID verification.');
      } else {
        setError('No active subscription found.');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Restore failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="xmark" size={18} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Clique Membership</Text>
        <Text style={styles.subtitle}>Choose the plan that fits how you use Clique.</Text>

        {/* Tier selector */}
        <View style={styles.tierRow}>
          {TIERS.map((t) => {
            const active = selectedTier === t.id;
            return (
              <Pressable
                key={t.id}
                style={[styles.tierCard, active && { borderColor: t.color, borderWidth: 2 }]}
                onPress={() => setSelectedTier(t.id as 1 | 2 | 3)}>
                <SymbolView name="checkmark.seal.fill" size={20} tintColor={t.color} type="monochrome" />
                <Text style={[styles.tierName, active && { color: t.color }]}>{t.name}</Text>
                <Text style={styles.tierPrice}>
                  {t.price}<Text style={styles.tierPeriod}>{t.period}</Text>
                </Text>
                {'comingSoon' in t && t.comingSoon && (
                  <View style={styles.soonPill}>
                    <Text style={styles.soonText}>Soon</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Badge preview (tier 1 only) */}
        {selectedTier === 1 && (
          <View style={styles.badgePreview}>
            <View style={styles.badgeRow}>
              <Text style={styles.previewName}>Your Name</Text>
              <VerifiedBadge tier={1} size={22} />
            </View>
            <Text style={styles.previewHandle}>@yourhandle</Text>
          </View>
        )}

        {/* Features list */}
        <View style={styles.features}>
          {tier.features.map((text) => (
            <View key={text} style={styles.featureRow}>
              <SymbolView name="checkmark.circle.fill" size={17} tintColor={tier.color} type="monochrome" />
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* CTA */}
        {'comingSoon' in tier && tier.comingSoon ? (
          <View style={[styles.btn, styles.btnDisabled]}>
            <Text style={styles.btnText}>Coming soon</Text>
          </View>
        ) : alreadyVerified ? (
          <View style={styles.successBox}>
            <VerifiedBadge tier={1} size={20} />
            <Text style={styles.successText}>You're already verified.</Text>
          </View>
        ) : submitted ? (
          <View style={styles.successBox}>
            <SymbolView name="clock.fill" size={20} tintColor="#22C55E" type="monochrome" />
            <Text style={styles.successText}>
              Verification opened! Complete it in the browser, then come back. Your checkmark will appear once Stripe confirms your identity — usually within a few minutes.
            </Text>
          </View>
        ) : (
          <>
            {successMsg && <Text style={styles.successMsgText}>{successMsg}</Text>}
            {error && <Text style={styles.errorText}>{error}</Text>}
            <Pressable
              style={[styles.btn, { backgroundColor: tier.color }, loading && styles.btnDisabled]}
              onPress={startVerification}
              disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{error ? 'Try Again' : `Subscribe & Verify — ${tier.price}/mo`}</Text>}
            </Pressable>
            <Text style={styles.disclaimer}>
              {tier.price}/month. Cancel anytime. ID verification powered by Stripe Identity.
            </Text>
            <Pressable onPress={handleRestore} disabled={loading} style={styles.restoreBtn}>
              <Text style={styles.restoreText}>Restore purchases</Text>
            </Pressable>
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
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.ink,
      textAlign: 'center',
      marginBottom: 8,
      marginTop: 4,
    },
    subtitle: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
      textAlign: 'center',
      marginBottom: Spacing.three,
    },

    // Tier cards
    tierRow: { flexDirection: 'row', gap: 8, width: '100%', marginBottom: Spacing.three },
    tierCard: {
      flex: 1,
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 10,
      alignItems: 'center',
      gap: 4,
    },
tierName: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.ink,
      textAlign: 'center',
    },
    tierPrice: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 15,
      color: Brand.ink,
      textAlign: 'center',
    },
    tierPeriod: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 11,
      color: Brand.muted,
    },
    soonPill: {
      backgroundColor: Brand.border,
      borderRadius: 20,
      paddingHorizontal: 6,
      paddingVertical: 2,
      marginTop: 2,
    },
    soonText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },

    // Badge preview
    badgePreview: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      width: '100%',
      marginBottom: Spacing.three,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    previewName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink },
    previewHandle: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },

    // Features
    features: { width: '100%', gap: 12, marginBottom: Spacing.three },
    featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    featureText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.ink,
      flex: 1,
      lineHeight: 20,
    },

    // CTA
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
    successMsgText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: '#22C55E',
      textAlign: 'center',
      marginBottom: 14,
      lineHeight: 18,
    },
    errorText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: '#E05252',
      textAlign: 'center',
      marginBottom: 14,
      lineHeight: 18,
    },
    restoreBtn: { alignItems: 'center', paddingVertical: 8 },
    restoreText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
  });
}
