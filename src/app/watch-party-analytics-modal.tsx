import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useWatchPartyAnalytics } from '@/features/premieres/api';
import { useBrand } from '@/hooks/use-brand';

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function WatchPartyAnalyticsModal() {
  const { premiereId, showTitle } = useLocalSearchParams<{ premiereId: string; showTitle: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data, isLoading } = useWatchPartyAnalytics(premiereId ?? null);

  const barMax = data ? Math.max(...data.messageBuckets.map((b) => b.count), 1) : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{showTitle ?? 'Analytics'}</Text>
          <Text style={styles.headerSub}>Watch Party</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Brand.trust} />
      ) : !data ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No data available.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Status pill */}
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: data.premiere.status === 'ended' ? '#6B7280' : data.premiere.status === 'live' ? '#22C55E' : '#F59E0B' }]}>
              <Text style={styles.statusText}>
                {data.premiere.status === 'ended' ? 'Ended' : data.premiere.status === 'live' ? '● Live' : 'Waiting'}
              </Text>
            </View>
            <Text style={styles.dateText}>
              {new Date(data.premiere.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          {/* Stat cards — 6-up grid */}
          <View style={styles.grid}>
            <StatCard label="Total Viewers" value={String(data.totalViewers)} icon="person.2.fill" color="#5B8DEF" Brand={Brand} styles={styles} />
            <StatCard label="Peak Viewers" value={String(data.peakViewerCount)} icon="chart.line.uptrend.xyaxis" color="#8B5CF6" Brand={Brand} styles={styles} />
            <StatCard label="Messages" value={String(data.totalMessages)} icon="bubble.left.fill" color="#D4AF37" Brand={Brand} styles={styles} />
            <StatCard
              label="Duration"
              value={data.durationMs ? formatDuration(data.durationMs) : '—'}
              icon="clock.fill"
              color="#22C55E"
              Brand={Brand}
              styles={styles}
            />
            <StatCard
              label="Avg Watch Time"
              value={data.avgWatchMs != null ? formatDuration(data.avgWatchMs) : '—'}
              icon="timer"
              color="#06B6D4"
              Brand={Brand}
              styles={styles}
            />
            <StatCard
              label="Total Watch Time"
              value={data.totalWatchMs != null ? formatDuration(data.totalWatchMs) : '—'}
              icon="clock.badge.fill"
              color="#F97316"
              Brand={Brand}
              styles={styles}
              sub="across all viewers"
            />
          </View>

          {/* Engagement */}
          {data.engagementRate != null && (
            <View style={styles.engagementCard}>
              <SymbolView name="heart.fill" size={16} tintColor="#EF4444" type="monochrome" />
              <Text style={styles.engagementText}>
                <Text style={styles.engagementBold}>{data.engagementRate.toFixed(1)}x</Text> engagement — {data.engagementRate.toFixed(1)} messages per viewer
              </Text>
            </View>
          )}

          {/* Chat activity chart */}
          {data.messageBuckets.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>Chat Activity</Text>
              <Text style={styles.sectionSub}>Messages per 5-minute interval</Text>
              <View style={styles.chart}>
                {data.messageBuckets.map((b, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${Math.round((b.count / barMax) * 100)}%`, backgroundColor: Brand.trust },
                        ]}
                      />
                    </View>
                    {i % 3 === 0 && <Text style={styles.barLabel}>{b.label}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Viewer retention curve */}
          {data.retentionCurve.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>Viewer Retention</Text>
              <Text style={styles.sectionSub}>% of viewers still present per interval</Text>
              <View style={styles.chart}>
                {data.retentionCurve.map((b, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${b.pct}%`, backgroundColor: '#8B5CF6' }]} />
                    </View>
                    {i % 3 === 0 && <Text style={styles.barLabel}>{b.label}</Text>}
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Most active moments */}
          {data.topMoments.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>🔥 Most Active Moments</Text>
              <Text style={styles.sectionSub}>Top chat spikes during the watch party</Text>
              {data.topMoments.map((m, i) => (
                <View key={i} style={styles.momentRow}>
                  <Text style={styles.momentRank}>#{i + 1}</Text>
                  <Text style={styles.momentLabel}>{m.label} mark</Text>
                  <Text style={styles.momentCount}>{m.count} msgs</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
  Brand,
  styles,
  sub,
}: {
  label: string;
  value: string;
  icon: SymbolViewProps['name'];
  color: string;
  Brand: BrandPalette;
  styles: ReturnType<typeof createStyles>;
  sub?: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <SymbolView name={icon} size={18} tintColor={color} type="monochrome" />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 1 },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    content: { flexGrow: 1, padding: Spacing.three, paddingBottom: 32 },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: '#fff' },
    dateText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
    statCard: {
      width: '47%',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 14,
      gap: 6,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontFamily: BrandFonts.syneBold, fontSize: 24, color: Brand.ink, marginTop: 4 },
    statLabel: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.muted },
    statSub: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted },

    engagementCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    engagementText: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, flex: 1 },
    engagementBold: { fontFamily: BrandFonts.syneBold, color: Brand.ink },

    chartSection: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
    },
    sectionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 2 },
    sectionSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginBottom: 14 },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 3 },
    barCol: { flex: 1, alignItems: 'center', gap: 3 },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 3, minHeight: 2 },
    barLabel: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted },

    momentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    momentRank: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted, width: 28 },
    momentLabel: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.ink, flex: 1 },
    momentCount: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
  });
}
