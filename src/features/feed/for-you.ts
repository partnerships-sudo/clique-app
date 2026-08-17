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
  if (json.errors) console.warn('[Hardcover for-you]', json.errors[0]?.message, '\nQuery:', query.slice(0, 120));
  return json.data ?? null;
}
import { igdbSearch, igdbSimilar } from '@/features/games/igdb';
import { getSpotifyToken } from '@/features/search/api';
import { tmdbFetch } from '@/lib/tmdb';

import type { TrendingEntry } from './trending';

const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;

export interface ForYouSeed {
  title: string;
  type: EntryType;
  externalId?: string | null;
  mediaType?: string | null;
}

// ---------- ID resolution ----------

async function resolveTMDBId(title: string): Promise<{ id: string; mediaType: 'movie' | 'tv' } | null> {
  // Unresolvable titles are expected here, so a failure means "no match" rather
  // than an error worth propagating.
  let data: any;
  try {
    data = await tmdbFetch(
      `search/multi?query=${encodeURIComponent(title)}&include_adult=false&page=1`,
    );
  } catch {
    return null;
  }
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
  let data: any;
  try {
    data = await tmdbFetch(`${mediaType}/${id}/recommendations?page=1`);
  } catch {
    return [];
  }
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
  const titleLower = title.toLowerCase();
  const seen = new Set<string>();
  const toEntry = (doc: any): TrendingEntry | null => {
    const t: string = doc?.title ?? '';
    if (!t || seen.has(t.toLowerCase())) return null;
    seen.add(t.toLowerCase());
    return {
      title: t,
      sub: doc.contributions?.[0]?.author?.name ?? doc.author_names?.[0] ?? '',
      type: 'read' as EntryType,
      poster: doc.image?.url ?? null,
      count: Math.round((doc.rating ?? 3) * 20),
      score: Math.round((doc.rating ?? 3) * 20),
      externalId: doc.id ? String(doc.id) : undefined,
      users: [],
      loggers: [],
    };
  };

  // Resolve Hardcover ID if not provided
  let bookId = hardcoverId ? Number(hardcoverId) : null;
  if (!bookId) {
    const searchQ = `query { search(query: ${JSON.stringify(title)}, query_type: "Book", per_page: 1, page: 1) { results } }`;
    const searchData = await hardcoverQuery(searchQ);
    bookId = searchData?.search?.results?.hits?.[0]?.document?.id ?? null;
  }

  // Fallback: book not found in Hardcover — return results from a keyword title search
  if (!bookId) {
    const fallbackData = await hardcoverQuery(
      `query { search(query: ${JSON.stringify(title)}, query_type: "Book", per_page: 20, page: 2) { results } }`,
    );
    const hits: any[] = (fallbackData?.search?.results?.hits ?? [])
      .map((h: any) => h.document)
      .filter((d: any) => d?.title?.toLowerCase() !== titleLower);
    return hits.flatMap((d) => { const e = toEntry(d); return e ? [e] : []; }).slice(0, 15);
  }

  // Get the book's genre tags
  const tagData = await hardcoverQuery(
    `query { books(where: { id: { _eq: ${bookId} } }, limit: 1) { title taggings(limit: 50) { tag { tag } } contributions { author { name } } } }`,
  );
  const sourceTitle = (tagData?.books?.[0]?.title ?? title).toLowerCase();
  const tags: string[] = (tagData?.books?.[0]?.taggings ?? [])
    .map((t: any) => t.tag?.tag as string)
    .filter(Boolean);

  // Prefer a known genre term; fall back to the first available tag rather than bailing out
  const GENRE_TAGS = new Set([
    'science fiction', 'hard science fiction', 'fantasy', 'epic fantasy', 'mystery', 'thriller',
    'romance', 'horror', 'historical fiction', 'crime', 'adventure', 'biography', 'memoir',
    'nonfiction', 'non-fiction', 'self-help', 'literary fiction', 'dystopian', 'young adult',
    'graphic novel', 'short stories', 'humor', 'satire',
  ]);
  const genreTag = tags.find((t) => GENRE_TAGS.has(t.toLowerCase())) ?? tags[0] ?? null;

  // 1. Same-author books (always fetch; single-book authors are handled by the sparse fallback below)
  const authorName = tagData?.books?.[0]?.contributions?.[0]?.author?.name ?? null;
  const authorRecs = authorName ? await hardcoverQuery(
    `query { search(query: ${JSON.stringify(authorName)}, query_type: "Book", per_page: 10, page: 1) { results } }`,
  ) : null;
  const authorHits: any[] = (authorRecs?.search?.results?.hits ?? [])
    .map((h: any) => h.document)
    .filter((d: any) => d?.title?.toLowerCase() !== sourceTitle);

  // 2. Same genre (or best available tag)
  let genreHits: any[] = [];
  if (genreTag) {
    const genreRecs = await hardcoverQuery(
      `query { search(query: ${JSON.stringify(genreTag)}, query_type: "Book", per_page: 20, page: 2) { results } }`,
    );
    genreHits = (genreRecs?.search?.results?.hits ?? [])
      .map((h: any) => h.document)
      .filter((d: any) => d?.title?.toLowerCase() !== sourceTitle && d?.users_count > 100);
  }

  const combined = [...authorHits, ...genreHits]
    .flatMap((d) => { const e = toEntry(d); return e ? [e] : []; })
    .slice(0, 15);

  // 3. Sparse fallback: supplement with a title-keyword search when results are thin
  if (combined.length < 5) {
    const fallbackData = await hardcoverQuery(
      `query { search(query: ${JSON.stringify(sourceTitle)}, query_type: "Book", per_page: 20, page: 2) { results } }`,
    );
    const fallbackHits: any[] = (fallbackData?.search?.results?.hits ?? [])
      .map((h: any) => h.document)
      .filter((d: any) => d?.title?.toLowerCase() !== sourceTitle);
    const extra = fallbackHits.flatMap((d) => { const e = toEntry(d); return e ? [e] : []; });
    return [...combined, ...extra].slice(0, 15);
  }

  return combined;
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
//
// For short/generic titles (≤2 words) we also fetch the show's primary genre
// from iTunes and append it to the query so "Crime" becomes "Crime" True Crime
// rather than matching everything Spotify thinks is crime-adjacent.

async function getPodcastGenreFromItunes(title: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(title)}&entity=podcast&limit=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results?.[0]?.primaryGenreName as string) ?? null;
  } catch {
    return null;
  }
}

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
        const artistId: string | undefined = album.artists?.[0]?.id;
        const artistName: string = album.artists?.[0]?.name ?? '';
        const albumName: string = album.name ?? seed.title;

        // Soundtracks and compilations credit "Various Artists" — the first
        // artist's catalog is unrelated to the seed, so skip it and rely on
        // the title search below instead.
        const isVariousArtists =
          !artistName || artistName.toLowerCase() === 'various artists';

        const seen = new Set<string>([albumName.toLowerCase(), seed.externalId]);

        // 1. Artist catalog (skipped for various-artists albums)
        const catalogRecs: TrendingEntry[] = [];
        if (!isVariousArtists && artistId) {
          const albumsRes = await fetch(
            `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&market=US&limit=20`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (albumsRes.ok) {
            const albumsData = await albumsRes.json();
            for (const a of (albumsData.items ?? []) as any[]) {
              if (a.id === seed.externalId) continue;
              const key = a.name.toLowerCase();
              if (seen.has(key)) continue;
              seen.add(key);
              catalogRecs.push({
                title: a.name,
                sub: `${artistName}${a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}`,
                type: 'listen',
                poster: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
                count: 70,
                score: 70, // same artist, strong signal
                users: [],
                loggers: [],
              });
            }
          }
        }

        // 2. Title-based search — Spotify's relevance surfaces genre-adjacent
        // albums the way it does for podcasts. Scored slightly lower than
        // catalog results since it's discovery rather than same-artist.
        const searchRecs: TrendingEntry[] = [];
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(albumName)}&type=album&market=US&limit=20`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (searchRes.ok) {
          const data = await searchRes.json();
          for (const a of (data.albums?.items ?? []) as any[]) {
            if (a.id === seed.externalId) continue;
            const key = a.name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            searchRecs.push({
              title: a.name,
              sub: `${a.artists?.[0]?.name ?? ''}${a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}`,
              type: 'listen',
              poster: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
              count: 65,
              score: 65,
              users: [],
              loggers: [],
            });
          }
        }

        // Lead with catalog for regular artists so same-artist recs come first;
        // for soundtracks/compilations, title-search results only.
        const combined = isVariousArtists
          ? searchRecs
          : [...catalogRecs, ...searchRecs];
        if (combined.length > 0) return combined.slice(0, 15);
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
      const words = seed.title.trim().split(/\s+/);
      let query = seed.title;
      if (words.length <= 2) {
        const genre = await getPodcastGenreFromItunes(seed.title);
        query = genre ? `"${seed.title}" ${genre}` : `"${seed.title}"`;
      }
      const searchRes = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&market=US&limit=15`,
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
    queryKey: ['because-you-recs-v8', seed ? `${seed.type}:${seed.title}` : null],
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
          // Always resolve via title search — stored external_id may be a pre-migration
          // RAWG ID which is a different namespace from IGDB IDs.
          const results = await igdbSearch(seed.title);
          const igdbId = results[0]?.id ?? null;
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
