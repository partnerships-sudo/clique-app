'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import Link from 'next/link';

const supabase = createClient();

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return fmtDate(iso);
}

// ── Tier hook ──────────────────────────────────────────────────────────────────

function useTier() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-analytics-tier', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('verified_tier')
        .eq('id', user!.id)
        .single();
      return (data?.verified_tier ?? 0) as number;
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
}

// ── Watch party list ───────────────────────────────────────────────────────────

function useMyWatchParties(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-analytics-wp-list', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premieres')
        .select('id, show_title, status, created_at, live_started_at, ended_at, peak_viewer_count, cover_image')
        .eq('host_user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── Screening room list ────────────────────────────────────────────────────────

function useMyScreeningRooms(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-analytics-sr-list', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_rooms')
        .select('id, title, status, created_at, live_started_at, ended_at, peak_viewer_count, cover_image')
        .eq('host_user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── Detail analytics: Watch Party ──────────────────────────────────────────────

function useWPDetail(premiereId: string | null) {
  return useQuery({
    queryKey: ['web-analytics-wp-detail', premiereId],
    queryFn: async () => {
      const [premiereRes, membersRes, messagesRes, replayRes, sharesRes, buyClicksRes] = await Promise.all([
        supabase.from('premieres').select('*, host_user_id').eq('id', premiereId!).single(),
        supabase.from('premiere_members').select('user_id, joined_at, left_at, watch_ms, rsvp_status').eq('premiere_id', premiereId!),
        supabase.from('premiere_messages').select('created_at, content, user_name, user_id').eq('premiere_id', premiereId!).order('created_at', { ascending: true }),
        supabase.from('premiere_replay_views').select('user_id', { count: 'exact', head: true }).eq('premiere_id', premiereId!),
        supabase.from('premiere_shares').select('user_id', { count: 'exact', head: true }).eq('premiere_id', premiereId!),
        supabase.from('premiere_buy_clicks').select('user_id', { count: 'exact', head: true }).eq('premiere_id', premiereId!),
      ]);
      if (premiereRes.error) throw premiereRes.error;

      const premiere = premiereRes.data as any;
      const members = (membersRes.data ?? []) as any[];
      const messages = (messagesRes.data ?? []) as any[];
      const replayViews = replayRes.count ?? 0;
      const totalShares = sharesRes.count ?? 0;
      const buyClicks = buyClicksRes.count ?? 0;
      const totalViewers = members.length;
      const buyCtr = totalViewers > 0 ? Math.round((buyClicks / totalViewers) * 100) : null;
      const totalMessages = messages.length;
      const peakViewerCount = premiere.peak_viewer_count ?? totalViewers;

      const watchTimes = members.map((m: any) => m.watch_ms).filter((ms: any): ms is number => ms != null);
      const avgWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a: number, b: number) => a + b, 0) / watchTimes.length : null;
      const totalWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a: number, b: number) => a + b, 0) : null;

      const start = premiere.live_started_at ? new Date(premiere.live_started_at).getTime() : null;
      const end = premiere.ended_at ? new Date(premiere.ended_at).getTime() : null;
      const durationMs = start && end ? end - start : null;
      const engagementRate = totalViewers > 0 ? +(totalMessages / totalViewers).toFixed(1) : null;

      const lateThresholdMs = 2 * 60 * 1000;
      const joinedLate = start ? members.filter((m: any) => m.joined_at && new Date(m.joined_at).getTime() > start + lateThresholdMs).length : 0;
      const joinedLatePct = totalViewers > 0 ? Math.round((joinedLate / totalViewers) * 100) : null;

      const uniqueChatters = new Set(messages.map((m: any) => m.user_id)).size;
      const lurkers = totalViewers - uniqueChatters;
      const lurkPct = totalViewers > 0 ? Math.round((lurkers / totalViewers) * 100) : null;

      const msgByUser = new Map<string, { name: string; count: number }>();
      for (const m of messages) {
        if (m.user_id === premiere.host_user_id) continue;
        const prev = msgByUser.get(m.user_id) ?? { name: m.user_name, count: 0 };
        msgByUser.set(m.user_id, { name: m.user_name, count: prev.count + 1 });
      }
      const topContributors = [...msgByUser.values()].sort((a, b) => b.count - a.count).slice(0, 5);
      const firstMsgMs = messages.length > 0 && start ? new Date(messages[0].created_at).getTime() - start : null;

      const invited = members.filter((m: any) => m.rsvp_status === 'invited').length;
      const rsvpdAttending = members.filter((m: any) => m.rsvp_status === 'attending' || m.rsvp_status === 'maybe').length;
      const actuallyJoined = members.filter((m: any) => m.joined_at != null).length;
      const noShows = Math.max(0, rsvpdAttending - actuallyJoined);
      const inviteConversionPct = invited > 0
        ? Math.round((actuallyJoined / (invited + rsvpdAttending)) * 100)
        : rsvpdAttending > 0 ? Math.round((actuallyJoined / rsvpdAttending) * 100) : null;

      // Chat activity buckets (5-min intervals)
      const messageBuckets: { label: string; count: number }[] = [];
      if (messages.length > 0 && start) {
        const bucketMs = 5 * 60_000;
        const bucketCount = durationMs ? Math.ceil(durationMs / bucketMs) : 24;
        for (let i = 0; i < Math.min(bucketCount, 36); i++) {
          const bucketStart = start + i * bucketMs;
          const bucketEnd = bucketStart + bucketMs;
          const count = messages.filter((m: any) => {
            const t = new Date(m.created_at).getTime();
            return t >= bucketStart && t < bucketEnd;
          }).length;
          const mins = i * 5;
          messageBuckets.push({ label: mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`, count });
        }
      }

      // Retention curve
      const retentionCurve: { label: string; pct: number }[] = [];
      if (members.length > 0 && start && durationMs) {
        const bucketMs = 5 * 60_000;
        const bucketCount = Math.ceil(durationMs / bucketMs);
        for (let i = 0; i < Math.min(bucketCount, 24); i++) {
          const t = start + i * bucketMs;
          const present = members.filter((m: any) => {
            const joined = m.joined_at ? new Date(m.joined_at).getTime() : null;
            const left = m.left_at ? new Date(m.left_at).getTime() : null;
            return joined != null && joined <= t && (left == null || left > t);
          }).length;
          const pct = Math.round((present / Math.max(totalViewers, 1)) * 100);
          const mins = i * 5;
          retentionCurve.push({ label: mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`, pct });
        }
      }

      return {
        premiere, totalViewers, peakViewerCount, replayViews, totalShares, buyClicks, buyCtr,
        totalMessages, durationMs, avgWatchMs, totalWatchMs, engagementRate,
        joinedLate, joinedLatePct, uniqueChatters, lurkPct, topContributors,
        firstMsgMs, invited, rsvpdAttending, noShows, inviteConversionPct,
        messageBuckets, retentionCurve,
      };
    },
    enabled: !!premiereId,
    staleTime: 2 * 60_000,
  });
}

