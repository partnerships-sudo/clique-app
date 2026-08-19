import { useQuery } from '@tanstack/react-query';

import type { TrendingEntry } from '@/features/feed/trending';
import { supabase } from '@/lib/supabase';

// Session-lifetime cache — the same game title is looked up repeatedly across
// search, For You recs, and re-renders, and IGDB's rate limit makes re-fetching wasteful.
const coverCache = new Map<string, string | null>();

async function invokeIgdb<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('igdb-cover', { body });
  if (error) throw error;
  return data as T;
}

// ── RAWG fallback ─────────────────────────────────────────────────────────────
// Used when the igdb-cover Edge Function is unavailable. RAWG is a public game
// database with a generous free tier and no server-side proxy required.
// Note: RAWG and IGDB use different numeric IDs — fallback IDs are RAWG IDs.


const RAWG_PLATFORM_MAP: Record<string, string> = {
  pc: 'pc', macos: 'pc', linux: 'pc',
  playstation4: 'playstation', playstation5: 'playstation', playstation3: 'playstation',
  'xbox-one': 'xbox', 'xbox-series-x': 'xbox', xbox360: 'xbox',
  'nintendo-switch': 'nintendo-switch',
  ios: 'ios',
  android: 'android',
};

function rawgToIgdb(g: Record<string, any>): IgdbGame {
  const platforms = [...new Set(
    ((g.platforms ?? []) as { platform: { slug: string } }[])
      .map((p) => RAWG_PLATFORM_MAP[p.platform?.slug ?? ''])
      .filter(Boolean),
  )] as string[];
  return {
    id: g.id as number,
    title: (g.name ?? '') as string,
    cover: (g.background_image ?? null) as string | null,
    summary: (g.description_raw ?? null) as string | null,
    rating: g.rating ? String(Math.round((g.rating as number) * 20)) : null,
    year: g.released ? (g.released as string).split('-')[0] : null,
    genre: ((g.genres ?? []) as { name: string }[]).map((gn) => gn.name).join(', ') || null,
    platforms,
    storeUrls: {},
    similarIds: [],
    developer: ((g.developers ?? []) as { name: string }[])[0]?.name
      ? { name: (g.developers as { name: string }[])[0].name, logoUrl: null }
      : null,
  };
}

async function rawgSearch(query: string): Promise<IgdbGame[]> {
  if (!query.trim()) return [];
  try {
    const { data, error } = await supabase.functions.invoke<{ results?: Record<string, any>[] }>(
      'rawg-proxy',
      { body: { action: 'search', query: query.trim() } },
    );
    if (error || !data) return [];
    return (data.results ?? []).map(rawgToIgdb);
  } catch {
    return [];
  }
}

async function rawgDetails(id: number): Promise<IgdbGame | null> {
  try {
    const { data, error } = await supabase.functions.invoke<Record<string, any>>(
      'rawg-proxy',
      { body: { action: 'details', id } },
    );
    if (error || !data) return null;
    return rawgToIgdb(data);
  } catch {
    return null;
  }
}

export async function fetchIgdbCovers(titles: string[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(titles.filter(Boolean))];
  const uncached = unique.filter((t) => !coverCache.has(t));

  if (uncached.length > 0) {
    try {
      const data = await invokeIgdb<{ covers: Record<string, string | null> }>({ titles: uncached });
      for (const [title, url] of Object.entries(data?.covers ?? {})) {
        coverCache.set(title, url);
      }
    } catch { /* fall through */ }
    for (const title of uncached) {
      if (!coverCache.has(title)) coverCache.set(title, null);
    }
  }

  const result: Record<string, string | null> = {};
  for (const title of unique) result[title] = coverCache.get(title) ?? null;
  return result;
}

export interface IgdbGame {
  id: number;
  title: string;
  cover: string | null;
  summary: string | null;
  rating: string | null;
  year: string | null;
  genre: string | null;
  platforms: string[];
  storeUrls: Record<string, string>;
  similarIds: number[];
  developer?: { name: string; logoUrl: string | null } | null;
  cast?: { name: string; character: string; profilePath: string | null }[];
  trailerUrl?: string | null;
  trailerThumbnail?: string | null;
  trailerSite?: 'YouTube' | 'Vimeo' | 'Apple' | 'Dailymotion' | null;
}

export async function igdbSearch(query: string): Promise<IgdbGame[]> {
  try {
    const data = await invokeIgdb<{ results: IgdbGame[] }>({ action: 'search', query });
    return data?.results ?? [];
  } catch {
    return rawgSearch(query);
  }
}

export async function igdbDetails(id: number): Promise<IgdbGame | null> {
  try {
    const data = await invokeIgdb<{ game: IgdbGame | null }>({ action: 'details', id });
    return data?.game ?? null;
  } catch {
    // RAWG IDs and IGDB IDs are different namespaces. This works correctly when
    // id came from a rawgSearch fallback call; returns null for stored IGDB IDs
    // (caller handles that by falling back to title search).
    return rawgDetails(id);
  }
}

export async function igdbSimilar(id: number): Promise<IgdbGame[]> {
  try {
    const data = await invokeIgdb<{ results: IgdbGame[] }>({ action: 'similar', id });
    return data?.results ?? [];
  } catch {
    return [];
  }
}

export function useGameCoverOverrides(titles: string[]): Record<string, string | null> {
  const unique = [...new Set(titles)];
  const { data } = useQuery({
    queryKey: ['igdb-covers', unique],
    queryFn: () => fetchIgdbCovers(unique),
    enabled: unique.length > 0,
    staleTime: Infinity,
  });
  return data ?? {};
}

export function applyGameCovers<T extends TrendingEntry>(
  entries: T[],
  covers: Record<string, string | null>,
): T[] {
  return entries.map((e) => (e.type === 'play' && covers[e.title] ? { ...e, poster: covers[e.title]! } : e));
}

// ── Upcoming games (On the Radar) ─────────────────────────────────────────────

export interface UpcomingGame {
  id: number;
  title: string;
  cover: string | null;
  releaseDate: string;   // ISO date string, e.g. "2026-09-12"
  genre: string | null;
  platforms: string[];
}

async function fetchUpcomingGames(): Promise<UpcomingGame[]> {
  try {
    const data = await invokeIgdb<{ results: UpcomingGame[] }>({ action: 'upcoming' });
    return data?.results ?? [];
  } catch (e) {
    console.warn('[igdb/upcoming]', e);
    return [];
  }
}

export function useUpcomingGames() {
  return useQuery({
    queryKey: ['games', 'upcoming'],
    queryFn: fetchUpcomingGames,
    staleTime: 60 * 60 * 1000,
  });
}
