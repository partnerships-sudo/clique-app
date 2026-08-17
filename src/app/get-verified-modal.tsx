import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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
    name: 'Silver',
    price: '$2.99',
    period: '/mo',
    color: '#A8B8C8',
    features: [
      'Silver checkmark on your profile and posts',
      'Confirmed as a real, unique person',
      'ID verified securely by Stripe',
      'Export your library',
      'Shareable public links for your lists',
      'Early access to new features',
    ],
  },
  {
    id: 2,
    name: 'Gold',
    price: '$4.99',
    period: '/mo',
    color: '#D4AF37',
    features: [
      'Everything in Silver',
      'Gold checkmark on your profile and posts',
      'Watch Party analytics dashboard',
      'Your own personal screening room',
      'Early access to new features',
    ],
  },
] as const;

export default function GetVerifiedModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: profile, refetch: refetchProfile } = useProfile();
  const { devPreview } = useLocalSearchParams<{ devPreview?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [selectedTier, setSelectedTier] = useState<1 | 2>(1);

  const alreadyVerified = devPreview === '1' ? false : (profile?.verified_tier ?? 0) >= 1;
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
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <SymbolView name="xmark" size={18} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Clique Membership</Text>
        <Text style={styles.subtitle}>Choose the plan that fits how you use Clique.</Text>

        {/* Tier selector — vertical cards */}
        <View style={styles.tierCol}>
          {TIERS.map((t) => {
            const active = selectedTier === t.id;
            const isGold = t.id === 2;
            return (
              <Pressable
                key={t.id}
                style={[styles.tierCard, active && { borderColor: t.color, borderWidth: 2 }]}
                onPress={() => setSelectedTier(t.id as 1 | 2)}>
                {isGold && (
                  <View style={[styles.popularPill, { backgroundColor: t.color }]}>
                    <Text style={styles.popularText}>MOST POPULAR</Text>
                  </View>
                )}
                <View style={styles.tierCardInner}>
                  <View style={styles.tierCardLeft}>
                    <SymbolView name="checkmark.seal.fill" size={26} tintColor={t.color} type="monochrome" />
                    <View>
                      <Text style={[styles.tierName, active && { color: t.color }]}>{t.name}</Text>
                      <Text style={styles.tierPrice}>
                        {t.price}<Text style={styles.tierPeriod}>{t.period}</Text>
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.tierRadio, active && { borderColor: t.color }]}>
                    {active && <View style={[styles.tierRadioInner, { backgroundColor: t.color }]} />}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Badge preview — uses real profile name */}
        <View style={styles.badgePreview}>
          <View style={styles.badgeAvatarRow}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.previewAvatar} />
            ) : (
              <View style={[styles.previewAvatarFallback, { borderColor: tier.color }]}>
                <Text style={[styles.previewAvatarInitial, { color: tier.color }]}>
                  {(profile?.full_name ?? profile?.username ?? 'Y')[0].toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.badgeRow}>
            <Text style={styles.previewName}>{profile?.full_name ?? profile?.username ?? 'Your Name'}</Text>
            <VerifiedBadge tier={selectedTier} size={22} />
          </View>
          <Text style={styles.previewHandle}>@{profile?.username ?? 'yourhandle'}</Text>
          <Text style={[styles.previewTierLabel, { color: tier.color }]}>{tier.name} Member</Text>
        </View>

        {/* Features list */}
        <View style={styles.features}>
          {tier.features.map((text) => (
            <View key={text} style={styles.featureRow}>
              <SymbolView name="checkmark.circle.fill" size={17} tintColor={tier.color} type="monochrome" />
              <Text style={styles.featureText}>{text}</Text>
            </View>
          ))}
        </View>

        {/* ID verification explainer (Silver only) */}
        {selectedTier === 1 && !alreadyVerified && !submitted && (
          <View style={[styles.infoBox, { borderColor: tier.color + '40', backgroundColor: tier.color + '10' }]}>
            <SymbolView name="person.badge.shield.checkmark" size={18} tintColor={tier.color} type="monochrome" />
            <Text style={[styles.infoText, { color: tier.color }]}>
              After subscribing you'll complete a quick ID check via Stripe — takes about 60 seconds. Your checkmark appears as soon as it's confirmed.
            </Text>
          </View>
        )}

        {/* CTA */}
        {alreadyVerified ? (
          <View style={styles.successBox}>
            <VerifiedBadge tier={profile?.verified_tier ?? 1} size={20} />
            <Text style={styles.successText}>You're already a {profile?.verified_tier === 2 ? 'Gold' : 'Silver'} member.</Text>
          </View>
        ) : submitted ? (
          <View style={styles.successBox}>
            <SymbolView name="clock.fill" size={20} tintColor="#22C55E" type="monochrome" />
            <Text style={styles.successText}>
              ID check opened in your browser — complete it there and come back. Your checkmark usually appears within a few minutes.
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
                : <Text style={styles.btnText}>
                    {error ? 'Try Again' : `Get ${tier.name} — ${tier.price}/mo`}
                  </Text>}
            </Pressable>
            <Text style={styles.disclaimer}>
              {tier.price}/month · Cancel anytime · {selectedTier === 1 ? 'ID verification via Stripe Identity' : 'Includes ID verification'}
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

    // Tier cards — vertical
    tierCol: { width: '100%', gap: 10, marginBottom: Spacing.three },
    tierCard: {
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    tierCardInner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      gap: 12,
    },
    tierCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    popularPill: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      alignItems: 'center',
    },
    popularText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: '#fff',
      letterSpacing: 1,
    },
    tierRadio: {
      width: 20, height: 20, borderRadius: 10,
      borderWidth: 2, borderColor: Brand.border,
      alignItems: 'center', justifyContent: 'center',
    },
    tierRadioInner: { width: 10, height: 10, borderRadius: 5 },
    tierName: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.ink,
    },
    tierPrice: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.muted,
    },
    tierPeriod: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
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
      gap: 4,
    },
    badgeAvatarRow: { marginBottom: 8 },
    previewAvatar: { width: 56, height: 56, borderRadius: 28 },
    previewAvatarFallback: {
      width: 56, height: 56, borderRadius: 28,
      borderWidth: 2, backgroundColor: Brand.tlight,
      alignItems: 'center', justifyContent: 'center',
    },
    previewAvatarInitial: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    previewName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    previewHandle: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },

    // Info box
    infoBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      width: '100%',
      marginBottom: Spacing.two,
    },
    infoText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      flex: 1,
      lineHeight: 19,
    },
    previewTierLabel: { fontFamily: BrandFonts.syneBold, fontSize: 12, marginTop: 6, letterSpacing: 0.5, textTransform: 'uppercase' },

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