// ── Detail analytics: Screening Room ──────────────────────────────────────────

function useSRDetail(roomId: string | null) {
  return useQuery({
    queryKey: ['web-analytics-sr-detail', roomId],
    queryFn: async () => {
      const [roomRes, membersRes, messagesRes, sharesRes] = await Promise.all([
        supabase.from('screening_rooms').select('*').eq('id', roomId!).single(),
        supabase.from('screening_room_members').select('user_id, joined_at, left_at, watch_ms').eq('room_id', roomId!),
        supabase.from('screening_room_messages').select('created_at, user_id, user_name').eq('room_id', roomId!).order('created_at', { ascending: true }),
        supabase.from('screening_room_shares').select('user_id', { count: 'exact', head: true }).eq('room_id', roomId!),
      ]);
      if (roomRes.error) throw roomRes.error;

      const room = roomRes.data as any;
      const members = (membersRes.data ?? []) as any[];
      const messages = (messagesRes.data ?? []) as any[];
      const totalShares = sharesRes.count ?? 0;
      const totalViewers = members.length;
      const totalMessages = messages.length;
      const peakViewerCount = room.peak_viewer_count ?? totalViewers;

      const watchTimes = members.map((m: any) => m.watch_ms).filter((ms: any): ms is number => ms != null);
      const avgWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a: number, b: number) => a + b, 0) / watchTimes.length : null;
      const totalWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a: number, b: number) => a + b, 0) : null;

      const start = room.live_started_at ? new Date(room.live_started_at).getTime() : null;
      const end = room.ended_at ? new Date(room.ended_at).getTime() : null;
      const durationMs = start && end ? end - start : null;
      const engagementRate = totalViewers > 0 ? +(totalMessages / totalViewers).toFixed(1) : null;

      const uniqueChatters = new Set(messages.map((m: any) => m.user_id)).size;
      const lurkPct = totalViewers > 0 ? Math.round(((totalViewers - uniqueChatters) / totalViewers) * 100) : null;

      const msgByUser = new Map<string, { name: string; count: number }>();
      for (const m of messages) {
        const prev = msgByUser.get(m.user_id) ?? { name: m.user_name, count: 0 };
        msgByUser.set(m.user_id, { name: m.user_name, count: prev.count + 1 });
      }
      const topContributors = [...msgByUser.values()].sort((a, b) => b.count - a.count).slice(0, 5);

      const messageBuckets: { label: string; count: number }[] = [];
      if (messages.length > 0 && start) {
        const bucketMs = 5 * 60_000;
        const bucketCount = durationMs ? Math.ceil(durationMs / bucketMs) : 24;
        for (let i = 0; i < Math.min(bucketCount, 36); i++) {
          const bucketStart = start + i * bucketMs;
          const bucketEnd = bucketStart + bucketMs;
          const count = messages.filter((m: any) => {
            const t = new Date(m.created_at).getTime();
            return t >= bucketStart && t < bucketEnd;
          }).length;
          const mins = i * 5;
          messageBuckets.push({ label: mins >= 60 ? `${Math.floor(mins / 60)}h` : `${mins}m`, count });
        }
      }

      return {
        room, totalViewers, peakViewerCount, totalShares, totalMessages,
        durationMs, avgWatchMs, totalWatchMs, engagementRate,
        uniqueChatters, lurkPct, topContributors, messageBuckets,
      };
    },
    enabled: !!roomId,
    staleTime: 2 * 60_000,
  });
}

