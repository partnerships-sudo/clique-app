'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from '@web/providers/session-provider';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import {
  useMyTasteAll, compatColor, compatLabel, compatEmoji,
  type MyTasteEntry, type CompatBreakdown,
} from '@web/lib/follows';

const supabase = createClient();

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', read: '📚', play: '🎮', listen: '🎵', podcast: '🎙️', tv: '📺',
};
const TYPE_LABEL: Record<string, string> = {
  watch: 'Movies', read: 'Books', play: 'Games', listen: 'Music', podcast: 'Podcasts', tv: 'TV',
};

// ── Tier gate check ───────────────────────────────────────────────────────────

function useTier() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-my-tier', user?.id],
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

// ── Breakdown panel ───────────────────────────────────────────────────────────

function BreakdownPanel({ bd, color }: { bd: CompatBreakdown; color: string }) {
  const bars: { label: string; score: number; max: number; desc: string }[] = [
    {
      label: 'Shared titles',
      score: bd.titleScore,
      max: 25,
      desc: `${bd.sharedTitles} title${bd.sharedTitles !== 1 ? 's' : ''} in common out of ${Math.min(bd.myLibSize, bd.friendLibSize)}`,
    },
    {
      label: 'Media variety',
      score: bd.typeScore,
      max: 20,
      desc: bd.sharedTypes.length
        ? `Share ${bd.sharedTypes.map((t) => TYPE_LABEL[t] ?? t).join(', ')}`
        : 'No overlapping media types yet',
    },
    {
      label: 'Rating taste',
      score: bd.ratingScore,
      max: 10,
      desc: bd.ratingScore > 0 ? 'Similar star ratings on shared titles' : 'Not enough rated titles in common',
    },
    {
      label: 'Base score',
      score: bd.base,
      max: 40,
      desc: 'Everyone starts here',
    },
  ];

  return (
    <div style={{
      margin: '12px 0 0',
      background: 'var(--paper)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 2 }}>
        Score breakdown
      </div>
      {bars.map((bar) => (
        <div key={bar.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{bar.label}</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: bar.score > 0 ? color : 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
              {bar.score > 0 ? `+${bar.score.toFixed(bar.score % 1 ? 1 : 0)}` : '0'}
              <span style={{ fontWeight: 400, color: 'var(--muted)', fontSize: 11 }}>/{bar.max}</span>
            </span>
          </div>
          <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 3 }}>
            <div style={{
              width: `${(bar.score / bar.max) * 100}%`,
              height: '100%',
              background: bar.label === 'Base score' ? 'var(--border)' : color,
              borderRadius: 3,
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{bar.desc}</div>
        </div>
      ))}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingTop: 10, borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>Total</span>
        <span style={{ fontSize: 18, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
          {bd.total}%
        </span>
      </div>
    </div>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: 50, height: 50, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: 50, height: 50, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function TasteRow({ entry, rank }: { entry: MyTasteEntry; rank: number }) {
  const [open, setOpen] = useState(false);
  const name = entry.full_name || entry.username || 'Someone';
  const color = compatColor(entry.compatibility);

  return (
    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: open ? 16 : 0 }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', cursor: 'pointer' }}
        onClick={() => setOpen((v) => !v)}
      >
        {/* Rank */}
        <span style={{
          width: 26, textAlign: 'right', flexShrink: 0,
          fontSize: 13, fontWeight: 700, color: 'var(--muted)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          #{rank}
        </span>

        <Link href={`/${entry.username}`} onClick={(e) => e.stopPropagation()} style={{ flexShrink: 0 }}>
          <Avatar name={name} avatarUrl={entry.avatar_url} />
        </Link>

        <div style={{ flex: 1, minWidth: 0 }}>
          <Link href={`/${entry.username}`} onClick={(e) => e.stopPropagation()} style={{ textDecoration: 'none' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{name}</div>
            {entry.username && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>@{entry.username}</div>}
          </Link>
          {/* Compat pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            marginTop: 5, padding: '3px 9px', borderRadius: 8,
            background: `${color}18`,
          }}>
            <span style={{ fontSize: 11 }}>{compatEmoji(entry.compatibility)}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color }}>{entry.compatibility}% compatible</span>
          </div>
        </div>

        {/* Score badge + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{
            background: color, color: '#fff',
            borderRadius: 10, padding: '5px 10px',
            fontSize: 13, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
          }}>
            {entry.compatibility}%
          </div>
          <span style={{
            fontSize: 16, color: 'var(--muted)',
            transform: open ? 'rotate(90deg)' : 'none',
            transition: 'transform 0.2s',
            display: 'inline-block',
          }}>›</span>
        </div>
      </div>

      {open && <BreakdownPanel bd={entry.breakdown} color={color} />}
    </div>
  );
}

// ── Upgrade gate ──────────────────────────────────────────────────────────────

function UpgradeGate() {
  return (
    <div style={{
      textAlign: 'center', padding: '48px 24px',
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 20,
    }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>✨</div>
      <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 8, letterSpacing: -0.3 }}>
        Full taste compatibility
      </div>
      <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 320, margin: '0 auto 20px', lineHeight: 1.6 }}>
        See every friend ranked by taste match — with a full score breakdown by title overlap, media variety, and rating alignment.
        Available with a <strong>Taste Maker</strong> membership.
      </p>
      <Link
        href="/settings"
        style={{
          display: 'inline-block', padding: '11px 28px', borderRadius: 20,
          background: 'var(--trust)', color: '#fff',
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
        }}
      >
        Upgrade membership
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyTastePage() {
  const { user } = useSession();
  const { data: tier, isLoading: tierLoading } = useTier();
  const { entries, isLoading: entriesLoading } = useMyTasteAll();

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to see your taste matches.
    </div>
  );

  const isLoading = tierLoading || entriesLoading;

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>
          MyTaste
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
          Everyone you follow, ranked by taste compatibility. Tap any row for the full breakdown.
        </p>
      </div>

      {/* Legend */}
      {!isLoading && entries.length > 0 && tier !== undefined && tier >= 3 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          {[
            { color: '#E84F4F', label: '🔥 Soulmate  90+' },
            { color: '#5B4FE8', label: '✨ TV Twin  75+' },
            { color: '#4F9CE8', label: '👍 Curious  60+' },
            { color: '#9E9E9E', label: '🤔 Exploring' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 26, height: 13, background: 'var(--border)', borderRadius: 4, flexShrink: 0 }} />
              <div style={{ width: 50, height: 50, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, width: '40%', background: 'var(--border)', borderRadius: 5, marginBottom: 6 }} />
                <div style={{ height: 10, width: '25%', background: 'var(--border)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 20, width: 120, background: 'var(--border)', borderRadius: 8 }} />
              </div>
              <div style={{ width: 52, height: 32, background: 'var(--border)', borderRadius: 10 }} />
            </div>
          ))}
        </div>
      ) : tier === undefined || tier < 3 ? (
        <UpgradeGate />
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>No friends yet</div>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>Follow people to see how your taste compares.</p>
        </div>
      ) : (
        <div>
          {entries.map((entry, i) => (
            <TasteRow key={entry.id} entry={entry} rank={i + 1} />
          ))}
          <p style={{ fontSize: 11.5, color: 'var(--muted)', textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
            Scores update as you and your friends log more content. Max 99%.
          </p>
        </div>
      )}
    </div>
  );
}
