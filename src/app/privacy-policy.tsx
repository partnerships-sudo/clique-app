import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const SECTIONS = [
  {
    label: 'Collection',
    title: 'Information we collect',
    body: [
      'When you create an account and use Clique, we collect:',
      '- Account information: your name, username, email address, and optional profile photo',
      '- Content you create: posts, reviews, ratings, and library items you add',
      '- Social connections: the people you follow, your friends, and your close friends list',
      '- Device information: push notification token so we can deliver notifications to your device',
      '- Camera and photos: only when you grant permission; used for barcode scanning and setting a profile picture',
      'We do not collect precise location, browsing history outside of Clique, or any financial information.',
    ],
  },
  {
    label: 'Usage',
    title: 'How we use your information',
    body: [
      'Everything we collect serves one purpose: making Clique work for you and your friends.',
      '- Showing your posts and library to people you have chosen to share with',
      '- Sending you notifications about activity from your friends',
      '- Recommending content based on what you and people in your circle have enjoyed',
      '- Keeping your account secure and preventing abuse',
      'We do not sell your personal information to third parties. We do not use your data to serve advertising.',
    ],
  },
  {
    label: 'Third Parties',
    title: 'Services we rely on',
    body: [
      'Clique is built on a small set of trusted infrastructure providers:',
      '- Supabase: our database and authentication provider. Your account data and content is stored on Supabase infrastructure.',
      '- Expo / Apple Push Notification Service: used to deliver push notifications to your device.',
      '- Content APIs: we query third-party databases (such as TMDB for films, IGDB for games, and Spotify for music) to fetch metadata about media titles. We do not share your personal data with these services.',
    ],
  },
  {
    label: 'Sharing',
    title: 'What others can see',
    body: [
      'Clique is a social app, so some of your content is visible to others:',
      '- Posts and reviews are visible to people who follow you',
      '- Close Friends posts are only visible to the people on your Close Friends list',
      '- Your profile (name, username, and avatar) is visible to other Clique users',
      '- Your library is visible to your followers unless you mark items as private',
      'We never share your email address, device token, or any information not described above with other users.',
    ],
  },
  {
    label: 'Retention & Deletion',
    title: 'Your data, your control',
    body: [
      'You can delete your Clique account at any time from Settings > Account Info > Delete Account. When you delete your account, your profile, posts, and library are permanently removed from our systems within 30 days.',
      'You may also contact us directly to request access to, correction of, or deletion of your data.',
    ],
  },
  {
    label: 'Children',
    title: 'Age requirements',
    body: [
      'Clique is not directed at children under 13. We do not knowingly collect personal information from anyone under 13. If you believe a child under 13 has created an account, please contact us and we will remove it promptly.',
    ],
  },
  {
    label: 'Changes',
    title: 'Updates to this policy',
    body: [
      'We may update this Privacy Policy as Clique evolves. When we make meaningful changes, we will update the effective date at the top of this page. Continued use of the app after changes are posted constitutes acceptance of the updated policy.',
    ],
  },
  {
    label: 'GDPR',
    title: 'European users',
    body: [
      'If you are located in the European Union or United Kingdom, the following applies to you under the General Data Protection Regulation (GDPR) and UK GDPR.',
      'Legal basis: We process your personal data on the basis of contract performance (to provide the Clique service you signed up for) and legitimate interests (keeping the service secure and improving it).',
      'Your rights as an EU/UK user:',
      '- Right of access: you can request a copy of the personal data we hold about you',
      '- Right to rectification: you can ask us to correct inaccurate data',
      '- Right to erasure: you can request deletion of your data at any time (Settings > Account Info > Delete Account)',
      '- Right to data portability: you can request your data in a machine-readable format',
      '- Right to object: you can object to processing based on legitimate interests',
      'To exercise any of these rights, contact us at partnerships@vaultedmediagroup.com. We will respond within 30 days.',
    ],
  },
  {
    label: 'Contact',
    title: 'Get in touch',
    body: [
      'Questions about this policy or your data? We are a small team and we read every message.',
      'partnerships@vaultedmediagroup.com',
    ],
  },
];

export default function PrivacyPolicyScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>{'< Back'}</Text>
      </Pressable>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>Legal</Text>
        <Text style={styles.title}>{'Your privacy,\nplainly explained.'}</Text>
        <Text style={styles.intro}>
          Clique is a social app for tracking and sharing the books, films, music, and games you
          love with people you trust. This policy explains what information we collect, why we
          collect it, and how it is used.
        </Text>
        <Text style={styles.effectiveDate}>Effective July 11, 2025</Text>

        {SECTIONS.map((section, i) => (
          <View key={section.label} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNumber}>{String(i + 1).padStart(2, '0')}</Text>
              <View style={styles.sectionMeta}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <Text style={styles.sectionTitle}>{section.title}</Text>
              </View>
            </View>
            {section.body.map((para, j) => (
              <Text key={j} style={styles.para}>
                {para}
              </Text>
            ))}
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>{'(c) ' + new Date().getFullYear() + ' Vaulted Media Group'}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      marginBottom: Spacing.three,
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: Spacing.three, paddingBottom: 60 },
    eyebrow: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: Brand.trust,
      marginBottom: 10,
    },
    title: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 30,
      letterSpacing: -0.5,
      lineHeight: 36,
      color: Brand.ink,
      marginBottom: 14,
    },
    intro: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14.5,
      lineHeight: 22,
      color: Brand.muted,
      marginBottom: 6,
    },
    effectiveDate: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      marginBottom: 32,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      paddingBottom: 32,
    },
    section: {
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      paddingBottom: 28,
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 14,
      marginBottom: 14,
    },
    sectionNumber: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.border,
      letterSpacing: -1,
      lineHeight: 26,
      minWidth: 32,
    },
    sectionMeta: { flex: 1 },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: Brand.trust,
      marginBottom: 4,
    },
    sectionTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      letterSpacing: -0.3,
      color: Brand.ink,
    },
    para: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      lineHeight: 22,
      color: Brand.muted,
      marginBottom: 10,
    },
    footer: { paddingTop: 8, alignItems: 'center' },
    footerText: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
    },
  });
}
