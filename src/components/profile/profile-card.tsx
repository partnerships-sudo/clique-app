import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import type { LibraryItem } from '@/features/library/api';
import type { Profile } from '@/features/profile/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const CATEGORY_BARS: { type: EntryType; icon: string; label: string; color: string }[] = [
  { type: 'watch', icon: '📺', label: 'TV', color: '#E84F4F' },
  { type: 'read', icon: '📖', label: 'Books', color: '#4F9CE8' },
  { type: 'play', icon: '🎮', label: 'Games', color: '#4FE87B' },
  { type: 'listen', icon: '🎧', label: 'Music', color: '#E8A84F' },
  { type: 'podcast', icon: '🎙', label: 'Pods', color: '#A855F7' },
];

export function ProfileCard({
  profile,
  library,
  friendsCount,
  interests,
}: {
  profile: Profile | null | undefined;
  library: LibraryItem[];
  friendsCount: number;
  interests: string[];
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const name = profile?.full_name || profile?.username || 'Someone';
  const counts: Record<EntryType, number> = { watch: 0, read: 0, play: 0, listen: 0, podcast: 0 };
  library.forEach((item) => {
    counts[item.type] += 1;
  });
  const max = Math.max(1, ...Object.values(counts));

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={['#5B4FE8', '#E84F9C', '#F4A340']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.bg}
      />
      <View style={styles.avWrap}>
        <Avatar name={name} size={64} avatarUrl={profile?.avatar_url} />
        <View style={styles.onlineDot} />
      </View>
      <Text style={styles.name}>{name}</Text>
      {profile?.username ? <Text style={styles.handle}>@{profile.username}</Text> : null}
      {profile?.location ? <Text style={styles.location}>📍 {profile.location}</Text> : null}
      {profile?.bio ? <Text style={styles.bio}>&ldquo;{profile.bio}&rdquo;</Text> : null}

      {interests.length ? (
        <View style={styles.interests}>
          {interests.map((label) => (
            <View key={label} style={styles.interestTag}>
              <Text style={styles.interestText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statNum}>{library.length}</Text>
          <Text style={styles.statLbl}>Logged</Text>
        </View>
        <View style={styles.statDiv} />
        <View style={styles.stat}>
          <Text style={styles.statNum}>{friendsCount}</Text>
          <Text style={styles.statLbl}>Friends</Text>
        </View>
      </View>

      <Text style={styles.secLbl}>Recently logged</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
        {library.slice(0, 4).map((item) => (
          <View key={item.id} style={styles.recentItem}>
            <Text style={styles.recentIcon}>{TypeColors[item.type].icon}</Text>
            <Text style={styles.recentTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.recentSub}>{item.date}</Text>
          </View>
        ))}
        {!library.length ? <Text style={styles.recentEmpty}>Nothing logged yet.</Text> : null}
      </ScrollView>

      <Text style={styles.secLbl}>Top categories</Text>
      <View style={styles.bars}>
        {CATEGORY_BARS.map((bar) => {
          const pct = Math.round((counts[bar.type] / max) * 100);
          return (
            <View key={bar.type} style={styles.barRow}>
              <Text style={styles.barLbl}>
                {bar.icon} {bar.label}
              </Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: bar.color }]} />
              </View>
              <Text style={styles.barCount}>{counts[bar.type]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: Brand.card,
      borderRadius: 24,
      overflow: 'hidden',
      paddingBottom: 20,
    },
    bg: { height: 90 },
    avWrap: { marginTop: -30, marginLeft: 20, marginBottom: 8 },
    onlineDot: {
      position: 'absolute',
      bottom: 3,
      right: 3,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: '#4FE87B',
      borderWidth: 2.5,
      borderColor: Brand.card,
    },
    name: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 19,
      color: Brand.ink,
      paddingHorizontal: 20,
    },
    handle: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 13,
      color: Brand.trust,
      paddingHorizontal: 20,
      marginTop: 1,
    },
    location: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.8,
      color: Brand.muted,
      paddingHorizontal: 20,
      marginTop: 6,
    },
    bio: {
      fontFamily: BrandFonts.interRegular,
      fontStyle: 'italic',
      fontSize: 13.6,
      color: '#555',
      paddingHorizontal: 20,
      marginTop: 8,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    interests: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      paddingHorizontal: 20,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    interestTag: { backgroundColor: Brand.tlight, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
    interestText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.trust },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    stat: { flex: 1, alignItems: 'center' },
    statNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink },
    statLbl: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 10.5,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    statDiv: { width: 1, height: 32, backgroundColor: Brand.border },
    secLbl: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10.5,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 8,
    },
    recentRow: { gap: 8, paddingHorizontal: 20, paddingBottom: 6 },
    recentItem: {
      backgroundColor: Brand.paper,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 12,
      padding: 10,
      minWidth: 110,
    },
    recentIcon: { fontSize: 17, marginBottom: 5 },
    recentTitle: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink },
    recentSub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginTop: 2 },
    recentEmpty: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12.5,
      color: Brand.muted,
      paddingVertical: 8,
    },
    bars: { paddingHorizontal: 20, paddingBottom: 4, gap: 9 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    barLbl: { fontFamily: BrandFonts.interMedium, fontSize: 12.5, width: 64, color: Brand.ink },
    barTrack: { flex: 1, height: 8, backgroundColor: Brand.border, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    barCount: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, width: 20, textAlign: 'right' },
  });
}
