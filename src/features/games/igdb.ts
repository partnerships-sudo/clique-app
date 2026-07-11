import { useQuery } from '@tanstack/react-query';

import type { TrendingEntry } from '@/features/feed/trending';
import { supabase } from '@/lib/supabase';

// Session-lifetime cache — the same game title is looked up repeatedly across
// search, For You recs, and re-renders, and IGDB's rate limit (4 req/s,
// shared across every user of this app) makes re-fetching wasteful.
const coverCache = new Map<string, string | null>();

export async function fetchIgdbCovers(titles: string[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(titles.filter(Boolean))];
  const uncached = unique.filter((t) => !coverCache.has(t));

  if (uncached.length > 0) {
    try {
      const { data, error } = await supabase.functions.invoke<{ covers: Record<string, string | null> }>(
        'igdb-cover',
        { body: { titles: uncached } },
      );
      if (!error && data?.covers) {
        for (const [title, url] of Object.entries(data.covers)) {
          coverCache.set(title, url);
        }
      }
    } catch {
      // Network hiccup — fall through and cache these as "no cover" below so
      // a flaky request doesn't get retried on every render.
    }
    for (const title of uncached) {
      if (!coverCache.has(title)) coverCache.set(title, null);
    }
  }

  const result: Record<string, string | null> = {};
  for (const title of unique) result[title] = coverCache.get(title) ?? null;
  return result;
}

// Trending entries built from stored posts (My Circle / Global Top 10) carry
// whatever poster was saved at log time — for games logged before IGDB was
// wired in, that's RAWG's landscape screenshot, permanently. Rather than
// backfilling the DB, this always resolves the freshest cover at render
// time and overrides the stored one, the same "prefer IGDB, fall back to
// what's already there" rule used everywhere else games get art.
export function useGameCoverOverrides(titles: string[]): Record<string, string | null> {
  const unique = [...new Set(titles)];
  const { data } = useQuery({
    queryKey: ['igdb-covers', unique],
    queryFn: () => fetchIgdbCovers(unique),
    enabled: unique.length > 0,
    staleTime: Infinity, // box art for a given title doesn't change
  });
  return data ?? {};
}

export function applyGameCovers<T extends TrendingEntry>(
  entries: T[],
  covers: Record<string, string | null>,
): T[] {
  return entries.map((e) => (e.type === 'play' && covers[e.title] ? { ...e, poster: covers[e.title]! } : e));
}
