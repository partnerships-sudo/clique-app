'use client';

import { useState } from 'react';
import { useNewsArticles, useNowPlaying, useUpcoming, useBoxOffice, type NewsFilter, type NewsArticle, type CinemaMovie, type BoxOfficeEntry } from '@web/lib/news';

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatRevenue(n: number) {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${Math.round(n / 1_000)}K`;
}

function formatReleaseDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Category filter bar ───────────────────────────────────────────────────────

const FILTERS: { id: NewsFilter; label: string; emoji: string }[] = [
  { id: 'all',     label: 'All',       emoji: '🌐' },
  { id: 'watch',   label: 'TV & Film', emoji: '🎬' },
  { id: 'read',    label: 'Books',     emoji: '📚' },
  { id: 'play',    label: 'Games',     emoji: '🎮' },
  { id: 'listen',  label: 'Music',     emoji: '🎵' },
  { id: 'podcast', label: 'Podcasts',  emoji: '🎙️' },
];

// ── Article card components ───────────────────────────────────────────────────

function TrendingCard({ article, rank }: { article: NewsArticle; rank: number }) {
  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flexShrink: 0, width: 148 }}>
      <div style={{ position: 'relative', height: 192, borderRadius: 14, overflow: 'hidden', background: 'var(--border)', marginBottom: 9 }}>
        {article.thumbnail
          ? <img src={article.thumbnail} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>📰</div>}
        {/* Dark gradient at bottom */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)' }} />
        {/* Rank number */}
        <div style={{
          position: 'absolute', top: 10, left: 12,
          fontSize: 30, fontWeight: 900, color: '#fff',
          textShadow: '0 1px 6px rgba(0,0,0,0.5)', lineHeight: 1,
        }}>{rank}</div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.35, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {article.title}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--trust)', letterSpacing: 0.7, textTransform: 'uppercase' }}>
        {article.section}
      </div>
    </a>
  );
}

function FeatureCard({ article }: { article: NewsArticle }) {
  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block', position: 'relative', height: 240, borderRadius: 18, overflow: 'hidden', background: 'var(--border)', marginBottom: 12 }}>
      {article.thumbnail
        ? <img src={article.thumbnail} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        : <div style={{ width: '100%', height: '100%', background: 'var(--tlight)' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--trust)', letterSpacing: 0.7, textTransform: 'uppercase' }}>{article.section}</span>
          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)' }}>· {timeAgo(article.publishedAt)}</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.title}
        </div>
      </div>
    </a>
  );
}

function GridCard({ article }: { article: NewsArticle }) {
  return (
    <a href={article.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', flex: 1, minWidth: 0, borderRadius: 14, overflow: 'hidden', background: 'var(--card)', border: '1px solid var(--border)' }}>
      <div style={{ aspectRatio: '16/9', background: 'var(--border)', overflow: 'hidden' }}>
        {article.thumbnail
          ? <img src={article.thumbnail} alt={article.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>📰</div>}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--trust)', letterSpacing: 0.6, textTransform: 'uppercase' }}>{article.section}</span>
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>· {timeAgo(article.publishedAt)}</span>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {article.title}
        </div>
      </div>
    </a>
  );
}

// ── Headlines tab ─────────────────────────────────────────────────────────────

function HeadlinesTab({ filter }: { filter: NewsFilter }) {
  const { data: articles = [], isLoading, isError } = useNewsArticles(filter);
  const trending = articles.slice(0, 10);
  const topStories = articles.slice(10);

  if (isLoading) return (
    <div>
      {/* Skeleton trending */}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 28 }}>
        {[1,2,3,4].map((i) => (
          <div key={i} style={{ flexShrink: 0, width: 148 }}>
            <div style={{ height: 192, borderRadius: 14, background: 'var(--border)', marginBottom: 9 }} />
            <div style={{ height: 13, width: '85%', background: 'var(--border)', borderRadius: 5, marginBottom: 5 }} />
            <div style={{ height: 10, width: '40%', background: 'var(--border)', borderRadius: 4 }} />
          </div>
        ))}
      </div>
      {/* Skeleton feature */}
      <div style={{ height: 240, borderRadius: 18, background: 'var(--border)', marginBottom: 12 }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1, height: 180, borderRadius: 14, background: 'var(--border)' }} />
        <div style={{ flex: 1, height: 180, borderRadius: 14, background: 'var(--border)' }} />
      </div>
    </div>
  );

  if (isError || articles.length === 0) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      {isError ? "Couldn't load stories — try again shortly." : 'No stories found right now.'}
    </div>
  );

  return (
    <div>
      {/* Trending Now */}
      {trending.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14, letterSpacing: -0.3 }}>Trending Now</div>
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
            {trending.map((a, i) => <TrendingCard key={a.id} article={a} rank={i + 1} />)}
          </div>
        </div>
      )}

      {/* Top Stories — alternating feature + 2-col grid */}
      {topStories.length > 0 && (
        <div>
          <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14, letterSpacing: -0.3 }}>Top Stories</div>
          {(() => {
            const rows: React.ReactElement[] = [];
            let i = 0;
            while (i < topStories.length) {
              if (i % 3 === 0) {
                rows.push(<FeatureCard key={topStories[i].id} article={topStories[i]} />);
                i += 1;
              } else {
                const pair = topStories.slice(i, i + 2);
                rows.push(
                  <div key={`pair-${i}`} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                    {pair.map((a) => <GridCard key={a.id} article={a} />)}
                  </div>
                );
                i += 2;
              }
            }
            return rows;
          })()}
        </div>
      )}
    </div>
  );
}

// ── Cinema tab ────────────────────────────────────────────────────────────────

function MoviePosterCard({ movie, showDate }: { movie: CinemaMovie; showDate?: boolean }) {
  return (
    <div style={{ flexShrink: 0, width: 104, cursor: 'default' }}>
      <div style={{ width: 104, height: 156, borderRadius: 12, overflow: 'hidden', background: 'var(--border)', marginBottom: 7, border: '1px solid var(--border)' }}>
        {movie.poster
          ? <img src={movie.poster} alt={movie.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🎬</div>}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {movie.title}
      </div>
      {showDate && (
        <div style={{ fontSize: 10.5, color: 'var(--trust)', fontWeight: 700 }}>
          {formatReleaseDate(movie.releaseDate)}
        </div>
      )}
    </div>
  );
}

function CinemaTab() {
  const { data: nowPlaying = [], isLoading: loadingNow } = useNowPlaying();
  const { data: upcoming = [], isLoading: loadingUpcoming } = useUpcoming();
  const { data: boxOffice = [], isLoading: loadingBO } = useBoxOffice();

  const maxRevenue = boxOffice[0] ? Math.max(...boxOffice.map((e) => e.revenue)) : 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* In cinemas now */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14, letterSpacing: -0.3 }}>In cinemas now</div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {loadingNow
            ? [1,2,3,4].map((i) => <div key={i} style={{ flexShrink: 0, width: 104, height: 156, borderRadius: 12, background: 'var(--border)' }} />)
            : nowPlaying.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing found right now.</div>
              : nowPlaying.map((m) => <MoviePosterCard key={m.id} movie={m} />)}
        </div>
      </div>

      {/* Coming soon */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14, letterSpacing: -0.3 }}>Coming soon</div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
          {loadingUpcoming
            ? [1,2,3,4].map((i) => <div key={i} style={{ flexShrink: 0, width: 104, height: 156, borderRadius: 12, background: 'var(--border)' }} />)
            : upcoming.length === 0
              ? <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nothing found right now.</div>
              : upcoming.map((m) => <MoviePosterCard key={m.id} movie={m} showDate />)}
        </div>
      </div>

      {/* Box Office Top 10 */}
      <div>
        <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', marginBottom: 14, letterSpacing: -0.3 }}>Box Office Top 10</div>
        {loadingBO
          ? [1,2,3,4,5].map((i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
                <div style={{ width: 24, height: 16, background: 'var(--border)', borderRadius: 4 }} />
                <div style={{ width: 38, height: 54, borderRadius: 6, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 14, width: '60%', background: 'var(--border)', borderRadius: 4, marginBottom: 6 }} />
                  <div style={{ height: 11, width: '40%', background: 'var(--border)', borderRadius: 4 }} />
                </div>
              </div>
            ))
          : boxOffice.map((entry, i) => (
              <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--border)', width: 26, textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ width: 38, height: 54, borderRadius: 6, overflow: 'hidden', background: 'var(--border)', flexShrink: 0 }}>
                  {entry.poster && <img src={entry.poster} alt={entry.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', flex: 1 }}>
                      {entry.title}
                    </div>
                    {entry.weeksInTheater === 1 && (
                      <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--trust)', color: '#fff', borderRadius: 4, padding: '1px 5px', letterSpacing: 0.5, flexShrink: 0 }}>NEW</span>
                    )}
                    {entry.revenue > 0 && (
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--trust)', flexShrink: 0 }}>{formatRevenue(entry.revenue)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 5 }}>
                    {entry.weeksInTheater === 1 ? 'New this week' : `Week ${entry.weeksInTheater}`}
                  </div>
                  {/* Revenue bar */}
                  <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2, background: 'var(--trust)',
                      width: `${Math.round((entry.revenue / maxRevenue) * 100)}%`,
                    }} />
                  </div>
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Mode = 'headlines' | 'cinema';

export default function NewsPage() {
  const [mode, setMode] = useState<Mode>('headlines');
  const [filter, setFilter] = useState<NewsFilter>('all');

  return (
    <div>
      {/* Header */}
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: -0.4 }}>News</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 18px', lineHeight: 1.5 }}>
        {mode === 'cinema'
          ? 'In cinemas, coming soon, and topping the box office'
          : "What's happening in film, TV, books, games, and music"}
      </p>

      {/* Headlines / Cinema mode tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
        {(['headlines', 'cinema'] as Mode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 18px 10px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            color: mode === m ? 'var(--ink)' : 'var(--muted)',
            borderBottom: mode === m ? '2.5px solid var(--trust)' : '2.5px solid transparent',
            marginBottom: -1, transition: 'color 0.15s',
            textTransform: 'capitalize',
          }}>
            {m === 'headlines' ? '📰 Headlines' : '🎬 Cinema'}
          </button>
        ))}
      </div>

      {/* Category filter chips (Headlines only) */}
      {mode === 'headlines' && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, marginBottom: 20, scrollbarWidth: 'none' }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)} style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                flexShrink: 0, padding: '4px 6px',
              }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                  background: active ? 'var(--trust)' : 'var(--card)',
                  border: `1.5px solid ${active ? 'var(--trust)' : 'var(--border)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, transition: 'all 0.15s',
                  boxShadow: active ? '0 4px 12px rgba(99,91,255,0.25)' : '0 2px 6px rgba(0,0,0,0.06)',
                }}>
                  {f.emoji}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500, color: active ? 'var(--trust)' : 'var(--muted)' }}>
                  {f.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      {mode === 'headlines' && <HeadlinesTab filter={filter} />}
      {mode === 'cinema' && <CinemaTab />}
    </div>
  );
}
