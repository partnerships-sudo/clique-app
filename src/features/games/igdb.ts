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
}

export async function igdbSearch(query: string): Promise<IgdbGame[]> {
  const data = await invokeIgdb<{ results: IgdbGame[] }>({ action: 'search', query });
  return data?.results ?? [];
}

export async function igdbDetails(id: number): Promise<IgdbGame | null> {
  const data = await invokeIgdb<{ game: IgdbGame | null }>({ action: 'details', id });
  return data?.game ?? null;
}

export async function igdbSimilar(id: number): Promise<IgdbGame[]> {
  const data = await invokeIgdb<{ results: IgdbGame[] }>({ action: 'similar', id });
  return data?.results ?? [];
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
