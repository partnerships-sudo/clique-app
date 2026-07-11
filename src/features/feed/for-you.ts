import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { fetchIgdbCovers } from '@/features/games/igdb';
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

// RAWG tags mix crowd-sourced English and Russian labels, and skew toward
// ultra-generic ones ("Singleplayer" alone spans 250k+ games). Picking the
// rarest English tags gives the most differentiating signal — "roguelike" or
// "isometric" narrows things down far more than "singleplayer" ever could.
function pickSpecificTags(tags: any[]): string[] {
  return tags
    .filter((t) => t.language === 'eng' && t.games_count >= 500)
    .sort((a, b) => a.games_count - b.games_count)
    .slice(0, 4)
    .map((t) => t.slug as string);
}

async function resolveRAWGId(title: string): Promise<{ id: string; genres: string[]; tags: string[] } | null> {
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
  );
  if (!res.ok) return null;
  const data = await res.json();
  const first = data.results?.[0];
  if (!first) return null;
  return {
    id: String(first.id),
    genres: (first.genres ?? []).map((g: any) => g.slug as string),
    tags: pickSpecificTags(first.tags ?? []),
  };
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
      score: Math.round((r.vote_average ?? 5) * 10),
      users: [],
      loggers: [],
    }];
  });
}

async function fetchRAWGGenresAndTags(id: string): Promise<{ genres: string[]; tags: string[] }> {
  const res = await fetch(`https://api.rawg.io/api/games/${id}?key=${RAWG_KEY}`);
  if (!res.ok) return { genres: [], tags: [] };
  const data = await res.json();
  return {
    genres: ((data.genres ?? []) as any[]).map((g: any) => g.slug as string),
    tags: pickSpecificTags(data.tags ?? []),
  };
}

async function mapRAWGResults(results: any[], excludeId: string): Promise<TrendingEntry[]> {
  const games = (results as any[]).filter((g) => g.name && String(g.id) !== excludeId);

  // RAWG only has landscape screenshots — IGDB has real 2:3 box art, so it's
  // the preferred source; RAWG's background_image is just the fallback for
  // titles IGDB doesn't have.
  const covers = await fetchIgdbCovers(games.map((g) => g.name));

  return games.map((g) => ({
    title: g.name as string,
    sub: `${g.genres?.[0]?.name ?? 'Game'}${g.released ? ` · ${g.released.slice(0, 4)}` : ''}`,
    type: 'play' as EntryType,
    poster: covers[g.name] ?? g.background_image ?? null,
    count: Math.round((g.rating ?? 3) * 20),
    score: Math.round((g.rating ?? 3) * 20),
    users: [],
    loggers: [],
  }));
}

async function fetchRAWGRecs(id: string, genreSlugs: string[], tagSlugs: string[] = []): Promise<TrendingEntry[]> {
  // RAWG's /games/{id}/suggested endpoint 401s under this API key's access
  // tier (verified directly — basic search/detail calls work fine, this one
  // doesn't, consistently, likely gated behind a paid RAWG plan). Genre+tag
  // discovery is the real source of game recs, not a fallback supplement.
  if (genreSlugs.length === 0) return [];

  const params = new URLSearchParams({
    key: RAWG_KEY,
    genres: genreSlugs.join(','),
    ordering: '-rating',
    page_size: '15',
  });
  // Specific tags (roguelike, isometric, etc.) narrow genre-only results —
  // which skew toward whatever's broadly popular in that genre — down to
  // games that actually share what makes the seed distinctive. Newer/niche
  // titles sometimes have no tags yet, so this is additive, not required.
  if (tagSlugs.length > 0) params.set('tags', tagSlugs.join(','));

  const res = await fetch(`https://api.rawg.io/api/games?${params.toString()}`);
  let results = res.ok ? ((await res.json()).results ?? []) : [];

  // Tags can over-narrow for unusual combinations — fall back to genres alone
  // rather than showing a sparse or empty section.
  if (results.length < 5 && tagSlugs.length > 0) {
    const fallbackParams = new URLSearchParams({
      key: RAWG_KEY,
      genres: genreSlugs.join(','),
      ordering: '-rating',
      page_size: '15',
    });
    const fallbackRes = await fetch(`https://api.rawg.io/api/games?${fallbackParams.toString()}`);
    results = fallbackRes.ok ? ((await fallbackRes.json()).results ?? []) : [];
  }

  return mapRAWGResults(results, id);
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
      score: Math.round((info.averageRating ?? 3) * 20),
      users: [],
      loggers: [],
    }];
  });
}

