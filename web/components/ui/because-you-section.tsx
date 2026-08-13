'use client';

import { useBecauseYou } from '@web/lib/because-you';
import type { RecItem, BecauseYouRow } from '@web/lib/because-you';

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', read: '📚', listen: '🎵', podcast: '🎙️', play: '🎮',
};

function PosterCard({ item }: { item: RecItem }) {
  const emoji = TYPE_EMOJI[item.type] ?? '📌';

  return (
    <div style={{
      flexShrink: 0, width: 90, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'default',
    }}>
      <div style={{
        width: 90, height: 135, borderRadius: 10, overflow: 'hidden',
        background: 'var(--border)', position: 'relative',
        border: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {item.poster ? (
          <img
            src={item.poster}
            alt={item.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="lazy"
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--section, var(--border))',
            fontSize: 28,
          }}>
            {emoji}
          </div>
        )}
      </div>
      <div style={{
        fontSize: 11.5, fontWeight: 600, color: 'var(--ink)',
        lineHeight: 1.35, maxWidth: 90,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
      }}>
        {item.title}
      </div>
      {item.sub && (
        <div style={{
          fontSize: 10.5, color: 'var(--muted)', lineHeight: 1.3,
          maxWidth: 90,
          display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>
          {item.sub}
        </div>
      )}
    </div>
  );
}

function Row({ row }: { row: BecauseYouRow }) {
  const seedShort = row.seedTitle.length > 28
    ? row.seedTitle.slice(0, 27) + '…'
    : row.seedTitle;

  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 12, lineHeight: 1.4 }}>
        Because you {row.verb}{' '}
        <span style={{ color: 'var(--trust)' }}>{seedShort}</span>
      </div>
      <div style={{
        display: 'flex', gap: 12, overflowX: 'auto',
        paddingBottom: 6, scrollbarWidth: 'none',
      }}>
        {row.items.map((item, i) => (
          <PosterCard key={`${item.type}:${item.title}:${i}`} item={item} />
        ))}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ height: 16, width: 200, background: 'var(--border)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 12 }}>
        {[1,2,3,4,5].map((i) => (
          <div key={i} style={{ flexShrink: 0 }}>
            <div style={{ width: 90, height: 135, borderRadius: 10, background: 'var(--border)' }} />
            <div style={{ height: 11, width: 70, background: 'var(--border)', borderRadius: 4, marginTop: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function BecauseYouSection() {
  const { data: rows, isLoading } = useBecauseYou();

  if (isLoading) {
    return (
      <>
        <SkeletonRow />
        <SkeletonRow />
      </>
    );
  }

  if (!rows?.length) return null;

  return (
    <>
      {rows.map((row) => (
        <Row key={`${row.type}:${row.seedTitle}`} row={row} />
      ))}
    </>
  );
}
