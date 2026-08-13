'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTmdbDetail, fetchBookDetail, type ContentDetail, type WatchProvider } from '@web/lib/content-detail';
import { useWatchlistKeys, useToggleWatchlist } from '@web/lib/watchlist';
import { useSession } from '@web/providers/session-provider';

// ── Hook ──────────────────────────────────────────────────────────────────────

function useContentDetail(
  type: string,
  title: string,
  externalId: string | null,
  mediaType: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['web-content-detail', type, externalId ?? title],
    queryFn: async (): Promise<ContentDetail> => {
      if (type === 'watch') return fetchTmdbDetail(externalId, title, mediaType);
      if (type === 'read') return fetchBookDetail(externalId, title);
      // listen / podcast — no detail API
      return {
        type: type as any, title, poster: null, backdrop: null, overview: null,
        year: null, rating: null, ratingLabel: null, genres: [], cast: [], providers: [],
        author: null, pageCount: null, publisher: null, categories: [],
        tmdbUrl: null, imdbUrl: null,
      };
    },
    enabled,
    staleTime: 10 * 60_000,
  });
}

// ── Provider badge ────────────────────────────────────────────────────────────

const PROVIDER_SECTION_LABELS: Record<WatchProvider['type'], string> = {
  flatrate: 'Stream',
  free: 'Free',
  rent: 'Rent',
  buy: 'Buy',
};