// ---------- Spotify: discovery ----------
//
// Spotify restricted `popularity`, `followers`, `genres`, and `publisher`
// to apps with Extended Access approval (Nov 2024 policy change) — this app
// doesn't have that, so those fields come back null even via valid calls.
// That rules out true "similar artist" / "same publisher" lookups. Instead:
// music is seeded via the *same artist's* other albums (a real, always-
// available catalog endpoint), and podcasts are seeded by searching Spotify
// using the logged show's own name — Spotify's search relevance turns out to
// surface genuinely topic-similar shows this way (verified: searching
// "Crime Junkie" surfaces Morbid, CounterClock, Dark Downeast, etc).

async function fetchSpotifyDiscoveryAlbums(token: string): Promise<TrendingEntry[]> {
  const year = new Date().getFullYear();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=year:${year}&type=album&limit=10`,
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
    count: 55,
    score: 55, // unseeded discovery — no real signal, treat as below-average
    users: [],
    loggers: [],
  }));
}

async function fetchSpotifyMusicRecs(seed: ForYouSeed | null): Promise<TrendingEntry[]> {
  try {
    const token = await getSpotifyToken();

    if (seed?.externalId) {
      const albumRes = await fetch(`https://api.spotify.com/v1/albums/${seed.externalId}?market=US`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (albumRes.ok) {
        const album = await albumRes.json();
        const artistId = album.artists?.[0]?.id;
        const artistName = album.artists?.[0]?.name ?? '';
        if (artistId) {
          const albumsRes = await fetch(
            `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=20`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (albumsRes.ok) {
            const albumsData = await albumsRes.json();
            const seen = new Set<string>();
            const recs: TrendingEntry[] = [];
            for (const a of (albumsData.items ?? []) as any[]) {
              if (a.id === seed.externalId) continue;
              const key = a.name.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              recs.push({
                title: a.name,
                sub: `${artistName}${a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}`,
                type: 'listen',
                poster: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
                count: 70,
                score: 70, // same artist as a title you rated highly — real signal, no popularity number to lean on
                users: [],
                loggers: [],
              });
            }
            if (recs.length > 0) return recs;
          }
        }
      }
    }

    return await fetchSpotifyDiscoveryAlbums(token);
  } catch {
    return [];
  }
}

