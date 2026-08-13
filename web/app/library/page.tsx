'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import { useCurrentProfile } from '@web/lib/feed';
import { ExportModal } from '@web/components/ui/export-modal';
import { ImportModal } from '@web/components/ui/import-modal';
import { useRatingIcon } from '@web/lib/rating-icon';
import { RatingIcons } from '@web/components/ui/rating-icons';

const supabase = createClient();

const TYPE_FILTERS = [
  { id: 'all',     label: 'All' },
  { id: 'watch',   label: '🎬 Watch' },
  { id: 'read',    label: '📚 Read' },
  { id: 'listen',  label: '🎵 Listen' },
  { id: 'podcast', label: '🎙️ Podcast' },
];

const TYPE_EMOJI: Record<string, string> = { watch: '🎬', read: '📚', listen: '🎵', podcast: '🎙️', play: '🎮' };

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 11, color: 'var(--trust)', letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < rating ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

function useLibrary(userId: string | undefined, status: 'logged' | 'watchlist') {
  return useQuery({
    queryKey: ['web-library', userId, status],
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from('library')
        .select('id, type, title, sub, poster, rating, note, status, date, created_at')
        .eq('user_id', userId)
        .eq('status', status)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export default function LibraryPage() {
  const { user } = useSession();
  const { data: profile } = useCurrentProfile();
  const [tab, setTab] = useState<'logged' | 'watchlist'>('logged');
  const [filter, setFilter] = useState('all');
  const [showExport, setShowExport] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: items = [], isLoading } = useLibrary(user?.id, tab);
  const ratingIconStyle = useRatingIcon();

  const filtered = filter === 'all' ? items : items.filter((i: any) => i.type === filter);

  const counts: Record<string, number> = { all: items.length };
  for (const item of items as any[]) {
    counts[item.type] = (counts[item.type] ?? 0) + 1;
  }

  const tier = profile?.verified_tier ?? 0;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>
          Library
        </h1>
        {user && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setShowImport(true)} style={actionBtnStyle}>
              ↓ Import
            </button>
            <button onClick={() => setShowExport(true)} style={actionBtnStyle}>
              ↑ Export
            </button>
          </div>
        )}
      </div>

      {/* Top tabs: Logged vs Watchlist */}
      <div style={{
        display: 'flex', background: 'var(--card)',
        borderRadius: 12, padding: 4, marginBottom: 16,
        border: '1px solid var(--border)', width: 'fit-content',
      }}>
        {(['logged', 'watchlist'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setFilter('all'); }}
            style={{
              padding: '7px 18px', borderRadius: 9,
              border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 700,
              fontFamily: 'inherit',
              background: tab === t ? 'var(--trust)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'logged' ? '✓ Logged' : '🔖 Watchlist'}
          </button>
        ))}
      </div>

      {/* Type filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {TYPE_FILTERS.map((t) => {
          const active = filter === t.id;
          const count = counts[t.id] ?? 0;
          if (t.id !== 'all' && count === 0) return null;
          return (
            <button
              key={t.id}
              onClick={() => setFilter(t.id)}
              style={{
                padding: '6px 14px', borderRadius: 20,
                border: `1px solid ${active ? 'var(--trust)' : 'var(--border)'}`,
                background: active ? 'var(--tlight)' : 'transparent',
                color: active ? 'var(--trust)' : 'var(--muted)',
                fontSize: 13, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {t.label} {count > 0 && <span style={{ opacity: 0.6 }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Loading skeleton */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ aspectRatio: '2/3', borderRadius: 10, background: 'var(--border)' }} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
          {tab === 'logged'
            ? filter === 'all'
              ? 'Nothing logged yet. Hit + Log to start.'
              : `No ${filter} entries yet.`
            : filter === 'all'
              ? 'Your watchlist is empty. Add things you want to watch, read, or listen to.'
              : `No ${filter} items in your watchlist.`}
        </div>
      )}

      {/* Grid */}
      {!isLoading && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 14 }}>
          {(filtered as any[]).map((item) => (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Poster */}
              <div style={{
                aspectRatio: '2/3', borderRadius: 10, overflow: 'hidden',
                background: 'var(--tlight)',
                border: '1px solid var(--border)',
                position: 'relative',
              }}>
                {item.poster ? (
                  <img src={item.poster} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    {TYPE_EMOJI[item.type] ?? '📌'}
                  </div>
                )}
                {/* Rating badge (logged only) */}
                {tab === 'logged' && item.rating != null && (
                  <div style={{
                    position: 'absolute', bottom: 6, left: 6,
                    background: 'rgba(0,0,0,0.65)', borderRadius: 6,
                    padding: '2px 6px', backdropFilter: 'blur(4px)',
                  }}>
                    <RatingIcons rating={item.rating} iconStyle={ratingIconStyle} size={10} color="#FFD700" />
                  </div>
                )}
                {/* Watchlist badge */}
                {tab === 'watchlist' && (
                  <div style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.55)', borderRadius: 6,
                    padding: '2px 6px', backdropFilter: 'blur(4px)',
                    fontSize: 11, color: '#fff', fontWeight: 600,
                  }}>
                    🔖
                  </div>
                )}
              </div>
              {/* Title */}
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                {item.title}
              </div>
              {item.sub && (
                <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {item.sub}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showExport && <ExportModal tier={tier} onClose={() => setShowExport(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = {
  padding: '6px 12px', borderRadius: 10, border: '1px solid var(--border)',
  background: 'var(--paper)', color: 'var(--ink)',
  fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
};