// ── UI building blocks ─────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 4,
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', letterSpacing: -0.5 }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', opacity: 0.75 }}>{sub}</div>}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 800, letterSpacing: 1.4,
      textTransform: 'uppercase', color: 'var(--muted)',
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

function StatGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
      {children}
    </div>
  );
}

function BarChart({ buckets, color }: { buckets: { label: string; count: number }[]; color: string }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
      {buckets.map((b, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, height: '100%' }}>
          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <div style={{
              width: '100%',
              height: `${Math.max(Math.round((b.count / max) * 100), b.count > 0 ? 4 : 0)}%`,
              background: color, borderRadius: 3,
              minHeight: b.count > 0 ? 2 : 0,
              transition: 'height 0.3s ease',
            }} />
          </div>
          {i % Math.ceil(buckets.length / 8) === 0 && (
            <div style={{ fontSize: 9, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{b.label}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: 16, marginBottom: 14,
    }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>{sub}</div>}
      {children}
    </div>
  );
}

function RankRow({ rank, label, value }: { rank: number; label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 0', borderTop: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--muted)', width: 22, flexShrink: 0 }}>#{rank}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', flex: 1 }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{value}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cfg = status === 'live'
    ? { bg: '#22C55E', text: '● Live' }
    : status === 'ended'
    ? { bg: '#6B7280', text: 'Ended' }
    : { bg: '#F59E0B', text: 'Scheduled' };
  return (
    <span style={{
      background: cfg.bg + '22', color: cfg.bg,
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      border: `1px solid ${cfg.bg}44`,
    }}>
      {cfg.text}
    </span>
  );
}

// ── Watch Party detail panel ───────────────────────────────────────────────────

function WatchPartyDetail({ premiereId }: { premiereId: string }) {
  const { data, isLoading } = useWPDetail(premiereId);

  if (isLoading) return <LoadingPanel />;
  if (!data) return <EmptyPanel msg="No data available." />;

  const { premiere, totalViewers, peakViewerCount, replayViews, totalShares, buyClicks, buyCtr,
    totalMessages, durationMs, avgWatchMs, totalWatchMs, engagementRate,
    joinedLate, joinedLatePct, uniqueChatters, lurkPct, topContributors,
    firstMsgMs, invited, rsvpdAttending, noShows, inviteConversionPct,
    messageBuckets, retentionCurve } = data;

  return (
    <div>
      {/* Viewership */}
      <SectionLabel>Viewership</SectionLabel>
      <StatGrid>
        <StatCard label="Total Viewers" value={String(totalViewers)} color="#5B8DEF" />
        <StatCard label="Peak Viewers" value={String(peakViewerCount)} color="#8B5CF6" />
        <StatCard label="Replay Views" value={String(replayViews)} sub="unique viewers" color="#64748B" />
        {joinedLatePct != null && (
          <StatCard label="Joined Late" value={`${joinedLatePct}%`} sub={`${joinedLate} viewers`} color="#F59E0B" />
        )}
      </StatGrid>

      {/* RSVP */}
      {(invited > 0 || rsvpdAttending > 0) && (
        <>
          <SectionLabel>RSVP & Invite Conversion</SectionLabel>
          <StatGrid>
            {invited > 0 && <StatCard label="Invited" value={String(invited)} sub="sent an invite" color="#6366F1" />}
            {rsvpdAttending > 0 && <StatCard label="RSVP'd Going" value={String(rsvpdAttending)} color="#22C55E" />}
            {noShows > 0 && <StatCard label="No-Shows" value={String(noShows)} sub="RSVP'd but didn't join" color="#EF4444" />}
            {inviteConversionPct != null && <StatCard label="Conversion" value={`${inviteConversionPct}%`} sub="invited → joined" color="#D4AF37" />}
          </StatGrid>
        </>
      )}

      {/* Watch time */}
      <SectionLabel>Watch Time</SectionLabel>
      <StatGrid>
        {durationMs != null && <StatCard label="Duration" value={fmt(durationMs)} color="#22C55E" />}
        {avgWatchMs != null && <StatCard label="Avg Watch Time" value={fmt(avgWatchMs)} color="#06B6D4" />}
        {totalWatchMs != null && <StatCard label="Total Watch Time" value={fmt(totalWatchMs)} sub="across all viewers" color="#F97316" />}
      </StatGrid>

      {/* Growth */}
      <SectionLabel>Growth & Discovery</SectionLabel>
      <StatGrid>
        <StatCard label="Shares" value={String(totalShares)} sub="times shared externally" color="#EC4899" />
        {buyClicks > 0 && <StatCard label="Buy / Rent Clicks" value={String(buyClicks)} sub={buyCtr != null ? `${buyCtr}% of viewers` : undefined} color="#10B981" />}
      </StatGrid>

      {/* Chat */}
      <SectionLabel>Chat & Engagement</SectionLabel>
      <StatGrid>
        <StatCard label="Messages" value={String(totalMessages)} color="#D4AF37" />
        <StatCard label="Active Chatters" value={String(uniqueChatters)} sub={lurkPct != null ? `${lurkPct}% lurked` : undefined} color="#EC4899" />
        {engagementRate != null && <StatCard label="Engagement" value={`${engagementRate}x`} sub="msgs per viewer" color="#EF4444" />}
        {firstMsgMs != null && <StatCard label="First Message" value={fmt(Math.max(0, firstMsgMs))} sub="into the party" color="#6366F1" />}
      </StatGrid>

      {/* Top contributors */}
      {topContributors.length > 0 && (
        <ChartCard title="⭐ Top Contributors" sub="Most active viewers in chat (excluding host)">
          {topContributors.map((c, i) => (
            <RankRow key={i} rank={i + 1} label={c.name} value={`${c.count} msgs`} />
          ))}
        </ChartCard>
      )}

      {/* Chat activity chart */}
      {messageBuckets.length > 0 && (
        <ChartCard title="Chat Activity" sub="Messages per 5-minute interval">
          <BarChart buckets={messageBuckets} color="var(--trust)" />
        </ChartCard>
      )}

      {/* Retention curve */}
      {retentionCurve.length > 0 && (
        <ChartCard title="Viewer Retention" sub="% of viewers still present per interval">
          <BarChart buckets={retentionCurve.map((b) => ({ label: b.label, count: b.pct }))} color="#8B5CF6" />
        </ChartCard>
      )}
    </div>
  );
}

// ── Screening Room detail panel ────────────────────────────────────────────────

function ScreeningRoomDetail({ roomId }: { roomId: string }) {
  const { data, isLoading } = useSRDetail(roomId);

  if (isLoading) return <LoadingPanel />;
  if (!data) return <EmptyPanel msg="No data available." />;

  const { totalViewers, peakViewerCount, totalShares, totalMessages, durationMs,
    avgWatchMs, totalWatchMs, engagementRate, uniqueChatters, lurkPct,
    topContributors, messageBuckets } = data;

  return (
    <div>
      <SectionLabel>Viewership</SectionLabel>
      <StatGrid>
        <StatCard label="Total Viewers" value={String(totalViewers)} color="#5B8DEF" />
        <StatCard label="Peak Viewers" value={String(peakViewerCount)} color="#8B5CF6" />
      </StatGrid>

      <SectionLabel>Watch Time</SectionLabel>
      <StatGrid>
        {durationMs != null && <StatCard label="Duration" value={fmt(durationMs)} color="#22C55E" />}
        {avgWatchMs != null && <StatCard label="Avg Watch Time" value={fmt(avgWatchMs)} color="#06B6D4" />}
        {totalWatchMs != null && <StatCard label="Total Watch Time" value={fmt(totalWatchMs)} sub="across all viewers" color="#F97316" />}
      </StatGrid>

      <SectionLabel>Growth & Discovery</SectionLabel>
      <StatGrid>
        <StatCard label="Shares" value={String(totalShares)} color="#EC4899" />
      </StatGrid>

      <SectionLabel>Chat & Engagement</SectionLabel>
      <StatGrid>
        <StatCard label="Messages" value={String(totalMessages)} color="#D4AF37" />
        <StatCard label="Active Chatters" value={String(uniqueChatters)} sub={lurkPct != null ? `${lurkPct}% lurked` : undefined} color="#EC4899" />
        {engagementRate != null && <StatCard label="Engagement" value={`${engagementRate}x`} sub="msgs per viewer" color="#EF4444" />}
      </StatGrid>

      {topContributors.length > 0 && (
        <ChartCard title="⭐ Top Viewers" sub="Most active in chat">
          {topContributors.map((c, i) => (
            <RankRow key={i} rank={i + 1} label={c.name} value={`${c.count} msgs`} />
          ))}
        </ChartCard>
      )}

      {messageBuckets.length > 0 && (
        <ChartCard title="Chat Activity" sub="Messages per 5-minute interval">
          <BarChart buckets={messageBuckets} color="#8B5CF6" />
        </ChartCard>
      )}
    </div>
  );
}

// ── Event row ──────────────────────────────────────────────────────────────────

function EventRow({
  id, title, sub, status, date, peakViewers, poster,
  selected, onSelect, children,
}: {
  id: string; title: string; sub: string; status: string; date: string;
  peakViewers: number | null; poster: string | null;
  selected: boolean; onSelect: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--card)', border: `1px solid ${selected ? 'var(--trust)' : 'var(--border)'}`,
      borderRadius: 16, overflow: 'hidden',
      transition: 'border-color 0.15s',
    }}>
      {/* Header row */}
      <button
        onClick={onSelect}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        {/* Poster thumbnail */}
        <div style={{
          width: 44, height: 66, borderRadius: 8, flexShrink: 0,
          background: 'var(--tlight)', border: '1px solid var(--border)', overflow: 'hidden',
        }}>
          {poster && <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{sub}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status={status} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{fmtRelative(date)}</span>
            {peakViewers != null && peakViewers > 0 && (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>· {peakViewers} peak viewers</span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <span style={{
          fontSize: 16, color: 'var(--muted)', flexShrink: 0,
          transform: selected ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>›</span>
      </button>

      {/* Expanded analytics */}
      {selected && (
        <div style={{ padding: '0 16px 20px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: 16 }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function LoadingPanel() {
  return (
    <div style={{ padding: '20px 0', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{ height: 80, borderRadius: 12, background: 'var(--border)', opacity: 0.5 }} />
      ))}
    </div>
  );
}

function EmptyPanel({ msg }: { msg: string }) {
  return <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 13, color: 'var(--muted)' }}>{msg}</div>;
}

function UpgradeGate() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: 340, gap: 16, padding: 40, textAlign: 'center',
    }}>
      <div style={{ fontSize: 48 }}>📊</div>
      <h2 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>
        Analytics is a premium feature
      </h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, lineHeight: 1.6, margin: 0 }}>
        Upgrade to <strong>Tier 2</strong> to unlock Watch Party analytics. Screening Room analytics requires <strong>Tier 3</strong>.
      </p>
      <Link
        href="/settings"
        style={{
          background: 'var(--trust)', color: '#fff', padding: '12px 28px',
          borderRadius: 12, fontWeight: 700, fontSize: 14, textDecoration: 'none',
        }}
      >
        Upgrade now →
      </Link>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user } = useSession();
  const { data: tier, isLoading: tierLoading } = useTier();
  const [tab, setTab] = useState<'watchparty' | 'screeningroom'>('watchparty');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: watchParties = [], isLoading: wpLoading } = useMyWatchParties(
    tier != null && tier >= 2 ? user?.id : undefined,
  );
  const { data: screeningRooms = [], isLoading: srLoading } = useMyScreeningRooms(
    tier != null && tier >= 3 ? user?.id : undefined,
  );

  if (tierLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--trust)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  // Tier 1 or below — gate the whole page
  if (tier == null || tier < 2) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>Analytics</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px' }}>Your event performance data</p>
        <UpgradeGate />
      </div>
    );
  }

  const hasSR = tier >= 3;

  const handleSelect = (id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>Analytics</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Your event performance data</p>
      </div>

      {/* Tab switcher (only show if tier 3+) */}
      {hasSR && (
        <div style={{
          display: 'flex', background: 'var(--card)',
          borderRadius: 12, padding: 4, marginBottom: 20,
          border: '1px solid var(--border)', width: 'fit-content',
        }}>
          {[
            { id: 'watchparty', label: '🎬 Watch Parties' },
            { id: 'screeningroom', label: '🎥 Screening Rooms' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id as any); setSelectedId(null); }}
              style={{
                padding: '7px 18px', borderRadius: 9,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 700,
                background: tab === t.id ? 'var(--trust)' : 'transparent',
                color: tab === t.id ? '#fff' : 'var(--muted)',
                transition: 'all 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Watch Parties tab */}
      {tab === 'watchparty' && (
        <div>
          {!hasSR && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 16, padding: '10px 14px',
              background: 'var(--tlight)', borderRadius: 10, border: '1px solid var(--trust)',
              fontSize: 12, color: 'var(--trust)', fontWeight: 600,
            }}>
              🎬 Watch Party Analytics · Tier 2+
              <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 'auto' }}>
                Upgrade to Tier 3 to unlock Screening Room Analytics
              </span>
            </div>
          )}

          {wpLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 90, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', opacity: 0.6 }} />
              ))}
            </div>
          ) : watchParties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
              You haven't hosted any Watch Parties yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(watchParties as any[]).map((wp) => (
                <EventRow
                  key={wp.id}
                  id={wp.id}
                  title={wp.show_title ?? 'Untitled'}
                  sub="Watch Party"
                  status={wp.status ?? 'ended'}
                  date={wp.created_at}
                  peakViewers={wp.peak_viewer_count}
                  poster={wp.cover_image}
                  selected={selectedId === wp.id}
                  onSelect={() => handleSelect(wp.id)}
                >
                  <WatchPartyDetail premiereId={wp.id} />
                </EventRow>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Screening Rooms tab */}
      {tab === 'screeningroom' && hasSR && (
        <div>
          {srLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 90, borderRadius: 16, background: 'var(--card)', border: '1px solid var(--border)', opacity: 0.6 }} />
              ))}
            </div>
          ) : screeningRooms.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
              You haven't hosted any Screening Rooms yet.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(screeningRooms as any[]).map((sr) => (
                <EventRow
                  key={sr.id}
                  id={sr.id}
                  title={sr.title ?? 'Untitled'}
                  sub="Screening Room"
                  status={sr.status ?? 'ended'}
                  date={sr.created_at}
                  peakViewers={sr.peak_viewer_count}
                  poster={sr.cover_image}
                  selected={selectedId === sr.id}
                  onSelect={() => handleSelect(sr.id)}
                >
                  <ScreeningRoomDetail roomId={sr.id} />
                </EventRow>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