function ProviderSection({ label, providers }: { label: string; providers: WatchProvider[] }) {
  if (!providers.length) return null;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {providers.map((p) => (
          <div key={p.name} title={p.name} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--paper)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, color: 'var(--ink)',
          }}>
            <img src={p.logo} alt={p.name} style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
            {p.name}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Cast strip ────────────────────────────────────────────────────────────────

function CastStrip({ cast }: { cast: ContentDetail['cast'] }) {
  if (!cast.length) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
        Cast
      </div>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {cast.map((m) => (
          <div key={m.name} style={{ flexShrink: 0, width: 70, textAlign: 'center' }}>
            <div style={{
              width: 58, height: 58, borderRadius: '50%', margin: '0 auto 5px',
              background: 'var(--border)', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: 'var(--muted)',
            }}>
              {m.photo
                ? <img src={m.photo} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : '🎭'}
            </div>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, marginBottom: 2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {m.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {m.character}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

interface Props {
  type: string;
  title: string;
  externalId?: string | null;
  mediaType?: string | null;
  posterFallback?: string | null;
  onClose: () => void;
}

export function ContentDetailModal({ type, title, externalId, mediaType, posterFallback, onClose }: Props) {
  const hasApi = type === 'watch' || type === 'read';
  const { data, isLoading } = useContentDetail(type, title, externalId ?? null, mediaType ?? null, hasApi);
  const { user } = useSession();
  const { data: watchlistKeys } = useWatchlistKeys();
  const toggleWatchlist = useToggleWatchlist();
  const watchlistKey = `${title}::${type}`;
  const watchlistId = watchlistKeys?.get(watchlistKey);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const poster = data?.poster ?? posterFallback ?? null;
  const streamProviders = data?.providers.filter((p) => p.type === 'flatrate') ?? [];
  const freeProviders = data?.providers.filter((p) => p.type === 'free') ?? [];
  const rentProviders = data?.providers.filter((p) => p.type === 'rent') ?? [];
  const buyProviders = data?.providers.filter((p) => p.type === 'buy') ?? [];
  const hasProviders = streamProviders.length + freeProviders.length + rentProviders.length + buyProviders.length > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(0,0,0,0.6)', display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          maxHeight: '90dvh', overflowY: 'auto',
          background: 'var(--card)', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
          position: 'relative',
        }}
      >
        {/* Backdrop */}
        {data?.backdrop && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 160,
            backgroundImage: `url(${data.backdrop})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            borderRadius: '20px 20px 0 0',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, var(--card) 100%)',
              borderRadius: '20px 20px 0 0',
            }} />
          </div>
        )}

        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: 'var(--border)',
          margin: '12px auto 0', position: 'relative', zIndex: 1,
        }} />

        {/* Close button */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 16, zIndex: 2,
          background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
          width: 30, height: 30, cursor: 'pointer', color: '#fff', fontSize: 16,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>

        {/* Content */}
        <div style={{ padding: '16px 20px 28px', position: 'relative', zIndex: 1, marginTop: data?.backdrop ? 100 : 0 }}>
          {/* Header row */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
            {/* Poster */}
            <div style={{
              width: 90, height: 135, flexShrink: 0, borderRadius: 10,
              overflow: 'hidden', background: 'var(--border)',
              border: '1px solid var(--border)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}>
              {isLoading ? (
                <div style={{ width: '100%', height: '100%', background: 'var(--border)', animation: 'pulse 1.5s infinite' }} />
              ) : poster ? (
                <img src={poster} alt={title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                  {type === 'watch' ? '🎬' : type === 'read' ? '📚' : type === 'listen' ? '🎵' : '🎙️'}
                </div>
              )}
            </div>

            {/* Meta */}
            <div style={{ flex: 1, paddingTop: 4 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--ink)', lineHeight: 1.3, marginBottom: 5, letterSpacing: -0.3 }}>
                {isLoading ? <span style={{ display: 'block', height: 18, width: '80%', background: 'var(--border)', borderRadius: 6 }} /> : (data?.title ?? title)}
              </div>

              {/* Author (books) */}
              {data?.author && (
                <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 4 }}>{data.author}</div>
              )}

              {/* Year */}
              {data?.year && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{data.year}</div>
              )}

              {/* Genres / categories */}
              {(data?.genres.length || data?.categories.length) ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                  {[...(data?.genres ?? []), ...(data?.categories ?? [])].slice(0, 3).map((g) => (
                    <span key={g} style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px',
                      borderRadius: 20, background: 'var(--tlight)', color: 'var(--trust)',
                    }}>{g}</span>
                  ))}
                </div>
              ) : null}

              {/* Rating */}
              {data?.ratingLabel && (
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>
                  ⭐ {data.ratingLabel}
                </div>
              )}

              {/* Book meta */}
              {data?.pageCount && (
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>
                  {data.pageCount} pages{data.publisher ? ` · ${data.publisher}` : ''}
                </div>
              )}

              {/* Watchlist button */}
              {user && (
                <button
                  onClick={() => toggleWatchlist.mutate({
                    item: { type, title, sub: data?.author ?? null, poster: data?.poster ?? posterFallback ?? null },
                    currentId: watchlistId,
                  })}
                  disabled={toggleWatchlist.isPending}
                  style={{
                    marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 14px', borderRadius: 20,
                    border: `1px solid ${watchlistId ? 'var(--trust)' : 'var(--border)'}`,
                    background: watchlistId ? 'var(--tlight)' : 'var(--paper)',
                    color: watchlistId ? 'var(--trust)' : 'var(--ink)',
                    fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                >
                  {watchlistId ? '🔖 Saved' : '+ Watchlist'}
                </button>
              )}
            </div>
          </div>

          {/* Overview */}
          {(isLoading || data?.overview) && (
            <div style={{ marginBottom: 18 }}>
              {isLoading ? (
                <>
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, marginBottom: 6, width: '100%' }} />
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, marginBottom: 6, width: '85%' }} />
                  <div style={{ height: 12, background: 'var(--border)', borderRadius: 4, width: '65%' }} />
                </>
              ) : (
                <p style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>{data?.overview}</p>
              )}
            </div>
          )}

          {/* Where to Watch */}
          {type === 'watch' && (isLoading || hasProviders) && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, letterSpacing: -0.2 }}>
                Where to watch
              </div>
              {isLoading ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1,2,3].map((i) => <div key={i} style={{ height: 34, width: 90, background: 'var(--border)', borderRadius: 8 }} />)}
                </div>
              ) : (
                <>
                  <ProviderSection label="Stream" providers={streamProviders} />
                  <ProviderSection label="Free" providers={freeProviders} />
                  <ProviderSection label="Rent" providers={rentProviders} />
                  <ProviderSection label="Buy" providers={buyProviders} />
                </>
              )}
            </div>
          )}

          {/* Cast */}
          {(isLoading && type === 'watch') || data?.cast.length ? (
            isLoading ? (
              <div style={{ marginBottom: 20 }}>
                <div style={{ height: 11, width: 40, background: 'var(--border)', borderRadius: 4, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 10 }}>
                  {[1,2,3,4].map((i) => (
                    <div key={i} style={{ flexShrink: 0 }}>
                      <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--border)', marginBottom: 6 }} />
                      <div style={{ height: 10, width: 50, background: 'var(--border)', borderRadius: 4 }} />
                    </div>
                  ))}
                </div>
              </div>
            ) : <CastStrip cast={data!.cast} />
          ) : null}

          {/* External links */}
          {(data?.tmdbUrl || data?.imdbUrl) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {data.tmdbUrl && (
                <a href={data.tmdbUrl} target="_blank" rel="noreferrer" style={linkStyle}>
                  TMDB ↗
                </a>
              )}
              {data.imdbUrl && (
                <a href={data.imdbUrl} target="_blank" rel="noreferrer" style={linkStyle}>
                  IMDb ↗
                </a>
              )}
            </div>
          )}

          {/* No API data state (listen/podcast) */}
          {!hasApi && !isLoading && (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
              Detailed info isn't available for this type yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 700, color: 'var(--trust)',
  textDecoration: 'none', padding: '5px 12px',
  border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--paper)',
};
