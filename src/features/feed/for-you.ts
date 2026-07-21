import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
const HARDCOVER_TOKEN = process.env.EXPO_PUBLIC_HARDCOVER_TOKEN ?? '';

async function hardcoverQuery(query: string): Promise<any> {
  const res = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${HARDCOVER_TOKEN}` },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) console.warn('[Hardcover for-you]', json.errors[0]?.message);
  return json.data ?? null;
}
import { igdbSearch, igdbSimilar } from '@/features/games/igdb';
import { getSpotifyToken } from '@/features/search/api';

import type { TrendingEntry } from './trending';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
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

async function fetchIgdbRecs(seedId: number): Promise<TrendingEntry[]> {
  const similar = await igdbSimilar(seedId);
  return similar.map((g) => ({
    title: g.title,
    sub: `${g.genre ?? 'Game'}${g.year ? ` · ${g.year}` : ''}`,
    type: 'play' as EntryType,
    poster: g.cover ?? null,
    count: g.rating ? Math.round(parseFloat(g.rating) * 20) : 60,
    score: g.rating ? Math.round(parseFloat(g.rating) * 20) : 60,
    externalId: String(g.id),
    users: [],
    loggers: [],
  }));
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
      externalId: String(r.id),
      mediaType: isTV ? 'tv' : 'movie',
      users: [],
      loggers: [],
    }];
  });
}


async function fetchBookRecs(title: string, hardcoverId?: string | null): Promise<TrendingEntry[]> {
  // Resolve Hardcover ID if not provided
  let bookId = hardcoverId ? Number(hardcoverId) : null;
  console.log('[BookRecs] start', title, 'hardcoverId:', hardcoverId, 'bookId:', bookId);
  if (!bookId) {
    const searchQ = `query { search(query: ${JSON.stringify(title)}, query_type: "Book", per_page: 1, page: 1) { results } }`;
    const searchData = await hardcoverQuery(searchQ);
    bookId = searchData?.search?.results?.hits?.[0]?.document?.id ?? null;
    console.log('[BookRecs] searched, bookId:', bookId);
  }
  if (!bookId) return [];

  // Get the book's genre tags (pick the most popular genre-like ones)
  const tagData = await hardcoverQuery(
    `query { books(where: { id: { _eq: ${bookId} } }, limit: 1) { title taggings(limit: 50) { tag { tag } } } }`,
  );
  const sourceTitle = (tagData?.books?.[0]?.title ?? title).toLowerCase();
  const tags: string[] = (tagData?.books?.[0]?.taggings ?? [])
    .map((t: any) => t.tag?.tag as string)
    .filter(Boolean);

  // Pick the best genre tag — prefer known genre terms over mood/pace words
  const GENRE_TAGS = new Set([
    'science fiction', 'hard science fiction', 'fantasy', 'epic fantasy', 'mystery', 'thriller',
    'romance', 'horror', 'historical fiction', 'crime', 'adventure', 'biography', 'memoir',
    'nonfiction', 'non-fiction', 'self-help', 'literary fiction', 'dystopian', 'young adult',
    'graphic novel', 'short stories', 'humor', 'satire',
  ]);
  const genreTag = tags.find((t) => GENRE_TAGS.has(t.toLowerCase())) ?? null;
  if (!genreTag) return [];

  const recData = await hardcoverQuery(
    `query { books(where: { taggings: { tag: { tag: { _eq: ${JSON.stringify(genreTag)} } } }, order_by: { users_count: desc }, limit: 15) { title rating contributions { author { name } } image { url } } }`,
  );
  return ((recData?.books ?? []) as any[]).flatMap((b: any) => {
    const t: string = b.title ?? '';
    if (!t || t.toLowerCase() === sourceTitle) return [];
    return [{
      title: t,
      sub: b.contributions?.[0]?.author?.name ?? '',
      type: 'read' as EntryType,
      poster: b.image?.url ?? null,
      count: Math.round((b.rating ?? 3) * 20),
      score: Math.round((b.rating ?? 3) * 20),
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
 * via each source's own similarity engine (TMDB's /recommendations, IGDB
 * similar_games, Google Books subject search). Deliberately does NOT
 * blend across content types, so "Because you watched a documentary" never
 * surfaces podcasts or games.
 */
export function useBecauseYouRecs(seed: ForYouSeed | null) {
  return useQuery({
    queryKey: ['because-you-recs-v5', seed ? `${seed.type}:${seed.title}` : null],
    queryFn: async (): Promise<TrendingEntry[]> => {
      console.log('[BecauseYou] queryFn called, seed:', seed?.type, seed?.title);
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
          let igdbId = seed.externalId ? Number(seed.externalId) : null;
          if (!igdbId) {
            const results = await igdbSearch(seed.title);
            igdbId = results[0]?.id ?? null;
          }
          if (!igdbId) return [];
          return fetchIgdbRecs(igdbId);
        }
        if (seed.type === 'read') {
          return fetchBookRecs(seed.title, seed.externalId);
        }
        if (seed.type === 'listen') return fetchSpotifyMusicRecs(seed);
        if (seed.type === 'podcast') return fetchSpotifyPodcastRecs(seed);
        return [];
      } catch {
        return [];
      }
    },
    enabled: !!seed,
    staleTime: 0,
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
              let igdbId = seed.externalId ? Number(seed.externalId) : null;
              if (!igdbId) {
                const results = await igdbSearch(seed.title);
                igdbId = results[0]?.id ?? null;
              }
              if (!igdbId) return [];
              return fetchIgdbRecs(igdbId);
            }
            if (seed.type === 'read') {
              return fetchBookRecs(seed.title, seed.externalId);
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
