import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeTile } from '@/components/badges/badge-tile';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBadges, useBadgesForUser, useFeaturedBadges, useUpdateFeaturedBadges, type EvaluatedBadge } from '@/features/badges/api';
import { BADGE_CATEGORIES, TIER_COLORS } from '@/features/badges/catalog';
import { useBrand } from '@/hooks/use-brand';

const MAX_FEATURED = 3;

export default function AchievementsModal() {
  const params = useLocalSearchParams<{ userId?: string; name?: string }>();
  const isOwnProfile = !params.userId;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const own = useBadges();
  const friend = useBadgesForUser(params.userId);
  const { badges, isLoading } = isOwnProfile ? own : friend;
  const featuredKeys = useFeaturedBadges();
  const updateFeatured = useUpdateFeaturedBadges();

  const [selected, setSelected] = useState<EvaluatedBadge | null>(null);

  useEffect(() => {
    if (isOwnProfile) own.syncNewlyEarned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [own.newlyEarned.join(',')]);

  const earnedCount = badges.filter((b) => b.earned).length;
  const isFeatured = selected ? featuredKeys.includes(selected.key) : false;

  function toggleFeatured(badge: EvaluatedBadge) {
    const current = featuredKeys;
    if (current.includes(badge.key)) {
      updateFeatured.mutate(current.filter((k) => k !== badge.key));
      return;
    }
    if (current.length >= MAX_FEATURED) {
      Alert.alert('3 badges max', 'You can only feature 3 badges on your profile. Remove one first.');
      return;
    }
    updateFeatured.mutate([...current, badge.key]);
  }

  return (
    <>
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header} collapsable={false}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backBtn}>‹ Back</Text>
          </Pressable>
          <Text style={styles.title}>{isOwnProfile ? 'Achievements' : `${params.name ?? 'Their'} Achievements`}</Text>
          <View style={{ width: 44 }} />
        </View>
        {!isLoading ? (
          <Text style={styles.summary}>{earnedCount} / {badges.length} earned</Text>
        ) : null}
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
      ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            {BADGE_CATEGORIES.map((category) => {
              const inCategory = badges.filter((b) => b.category === category);
              if (!inCategory.length) return null;
              return (
                <View key={category} style={styles.categorySection}>
                  <Text style={styles.categoryLabel}>{category}</Text>
                  <View style={styles.grid}>
                    {inCategory.map((badge) => (
                      <BadgeTile
                        key={badge.key}
                        badge={badge}
                        earned={badge.earned}
                        progress={badge.progress}
                        onPress={() => setSelected(badge)}
                      />
                    ))}
                  </View>
                </View>
              );
            })}
          </ScrollView>
      )}
    </SafeAreaView>

    <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
      {selected ? (
        <Pressable style={styles.overlay} onPress={() => setSelected(null)}>
          <Pressable style={styles.detailCard} onPress={() => {}}>
            <View
              style={[
                styles.detailCircle,
                { backgroundColor: TIER_COLORS[selected.tier] + (selected.earned ? '33' : '1A') },
                selected.earned && { borderColor: TIER_COLORS[selected.tier], borderWidth: 2.5 },
              ]}>
              <Text style={[styles.detailIcon, { opacity: selected.earned ? 1 : 0.35 }]}>{selected.icon}</Text>
            </View>
            <Text style={styles.detailName}>{selected.name}</Text>
            <View style={[styles.tierPill, { backgroundColor: TIER_COLORS[selected.tier] + '26' }]}>
              <Text style={[styles.tierPillText, { color: TIER_COLORS[selected.tier] }]}>{selected.tier}</Text>
            </View>
            <Text style={styles.detailFlavor}>&ldquo;{selected.flavor}&rdquo;</Text>
            <Text style={styles.detailCriteria}>{selected.criteriaLabel}</Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (selected.progress / selected.target) * 100)}%` },
                  selected.earned && { backgroundColor: TIER_COLORS[selected.tier] },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {selected.earned ? 'Earned!' : `${selected.progress} / ${selected.target}`}
            </Text>

            {isOwnProfile && selected.earned ? (
              <Pressable style={styles.featureBtn} onPress={() => toggleFeatured(selected)}>
                <Text style={styles.featureBtnText}>{isFeatured ? '★ Featured on profile' : '☆ Feature on profile'}</Text>
              </Pressable>
            ) : null}

            <Pressable style={styles.closeBtn} onPress={() => setSelected(null)} hitSlop={8}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 44 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink },
    summary: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.5,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 10,
    },
    content: { padding: Spacing.three, paddingBottom: Spacing.six },
    categorySection: { marginBottom: 22 },
    categoryLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 12.5,
      color: Brand.ink,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 12,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },

    overlay: {
      position: 'absolute',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    detailCard: {
      backgroundColor: Brand.card,
      borderRadius: 24,
      padding: 26,
      alignItems: 'center',
      width: '100%',
      maxWidth: 320,
    },
    detailCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    detailIcon: { fontSize: 38 },
    detailName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 19, color: Brand.ink, textAlign: 'center' },
    tierPill: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 10, marginTop: 8 },
    tierPillText: { fontFamily: BrandFonts.syneBold, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.6 },
    detailFlavor: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 12.8,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: 12,
    },
    detailCriteria: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.8,
      color: Brand.ink,
      textAlign: 'center',
      marginTop: 8,
    },
    progressTrack: {
      width: '100%',
      height: 8,
      borderRadius: 4,
      backgroundColor: Brand.border,
      overflow: 'hidden',
      marginTop: 16,
    },
    progressFill: { height: '100%', borderRadius: 4, backgroundColor: Brand.trust },
    progressText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11.5,
      color: Brand.muted,
      marginTop: 6,
    },
    featureBtn: {
      marginTop: 18,
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 20,
      alignSelf: 'stretch',
      alignItems: 'center',
    },
    featureBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
    closeBtn: { marginTop: 14 },
    closeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
  });
}
