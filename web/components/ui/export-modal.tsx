'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

// ── Helpers ───────────────────────────────────────────────────────────────────

function escapeCSV(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toDate(iso: string) { return iso.split('T')[0]; }

function buildCSV(items: any[]): string {
  const header = ['Type', 'Title', 'Sub', 'Rating (1–5)', 'Note', 'Status', 'Date', 'Added'];
  const rows = items.map((i) => [i.type, i.title, i.sub ?? '', i.rating ?? '', i.note ?? '', i.status, i.date ?? '', toDate(i.created_at)]);
  return [header, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

function buildLetterboxd(items: any[]): string {
  const movies = items.filter((i) => i.type === 'watch' && i.status !== 'watchlist');
  const header = ['Date', 'Name', 'Year', 'Rating10', 'Rewatch', 'Tags', 'WatchedDate'];
  const rows = movies.map((i) => {
    const d = toDate(i.created_at);
    const year = /^\d{4}$/.test(i.sub ?? '') ? i.sub : '';
    const r10 = i.rating !== null ? String(Math.round(i.rating * 2)) : '';
    return [d, i.title, year, r10, '', '', d];
  });
  return [header, ...rows].map((r) => r.map(escapeCSV).join(',')).join('\n');
}

function buildJSON(items: any[]): string {
  return JSON.stringify(items.map(({ user_id: _uid, ...rest }) => rest), null, 2);
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

function useAllLibraryItems(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-library-export', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('library')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

type Format = 'csv' | 'letterboxd' | 'json';

const FORMATS: { id: Format; emoji: string; label: string; sub: string }[] = [
  { id: 'csv', emoji: '📊', label: 'CSV', sub: 'All logged items — open in Excel, Sheets, or Numbers' },
  { id: 'letterboxd', emoji: '🎬', label: 'Letterboxd CSV', sub: 'Movies & TV only — import at letterboxd.com' },
  { id: 'json', emoji: '{ }', label: 'JSON', sub: 'Every field, raw — for developers and power users' },
];

interface Props {
  tier: number;
  onClose: () => void;
}

export function ExportModal({ tier, onClose }: Props) {
  const { user } = useSession();
  const { data: items = [], isLoading } = useAllLibraryItems(user?.id);
  const [busy, setBusy] = useState<Format | null>(null);
  const [done, setDone] = useState<Format | null>(null);

  async function handleExport(format: Format) {
    if (busy) return;
    setBusy(format);
    try {
      if (format === 'csv') {
        download(buildCSV(items), 'clique-library.csv', 'text/csv');
      } else if (format === 'letterboxd') {
        download(buildLetterboxd(items), 'clique-letterboxd.csv', 'text/csv');
      } else {
        download(buildJSON(items), 'clique-library.json', 'application/json');
      }
      setDone(format);
      setTimeout(() => setDone(null), 3000);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460,
        background: 'var(--card)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />

        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginBottom: 4, letterSpacing: -0.3 }}>
          Export Library
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>
          {isLoading ? 'Loading…' : `${items.length} items ready to export`}
        </div>

        {/* Tier 2 gate */}
        {tier < 2 ? (
          <div style={{
            background: 'var(--tlight)', border: '1px solid var(--trust)',
            borderRadius: 14, padding: '18px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>⭐</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 }}>
              Power membership required
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
              Export your library as CSV, Letterboxd-compatible, or JSON with a Tier 2 membership.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FORMATS.map((fmt) => {
              const isBusy = busy === fmt.id;
              const isDone = done === fmt.id;
              return (
                <button
                  key={fmt.id}
                  onClick={() => handleExport(fmt.id)}
                  disabled={!!busy || isLoading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '14px 16px', borderRadius: 12, border: 'none',
                    background: isDone ? 'var(--tlight)' : 'var(--paper)',
                    cursor: busy ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: isDone ? 'var(--trust)' : 'var(--tlight)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: fmt.id === 'json' ? 12 : 18, fontWeight: 900,
                    color: isDone ? '#fff' : 'var(--trust)',
                  }}>
                    {isBusy ? '⏳' : isDone ? '✓' : fmt.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{fmt.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{fmt.sub}</div>
                  </div>
                  <span style={{ fontSize: 18, color: 'var(--muted)' }}>›</span>
                </button>
              );
            })}
          </div>
        )}

        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center' }}>
          Export includes logged items only — watchlist items are not included.
        </div>
      </div>
    </div>
  );
}