async function fetchSpotifyDiscoveryShows(token: string): Promise<TrendingEntry[]> {
  const res = await fetch('https://api.spotify.com/v1/search?q=podcast&type=show&market=US&limit=10', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = data.shows?.items ?? [];
  return (items as any[])
    .filter((s: any) => !!s.name)
    .map((s: any): TrendingEntry => ({
      title: s.name,
      sub: 'Podcast',
      type: 'podcast',
      poster: s.images?.[1]?.url ?? s.images?.[0]?.url ?? null,
      count: s.total_episodes ?? 50,
      score: 50, // unseeded discovery — no real signal, treat as below-average
      users: [],
      loggers: [],
    }));
}

async function fetchSpotifyPodcastRecs(seed: ForYouSeed | null): Promise<TrendingEntry[]> {
  try {
    const token = await getSpotifyToken();

    if (seed?.title) {
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(seed.title)}&type=show&market=US&limit=15`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        const items = ((data.shows?.items ?? []) as any[]).filter(
          (s: any) => !!s.name && s.id !== seed.externalId && s.name.toLowerCase() !== seed.title.toLowerCase(),
        );
        if (items.length > 0) {
          return items.map((s: any): TrendingEntry => {
            // Diminishing-returns normalization so a 1000-episode show doesn't
            // automatically outrank everything else — same idea as TMDB/RAWG's
            // 0-100 scale, just derived from episode count instead of a rating.
            const episodes = s.total_episodes ?? 10;
            const score = Math.min(100, Math.round(Math.log2(episodes + 1) * 12));
            return {
              title: s.name,
              sub: 'Podcast',
              type: 'podcast',
              poster: s.images?.[1]?.url ?? s.images?.[0]?.url ?? null,
              count: episodes,
              score,
              users: [],
              loggers: [],
            };
          });
        }
      }
    }

    return await fetchSpotifyDiscoveryShows(token);
  } catch {
    return [];
  }
}

// ---------- Single-seed hook (e.g. "Because you watched X") ----------

/**
 * Recommendations for exactly one seed — same content type, same-ish genre,
 * via each source's own similarity engine (TMDB's /recommendations, RAWG
 * genre+tag search, Google Books subject search). Deliberately does NOT
 * blend across content types, so "Because you watched a documentary" never
 * surfaces podcasts or games.
 */
export function useBecauseYouRecs(seed: ForYouSeed | null) {
  return useQuery({
    queryKey: ['because-you-recs', seed ? `${seed.type}:${seed.title}` : null],
    queryFn: async (): Promise<TrendingEntry[]> => {
      if (!seed) return [];
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
          let tags: string[] = [];
          if (id) {
            // Already have the RAWG id (logged via search) — still need its
            // genres + tags, since that's what actually drives fetchRAWGRecs now.
            const resolved = await fetchRAWGGenresAndTags(id);
            genres = resolved.genres;
            tags = resolved.tags;
          } else {
            const resolved = await resolveRAWGId(seed.title);
            if (!resolved) return [];
            id = resolved.id;
            genres = resolved.genres;
            tags = resolved.tags;
          }
          return fetchRAWGRecs(id, genres, tags);
        }
        if (seed.type === 'read') {
          let id = seed.externalId ?? null;
          if (!id) id = await resolveBookId(seed.title);
          if (!id) return [];
          return fetchBookRecs(id);
        }
        if (seed.type === 'listen') return fetchSpotifyMusicRecs(seed);
        if (seed.type === 'podcast') return fetchSpotifyPodcastRecs(seed);
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!seed,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
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
              let tags: string[] = [];
              if (id) {
                const resolved = await fetchRAWGGenresAndTags(id);
                genres = resolved.genres;
                tags = resolved.tags;
              } else {
                const resolved = await resolveRAWGId(seed.title);
                if (!resolved) return [];
                id = resolved.id;
                genres = resolved.genres;
                tags = resolved.tags;
              }
              return fetchRAWGRecs(id, genres, tags);
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

      // De-duplicate by type + normalized title, keep the highest-scored entry.
      // Title alone isn't enough — a novel and a game (or a movie and its
      // soundtrack album) can share an exact title, and keying on title only
      // would let one silently overwrite the other, showing e.g. a book where
      // a game recommendation should be.
      const best = new Map<string, TrendingEntry>();
      for (const entry of all) {
        const key = `${entry.type}:${entry.title.toLowerCase()}`;
        const existing = best.get(key);
        if (!existing || (entry.score ?? entry.count) > (existing.score ?? existing.count)) best.set(key, entry);
      }

      return [...best.values()].sort((a, b) => (b.score ?? b.count) - (a.score ?? a.count));
    },
    enabled: true, // always run — Spotify discovery doesn't need seeds
    staleTime: 0,
    gcTime: 60 * 60 * 1000,
  });
}
