import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useWatchPartyAnalytics } from '@/features/premieres/api';
import { UpgradeGate } from '@/components/upgrade-gate';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

function fmt(ms: number): string {
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
  const { data: profile } = useProfile();
  const tier = profile?.verified_tier ?? 0;
  const { data, isLoading } = useWatchPartyAnalytics(premiereId ?? null);

  const barMax = data ? Math.max(...data.messageBuckets.map((b) => b.count), 1) : 1;
  const histMax = data?.hostEventHistory?.length
    ? Math.max(...data.hostEventHistory.map((e) => e.viewers), 1)
    : 1;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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

      {tier < 2 ? (
        <UpgradeGate
          requiredTier={2}
          currentTier={tier}
          title="Watch Party Analytics"
          description="See who showed up, how long they stayed, peak moments, and chat activity for every watch party you host. Available with a Gold membership."
        />
      ) : isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} color={Brand.trust} />
      ) : !data ? (
        <View style={styles.empty}><Text style={styles.emptyText}>No data available.</Text></View>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Status */}
          <View style={styles.statusRow}>
            <View style={[styles.statusPill, { backgroundColor: data.premiere.status === 'ended' ? '#6B7280' : '#22C55E' }]}>
              <Text style={styles.statusText}>{data.premiere.status === 'ended' ? 'Ended' : '● Live'}</Text>
            </View>
            <Text style={styles.dateText}>
              {data.timeOfDay ? `${data.timeOfDay} · ` : ''}
              {new Date(data.premiere.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </Text>
          </View>

          {/* ── Viewership ── */}
          <Text style={styles.sectionHeader}>Viewership</Text>
          <View style={styles.grid}>
            <StatCard label="Total Viewers" value={String(data.totalViewers)} icon="person.2.fill" color="#5B8DEF" Brand={Brand} styles={styles} />
            <StatCard label="Peak Viewers" value={String(data.peakViewerCount)} icon="chart.line.uptrend.xyaxis" color="#8B5CF6" Brand={Brand} styles={styles} />
            <StatCard
              label="New Viewers"
              value={data.newViewerPct != null ? `${data.newViewerPct}%` : '—'}
              icon="person.badge.plus" color="#22C55E" Brand={Brand} styles={styles}
              sub={data.returningViewers > 0 ? `${data.returningViewers} returning` : 'first event'}
            />
            <StatCard
              label="Joined Late"
              value={data.joinedLatePct != null ? `${data.joinedLatePct}%` : '—'}
              icon="clock.badge.exclamationmark" color="#F59E0B" Brand={Brand} styles={styles}
              sub={data.joinedLate > 0 ? `${data.joinedLate} viewers` : 'all on time'}
            />
            <StatCard label="Replay Views" value={String(data.replayViews)} icon="arrow.counterclockwise.circle.fill" color="#64748B" Brand={Brand} styles={styles} sub="unique viewers" />
          </View>

          {/* ── RSVP & Invite Conversion ── */}
          <Text style={styles.sectionHeader}>RSVP & Invite Conversion</Text>
          <View style={styles.grid}>
            <StatCard
              label="Invited"
              value={String(data.invited)}
              icon="envelope.fill" color="#6366F1" Brand={Brand} styles={styles}
              sub="people sent an invite"
            />
            <StatCard
              label="RSVP'd Going"
              value={String(data.rsvpdAttending)}
              icon="checkmark.circle.fill" color="#22C55E" Brand={Brand} styles={styles}
            />
            <StatCard
              label="No-Shows"
              value={String(Math.max(0, data.noShows))}
              icon="person.fill.xmark" color="#EF4444" Brand={Brand} styles={styles}
              sub="RSVP'd but didn't join"
            />
            <StatCard
              label="Conversion"
              value={data.inviteConversionPct != null ? `${data.inviteConversionPct}%` : '—'}
              icon="arrow.up.right.circle.fill" color="#D4AF37" Brand={Brand} styles={styles}
              sub="invited → joined"
            />
          </View>

          {/* ── Watch Time ── */}
          <Text style={styles.sectionHeader}>Watch Time</Text>
          <View style={styles.grid}>
            <StatCard label="Duration" value={data.durationMs ? fmt(data.durationMs) : '—'} icon="clock.fill" color="#22C55E" Brand={Brand} styles={styles} />
            <StatCard label="Avg Watch Time" value={data.avgWatchMs != null ? fmt(data.avgWatchMs) : '—'} icon="timer" color="#06B6D4" Brand={Brand} styles={styles} />
            <StatCard label="Total Watch Time" value={data.totalWatchMs != null ? fmt(data.totalWatchMs) : '—'} icon="clock.badge.fill" color="#F97316" Brand={Brand} styles={styles} sub="across all viewers" />
          </View>

          {/* ── Growth & Discovery ── */}
          <Text style={styles.sectionHeader}>Growth & Discovery</Text>
          <View style={styles.grid}>
            <StatCard
              label="Shares"
              value={String(data.totalShares)}
              icon="square.and.arrow.up.fill" color="#EC4899" Brand={Brand} styles={styles}
              sub="times shared externally"
            />
            <StatCard
              label="New Followers"
              value={String(data.followsGained)}
              icon="person.crop.circle.badge.plus" color="#8B5CF6" Brand={Brand} styles={styles}
              sub="gained during event window"
            />
            <StatCard
              label="Post-Event Logs"
              value={data.postEventLogPct != null ? `${data.postEventLogPct}%` : '—'}
              icon="star.fill" color="#D4AF37" Brand={Brand} styles={styles}
              sub={data.postEventLogs > 0 ? `${data.postEventLogs} viewers logged it` : 'of viewers logged it'}
            />
            {data.buyClicks > 0 && (
              <StatCard
                label="Buy / Rent Clicks"
                value={String(data.buyClicks)}
                icon="cart.fill" color="#10B981" Brand={Brand} styles={styles}
                sub={data.buyCtr != null ? `${data.buyCtr}% of viewers` : 'total clicks'}
              />
            )}
          </View>

          {/* ── Chat & Engagement ── */}
          <Text style={styles.sectionHeader}>Chat & Engagement</Text>
          <View style={styles.grid}>
            <StatCard label="Messages" value={String(data.totalMessages)} icon="bubble.left.fill" color="#D4AF37" Brand={Brand} styles={styles} />
            <StatCard
              label="Active Chatters"
              value={String(data.uniqueChatters)}
              icon="person.wave.2.fill" color="#EC4899" Brand={Brand} styles={styles}
              sub={data.lurkPct != null ? `${data.lurkPct}% lurked` : undefined}
            />
            <StatCard
              label="Engagement"
              value={data.engagementRate != null ? `${data.engagementRate.toFixed(1)}x` : '—'}
              icon="heart.fill" color="#EF4444" Brand={Brand} styles={styles}
              sub="msgs per viewer"
            />
            {data.firstMsgMs != null && (
              <StatCard
                label="First Message"
                value={fmt(Math.max(0, data.firstMsgMs))}
                icon="message.badge.filled.fill" color="#6366F1" Brand={Brand} styles={styles}
                sub="into the party"
              />
            )}
          </View>

          {/* Top contributors */}
          {data.topContributors.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>⭐ Top Contributors</Text>
              <Text style={styles.sectionSub}>Most active viewers in chat (excluding host)</Text>
              {data.topContributors.map((c, i) => (
                <View key={i} style={styles.momentRow}>
                  <Text style={styles.momentRank}>#{i + 1}</Text>
                  <Text style={styles.momentLabel}>{c.name}</Text>
                  <Text style={styles.momentCount}>{c.count} msgs</Text>
                </View>
              ))}
            </View>
          )}

          {/* Chat activity */}
          {data.messageBuckets.length > 0 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>Chat Activity</Text>
              <Text style={styles.sectionSub}>Messages per 5-minute interval</Text>
              <View style={styles.chart}>
                {data.messageBuckets.map((b, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.round((b.count / barMax) * 100)}%`, backgroundColor: Brand.trust }]} />
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

          {/* Retention curve */}
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

          {/* Host performance trend */}
          {data.hostEventHistory.length > 1 && (
            <View style={styles.chartSection}>
              <Text style={styles.sectionLabel}>📈 Your Watch Party History</Text>
              <Text style={styles.sectionSub}>Peak viewers per event (most recent first)</Text>
              <View style={[styles.chart, { marginTop: 8 }]}>
                {data.hostEventHistory.map((e, i) => (
                  <View key={i} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View style={[styles.bar, { height: `${Math.round((e.viewers / histMax) * 100)}%`, backgroundColor: '#D4AF37' }]} />
                    </View>
                    <Text style={styles.barLabel}>{e.date}</Text>
                  </View>
                ))}
              </View>
              {data.hostEventHistory.length >= 2 && (() => {
                const latest = data.hostEventHistory[0].viewers;
                const prev = data.hostEventHistory[1].viewers;
                const delta = prev > 0 ? Math.round(((latest - prev) / prev) * 100) : null;
                if (delta == null) return null;
                return (
                  <Text style={[styles.sectionSub, { marginTop: 8, marginBottom: 0 }]}>
                    {delta >= 0 ? `↑ ${delta}% vs previous party` : `↓ ${Math.abs(delta)}% vs previous party`}
                  </Text>
                );
              })()}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color, Brand, styles, sub }: {
  label: string; value: string; icon: SymbolViewProps['name'];
  color: string; Brand: BrandPalette; styles: ReturnType<typeof createStyles>; sub?: string;
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
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: Spacing.three, paddingVertical: 14,
      borderBottomWidth: 1, borderBottomColor: Brand.border,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 1 },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    content: { flexGrow: 1, padding: Spacing.three, paddingBottom: 48 },

    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
    statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    statusText: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: '#fff' },
    dateText: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    sectionHeader: {
      fontFamily: BrandFonts.syneExtraBold, fontSize: 11, color: Brand.muted,
      textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10, marginTop: 4,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    statCard: {
      width: '47%', backgroundColor: Brand.card,
      borderWidth: 1, borderColor: Brand.border,
      borderRadius: 16, padding: 14, gap: 6,
    },
    statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    statValue: { fontFamily: BrandFonts.syneBold, fontSize: 24, color: Brand.ink, marginTop: 4 },
    statLabel: { fontFamily: BrandFonts.interMedium, fontSize: 12, color: Brand.muted },
    statSub: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted },

    chartSection: {
      backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border,
      borderRadius: 16, padding: 16, marginBottom: 16,
    },
    sectionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 2 },
    sectionSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginBottom: 14 },
    chart: { flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 3 },
    barCol: { flex: 1, alignItems: 'center', gap: 3 },
    barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderRadius: 3, minHeight: 2 },
    barLabel: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted },

    momentRow: {
      flexDirection: 'row', alignItems: 'center',
      paddingVertical: 8, borderTopWidth: 1, borderTopColor: Brand.border,
    },
    momentRank: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted, width: 28 },
    momentLabel: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.ink, flex: 1 },
    momentCount: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
  });
}
