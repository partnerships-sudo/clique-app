import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { getSpotifyToken } from '@/features/search/api';

import type { TrendingEntry } from './trending';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_KEY!;
const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;

export interface ForYouSeed {
  title: string;
  type: EntryType;
  externalId?: string | null;
  mediaType?: string | null;
}

// ---------- ID resolution ----------

async function resolveTMDBId(title: string): Promise<{ id: string; mediaType: 'movie' | 'tv' } | null> {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = (data.results ?? []).find(
    (r: any) => r.media_type === 'movie' || r.media_type === 'tv',
  );
  if (!first) return null;
  return { id: String(first.id), mediaType: first.media_type as 'movie' | 'tv' };
}

async function resolveRAWGId(title: string): Promise<{ id: string; genres: string[] } | null> {
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return { id: String(first.id), genres: (first.genres ?? []).map((g: any) => g.slug as string) };
}

async function resolveBookId(title: string): Promise<string | null> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.items?.[0]?.id ?? null;
}

// ---------- Seeded recommendation fetchers ----------

async function fetchTMDBRecs(id: string, mediaType: 'movie' | 'tv'): Promise<TrendingEntry[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/${mediaType}/${id}/recommendations?page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.results ?? []) as any[]).slice(0, 15).flatMap((r: any) => {
    const title: string = r.title || r.name;
    if (!title) return [];
    const isTV = !r.title;
    const year = (r.release_date || r.first_air_date || '').slice(0, 4);
    return [{
      title,
      sub: isTV ? `TV Series${year ? ` · ${year}` : ''}` : `Film${year ? ` · ${year}` : ''}`,
      type: 'watch' as EntryType,
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
      count: Math.round((r.vote_average ?? 5) * 10),
      users: [],
      loggers: [],
    }];
  });
}

async function fetchRAWGRecs(id: string, genreSlugs: string[]): Promise<TrendingEntry[]> {
  const suggestRes = await fetch(
    `https://api.rawg.io/api/games/${id}/suggested?key=${RAWG_KEY}&page_size=12`,
  );
  const suggestData = suggestRes.ok ? await suggestRes.json() : { results: [] };
  const suggested: TrendingEntry[] = ((suggestData.results ?? []) as any[]).flatMap((g: any) => {
    if (!g.name) return [];
    return [{
      title: g.name as string,
      sub: `${g.genres?.[0]?.name ?? 'Game'}${g.released ? ` · ${g.released.slice(0, 4)}` : ''}`,
      type: 'play' as EntryType,
      poster: g.background_image ?? null,
      count: Math.round((g.rating ?? 3) * 20),
      users: [],
      loggers: [],
    }];
  });

  // Supplement with genre-based if not enough results
  let genreEntries: TrendingEntry[] = [];
  if (suggested.length < 8 && genreSlugs.length > 0) {
    const genreRes = await fetch(
      `https://api.rawg.io/api/games?key=${RAWG_KEY}&genres=${genreSlugs[0]}&ordering=-rating&page_size=15`,
    );
    if (genreRes.ok) {
      const gd = await genreRes.json();
      genreEntries = ((gd.results ?? []) as any[]).flatMap((g: any) => {
        if (!g.name || String(g.id) === id) return [];
        return [{
          title: g.name as string,
          sub: `${g.genres?.[0]?.name ?? 'Game'}${g.released ? ` · ${g.released.slice(0, 4)}` : ''}`,
          type: 'play' as EntryType,
          poster: g.background_image ?? null,
          count: Math.round((g.rating ?? 3) * 20),
          users: [],
          loggers: [],
        }];
      });
    }
  }

  return [...suggested, ...genreEntries];
}

async function fetchBookRecs(id: string): Promise<TrendingEntry[]> {
  const detailRes = await fetch(
    `https://www.googleapis.com/books/v1/volumes/${id}?key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!detailRes.ok) return [];
  const detail = await detailRes.json();
  const categories: string[] = detail.volumeInfo?.categories ?? [];
  if (!categories.length) return [];

  const subject = categories[0].split('/')[0].trim();
  const searchRes = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=subject:${encodeURIComponent(subject)}&orderBy=relevance&maxResults=12&key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const sourceTitle = (detail.volumeInfo?.title ?? '').toLowerCase();

  return ((searchData.items ?? []) as any[]).flatMap((item: any) => {
    const info = item.volumeInfo ?? {};
    const title: string = info.title ?? '';
    if (!title || title.toLowerCase() === sourceTitle) return [];
    return [{
      title,
      sub: `${info.authors?.[0] ?? 'Unknown'}${info.publishedDate ? ` · ${info.publishedDate.slice(0, 4)}` : ''}`,
      type: 'read' as EntryType,
      poster: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      count: Math.round((info.averageRating ?? 3) * 20),
      users: [],
      loggers: [],
    }];
  });
}

// ---------- Spotify: discovery ----------

async function fetchSpotifyMusicRecs(_seed: ForYouSeed | null): Promise<TrendingEntry[]> {
  try {
    const token = await getSpotifyToken();
    const year = new Date().getFullYear();
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=year:${year}&type=album&limit=5`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.albums?.items ?? [];
    return (items as any[]).map((a: any): TrendingEntry => ({
      title: a.name,
      sub: `${a.artists?.[0]?.name ?? ''}${a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}`,
      type: 'listen',
      poster: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
      count: 80,
      users: [],
      loggers: [],
    }));
  } catch {
    return [];
  }
}

