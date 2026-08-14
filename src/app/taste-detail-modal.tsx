import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useTasteDetail } from '@/features/follows/api';
import { compatColor, compatEmoji, compatLabel } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';

const TYPE_LABELS: Record<string, string> = {
  watch: '🎬 Film & TV',
  read: '📚 Books',
  listen: '🎵 Music',
  play: '🎮 Games',
};

function ScoreBar({ label, value, max, color, styles }: {
  label: string; value: number; max: number; color: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.barValue, { color }]}>{Math.round(value)}/{max}</Text>
    </View>
  );
}

function SectionHeader({ title, styles }: { title: string; styles: ReturnType<typeof createStyles> }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function TitleChip({ title, rating, color, styles }: {
  title: string; rating?: number; color: string; styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={[styles.chip, { borderColor: color + '40' }]}>
      <Text style={styles.chipTitle} numberOfLines={1}>{title}</Text>
      {rating != null ? <Text style={[styles.chipRating, { color }]}>★ {rating.toFixed(1)}</Text> : null}
    </View>
  );
}

export default function TasteDetailModal() {
  const { friendId } = useLocalSearchParams<{ friendId: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data, isLoading } = useTasteDetail(friendId ?? null);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" />
          </Pressable>
        </View>
        <ActivityIndicator color={Brand.trust} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" />
          </Pressable>
        </View>
        <View style={styles.empty}><Text style={styles.emptyText}>No data available.</Text></View>
      </SafeAreaView>
    );
  }

  const { profile, detail } = data;
  const name = profile.full_name || profile.username || 'Friend';
  const color = compatColor(detail.total);
  const { label } = compatLabel(detail.total);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
        <Text style={styles.headerTitle}>Taste Match</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Hero: avatar + score */}
        <View style={styles.hero}>
          <Avatar name={name} size={64} avatarUrl={profile.avatar_url} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroName} numberOfLines={1}>{name}</Text>
            {profile.username ? <Text style={styles.heroHandle}>@{profile.username}</Text> : null}
            <View style={[styles.heroPill, { backgroundColor: color + '18' }]}>
              <Text style={[styles.heroPillText, { color }]}>
                {compatEmoji(detail.total)} {detail.total}% — {label}
              </Text>
            </View>
          </View>
          <View style={[styles.scoreBadge, { backgroundColor: color }]}>
            <Text style={styles.scoreBadgeNum}>{detail.total}</Text>
            <Text style={styles.scoreBadgePct}>%</Text>
          </View>
        </View>

        {/* Score breakdown */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score Breakdown</Text>
          <ScoreBar label="Titles in common" value={detail.titleScore} max={25} color={color} styles={styles} />
          <ScoreBar label="Media mix" value={detail.typeScore} max={20} color={color} styles={styles} />
          <ScoreBar label="Rating alignment" value={detail.ratingScore} max={10} color={color} styles={styles} />
          <ScoreBar label="Platforms" value={detail.networkScore} max={5} color={color} styles={styles} />
          <View style={styles.baseRow}>
            <Text style={styles.baseLabel}>Base score</Text>
            <Text style={[styles.baseValue, { color: Brand.muted }]}>+40</Text>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color }]}>{detail.sharedCount}</Text>
            <Text style={styles.statLabel}>Titles in common</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxMid]}>
            <Text style={[styles.statNum, { color }]}>{detail.bothLoved.length}</Text>
            <Text style={styles.statLabel}>Both loved</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color }]}>{detail.sharedTypes.length}</Text>
            <Text style={styles.statLabel}>Shared media types</Text>
          </View>
        </View>

        {/* Both loved */}
        {detail.bothLoved.length > 0 && (
          <>
            <SectionHeader title="❤️ You both loved" styles={styles} />
            <View style={styles.chipRow}>
              {detail.bothLoved.slice(0, 8).map((item) => (
                <TitleChip
                  key={item.title}
                  title={item.title}
                  rating={(item.myRating + item.theirRating) / 2}
                  color={color}
                  styles={styles}
                />
              ))}
            </View>
          </>
        )}

        {/* They'd probably recommend */}
        {detail.theyLove.length > 0 && (
          <>
            <SectionHeader title={`🎯 ${name.split(' ')[0]} loves — you haven't tried`} styles={styles} />
            <View style={styles.chipRow}>
              {detail.theyLove.slice(0, 8).map((item) => (
                <TitleChip key={item.title} title={item.title} rating={item.rating} color={color} styles={styles} />
              ))}
            </View>
          </>
        )}

        {/* Your recs for them */}
        {detail.youLove.length > 0 && (
          <>
            <SectionHeader title="💌 Your picks they haven't seen" styles={styles} />
            <View style={styles.chipRow}>
              {detail.youLove.slice(0, 8).map((item) => (
                <TitleChip key={item.title} title={item.title} rating={item.rating} color={color} styles={styles} />
              ))}
            </View>
          </>
        )}

        {/* Shared media types */}
        {detail.sharedTypes.length > 0 && (
          <>
            <SectionHeader title="📡 Shared media types" styles={styles} />
            <View style={styles.chipRow}>
              {detail.sharedTypes.map((t) => (
                <View key={t} style={[styles.chip, { borderColor: color + '40' }]}>
                  <Text style={styles.chipTitle}>{TYPE_LABELS[t] ?? t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    content: { paddingHorizontal: Spacing.three, paddingTop: 20 },

    // Hero
    hero: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 20,
    },
    heroInfo: { flex: 1, minWidth: 0 },
    heroName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink },
    heroHandle: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginBottom: 6 },
    heroPill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    heroPillText: { fontFamily: BrandFonts.syneBold, fontSize: 12 },
    scoreBadge: {
      width: 56, height: 56, borderRadius: 28,
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'row', gap: 1,
    },
    scoreBadgeNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: '#fff' },
    scoreBadgePct: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#ffffffCC', paddingTop: 4 },

    // Card
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      gap: 10,
    },
    cardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 },

    // Score bars
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    barLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, width: 120 },
    barTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: Brand.border, overflow: 'hidden' },
    barFill: { height: 6, borderRadius: 3 },
    barValue: { fontFamily: BrandFonts.syneBold, fontSize: 11, width: 32, textAlign: 'right' },
    baseRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4, borderTopWidth: 1, borderTopColor: Brand.border },
    baseLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    baseValue: { fontFamily: BrandFonts.syneBold, fontSize: 12 },

    // Stats
    statsRow: {
      flexDirection: 'row',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      marginBottom: 24,
      overflow: 'hidden',
    },
    statBox: { flex: 1, alignItems: 'center', paddingVertical: 14 },
    statBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: Brand.border },
    statNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22 },
    statLabel: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, textAlign: 'center', marginTop: 2 },

    // Sections
    sectionHeader: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
      marginBottom: 10,
    },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1,
      backgroundColor: Brand.card,
      maxWidth: '100%',
    },
    chipTitle: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.ink, flexShrink: 1 },
    chipRating: { fontFamily: BrandFonts.syneBold, fontSize: 11 },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
  });
}