async function fetchSpotifyPodcastRecs(_seed: ForYouSeed | null): Promise<TrendingEntry[]> {
  try {
    const token = await getSpotifyToken();
    const res = await fetch(
      'https://api.spotify.com/v1/search?q=podcast&type=show&limit=5',
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const items = data.shows?.items ?? [];
    return (items as any[])
      .filter((s: any) => !!s.name)
      .slice(0, 15)
      .map((s: any): TrendingEntry => ({
        title: s.name,
        sub: `${s.publisher ?? ''} · Podcast`,
        type: 'podcast',
        poster: s.images?.[1]?.url ?? s.images?.[0]?.url ?? null,
        count: s.total_episodes ?? 50,
        users: [],
        loggers: [],
      }));
  } catch {
    return [];
  }
}

// ---------- Main hook ----------

/**
 * Fetches API-powered For You recommendations.
 *
 * watch / play / read: seeded by the user's highest-rated logged item of each type.
 *   Items logged before the phase-13 migration (no stored external_id) are resolved
 *   via title search automatically.
 *
 * listen / podcast: always populated — personalized via related-artists / publisher
 *   search when the user has a seed, otherwise falls back to Spotify new-releases /
 *   popular-shows discovery so those sections are never empty.
 */
export function useForYouRecs(seeds: ForYouSeed[]) {
  const seedKey = `v7:${seeds.map((s) => `${s.type}:${s.title}`).join('|')}`;

  return useQuery({
    queryKey: ['for-you-recs', seedKey],
    queryFn: async (): Promise<TrendingEntry[]> => {
      const listenSeed = seeds.find((s) => s.type === 'listen') ?? null;
      const podcastSeed = seeds.find((s) => s.type === 'podcast') ?? null;

      // Seeded calls for watch / play / read
      const seededCalls = seeds
        .filter((s) => s.type !== 'listen' && s.type !== 'podcast')
        .map(async (seed): Promise<TrendingEntry[]> => {
          try {
            if (seed.type === 'watch') {
              let id = seed.externalId ?? null;
              let mType: 'movie' | 'tv' =
                seed.mediaType === 'movie' || seed.mediaType === 'tv' ? seed.mediaType : 'tv';
              if (!id) {
                const resolved = await resolveTMDBId(seed.title);
                if (!resolved) return [];
                id = resolved.id;
                mType = resolved.mediaType;
              }
              return fetchTMDBRecs(id, mType);
            }
            if (seed.type === 'play') {
              let id = seed.externalId ?? null;
              let genres: string[] = [];
              if (!id) {
                const resolved = await resolveRAWGId(seed.title);
                if (!resolved) return [];
                id = resolved.id;
                genres = resolved.genres;
              }
              return fetchRAWGRecs(id, genres);
            }
            if (seed.type === 'read') {
              let id = seed.externalId ?? null;
              if (!id) id = await resolveBookId(seed.title);
              if (!id) return [];
              return fetchBookRecs(id);
            }
            return [];
          } catch {
            return [];
          }
        });

      // Spotify always runs — personalized when seed exists, discovery when not
      const [seededResults, musicRecs, podcastRecs] = await Promise.all([
        Promise.all(seededCalls),
        fetchSpotifyMusicRecs(listenSeed).catch(() => [] as TrendingEntry[]),
        fetchSpotifyPodcastRecs(podcastSeed).catch(() => [] as TrendingEntry[]),
      ]);

      const all = [...seededResults.flat(), ...musicRecs, ...podcastRecs];

      // De-duplicate by normalized title, keep highest-scored entry per title
      const best = new Map<string, TrendingEntry>();
      for (const entry of all) {
        const key = entry.title.toLowerCase();
        const existing = best.get(key);
        if (!existing || entry.count > existing.count) best.set(key, entry);
      }

      return [...best.values()].sort((a, b) => b.count - a.count);
    },
    enabled: true, // always run — Spotify discovery doesn't need seeds
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
