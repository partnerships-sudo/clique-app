import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import type { CollectionFormat } from '@/features/collection/api';
import { igdbSearch } from '@/features/games/igdb';
import { hardcoverQuery } from '@/lib/hardcover';
import { supabase } from '@/lib/supabase';
import { tmdbFetch } from '@/lib/tmdb';

const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 53: 'Thriller', 10752: 'War', 37: 'Western',
};
const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

export interface SearchResult {
  title: string;
  sub: string;
  img: string | null;
  square: boolean;
  rating: string | null;
  externalId: string | null;
  mediaType: string | null; // 'movie' | 'tv' | 'game' | 'book' | 'album' | 'podcast'
}

async function searchTMDB(query: string): Promise<SearchResult[]> {
  const data = await tmdbFetch(
    `search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
  );
  // /search/multi also returns actors/crew matching by name — keep only
  // actual movies and shows, filtered before the slice so a person result
  // ranked highly by TMDB doesn't crowd out real title matches.
  const raw = (data.results ?? [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 8) as any[];

  const results: (Omit<SearchResult, 'externalId' | 'mediaType'> & { tmdbId: number; mediaType: string })[] = raw
    .map((r) => {
      const isTV = r.media_type === 'tv';
      const year = (r.release_date || r.first_air_date || '').slice(0, 4);
      const genreMap = isTV ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES;
      const genreNames = (r.genre_ids ?? []).slice(0, 2).map((id: number) => genreMap[id]).filter(Boolean);
      const genrePart = genreNames.length ? ` · ${genreNames.join(' · ')}` : '';
      const sub = isTV
        ? `TV Series${year ? ` · ${year}` : ''}${genrePart}`
        : `Film${year ? ` · ${year}` : ''}${genrePart}`;
      return {
        title: r.title || r.name,
        sub,
        img: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
        rating: r.vote_average ? r.vote_average.toFixed(1) : null,
        square: false,
        tmdbId: r.id,
        mediaType: r.media_type,
      };
    })
    .filter((r) => r.title);

  const needsNetwork = results.filter((r) => r.mediaType === 'tv').slice(0, 3);
  await Promise.all(
    needsNetwork.map(async (r) => {
      try {
        const detail = await tmdbFetch<any>(`tv/${r.tmdbId}?append_to_response=networks`);
        const network = detail.networks?.[0]?.name;
        if (network) {
          r.sub = r.sub.replace('TV Series', `TV Series · ${network}`);
        }
      } catch {
        // keep the subtitle without a network name
      }
    }),
  );

  return results.map(({ title, sub, img, rating, square, tmdbId, mediaType }) => ({
    title, sub, img, rating, square,
    externalId: String(tmdbId),
    mediaType,
  }));
}


async function searchBooks(query: string): Promise<SearchResult[]> {
  const data = await hardcoverQuery(
    `query SearchBooks($query: String!) {
      search(query: $query, query_type: "Book", per_page: 8, page: 1) {
        results
      }
    }`,
    { query },
  );
  const hits: any[] = data?.search?.results?.hits ?? [];
  return hits.map((hit) => {
    const doc = hit.document ?? {};
    const author = doc.author_names?.[0] ?? 'Unknown';
    const year = doc.release_year ? ` · ${doc.release_year}` : '';
    const genre = doc.genre_names?.[0] ?? null;
    return {
      title: doc.title ?? 'Untitled',
      sub: `${author}${year}${genre ? ` · ${genre}` : ''}`,
      img: doc.image?.url ?? null,
      rating: doc.rating ? String(doc.rating.toFixed(1)) : null,
      square: false,
      externalId: String(doc.id),
      mediaType: 'book',
    };
  });
}

export async function searchBookByIsbn(isbn: string): Promise<SearchResult | null> {
  const data = await hardcoverQuery(
    `query BookByIsbn($isbn: String!) {
      books(where: { isbns: { isbn_10: { _eq: $isbn } } }, limit: 1) {
        id title rating
        contributions { author { name } }
        default_physical_edition { image { url } release_year }
      }
    }`,
    { isbn },
  );
  const book = data?.books?.[0];
  if (!book) return null;
  const author = book.contributions?.[0]?.author?.name ?? 'Unknown';
  const year = book.default_physical_edition?.release_year ?? '';
  const genre = book.genre_names?.[0] ?? null;
  return {
    title: book.title,
    sub: `${author}${year ? ` · ${year}` : ''}${genre ? ` · ${genre}` : ''}`,
    img: book.default_physical_edition?.image?.url ?? null,
    rating: book.rating ? String(book.rating.toFixed(1)) : null,
    square: false,
    externalId: String(book.id),
    mediaType: 'book',
  };
}

export async function fetchBookPageCount(hardcoverBookId: string): Promise<number | null> {
  try {
    const data = await hardcoverQuery(
      `query BookPages($id: Int!) {
        books(where: { id: { _eq: $id } }, limit: 1) {
          default_physical_edition { pages }
        }
      }`,
      { id: parseInt(hardcoverBookId, 10) },
    );
    return data?.books?.[0]?.default_physical_edition?.pages ?? null;
  } catch {
    return null;
  }
}

async function searchGames(query: string): Promise<SearchResult[]> {
  const games = await igdbSearch(query);
  return games.map((g) => ({
    title: g.title,
    sub: `${g.genre ?? 'Game'}${g.year ? ` · ${g.year}` : ''}`,
    img: g.cover,
    rating: g.rating,
    square: false,
    externalId: String(g.id),
    mediaType: 'game',
  }));
}

let spotifyToken: string | null = null;
let spotifyTokenExpiresAt = 0;

export async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) return spotifyToken;
  const { data, error } = await supabase.functions.invoke<{ token: string }>('spotify-token');
  if (error || !data?.token) throw new Error(`Spotify token fetch failed: ${error}`);
  spotifyToken = data.token;
  // Edge function caches for ~59min; client caches for 55min to stay safely inside that
  spotifyTokenExpiresAt = Date.now() + 55 * 60 * 1000;
  return spotifyToken;
}

async function searchSpotifyAlbums(query: string): Promise<SearchResult[]> {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=8`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return ((data.albums?.items ?? []) as any[]).map((a) => ({
    title: a.name,
    sub: `${a.artists?.[0]?.name ?? ''} · Album${a.release_date ? ` · ${a.release_date.slice(0, 4)}` : ''}`,
    img: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
    rating: null,
    square: true,
    externalId: a.id as string,
    mediaType: 'album',
  }));
}

async function searchSpotifyPodcasts(query: string): Promise<SearchResult[]> {
  const token = await getSpotifyToken();
  const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=8`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return ((data.shows?.items ?? []) as any[]).map((s) => ({
    title: s.name,
    sub: `${s.publisher ?? ''} · Podcast`,
    img: s.images?.[1]?.url ?? s.images?.[0]?.url ?? null,
    rating: null,
    square: true,
    externalId: s.id as string,
    mediaType: 'podcast',
  }));
}

async function searchTMDBTV(query: string): Promise<SearchResult[]> {
  const data = await tmdbFetch(
    `search/tv?query=${encodeURIComponent(query)}&include_adult=false`,
  );
  const raw = ((data.results ?? []) as any[]).slice(0, 8);
  return raw
    .filter((r: any) => r.name)
    .map((r: any) => {
      const year = (r.first_air_date || '').slice(0, 4);
      return {
        title: r.name,
        sub: `TV Series${year ? ` · ${year}` : ''}`,
        img: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
        rating: r.vote_average ? r.vote_average.toFixed(1) : null,
        square: false,
        externalId: String(r.id),
        mediaType: 'tv',
      };
    });
}

async function searchByType(type: EntryType | 'tv', query: string): Promise<SearchResult[]> {
  switch (type) {
    case 'watch':
      return searchTMDB(query);
    case 'tv':
      return searchTMDBTV(query);
    case 'read':
      return searchBooks(query);
    case 'play':
      return searchGames(query);
    case 'listen':
      return searchSpotifyAlbums(query);
    case 'podcast':
      return searchSpotifyPodcasts(query);
  }
}

export function useTitleSearch(type: EntryType | 'tv' | null, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['title-search', type, trimmed],
    queryFn: () => searchByType(type!, trimmed),
    enabled: !!type && trimmed.length >= 2,
  });
}

export interface UniversalSearchResult extends SearchResult {
  entryType: EntryType;
}

// Lightweight content search for the Global feed search bar — returns results
// from TMDB (film/TV), Hardcover (books), and Spotify (music, podcasts) so
// users can navigate to a content room even with zero discussions.
export interface ContentSearchResult {
  title: string;
  poster: string | null;
  externalId: string;
  mediaType: string; // 'movie' | 'tv' | 'book' | 'album' | 'podcast'
  year: string | null;
}

export function useContentSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['content-search', trimmed],
    queryFn: async (): Promise<ContentSearchResult[]> => {
      const [tmdbRes, booksRes, albumsRes, podcastsRes] = await Promise.allSettled([
        // TMDB — movies & TV
        tmdbFetch<any>(`search/multi?query=${encodeURIComponent(trimmed)}&include_adult=false`),
        // Hardcover — books
        searchBooks(trimmed),
        // Spotify — albums / music
        searchSpotifyAlbums(trimmed),
        // Spotify — podcasts
        searchSpotifyPodcasts(trimmed),
      ]);

      const results: ContentSearchResult[] = [];

      // TMDB — deduplicate by externalId and by normalized title so movie/TV
      // variants of the same content don't both appear.
      if (tmdbRes.status === 'fulfilled') {
        const raw = ((tmdbRes.value.results ?? []) as any[])
          .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
          .slice(0, 8);
        const seenIds = new Set<string>();
        const seenTitles = new Set<string>();
        for (const r of raw) {
          const id = String(r.id);
          const title = (r.title ?? r.name ?? '').trim();
          const norm = title.toLowerCase();
          if (seenIds.has(id) || seenTitles.has(norm)) continue;
          seenIds.add(id);
          seenTitles.add(norm);
          results.push({
            title,
            poster: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
            externalId: id,
            mediaType: r.media_type,
            year: (r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null,
          });
          if (results.filter(r2 => r2.mediaType === 'movie' || r2.mediaType === 'tv').length >= 4) break;
        }
      }

      // Books
      if (booksRes.status === 'fulfilled') {
        for (const b of booksRes.value.slice(0, 3)) {
          if (!b.externalId) continue;
          results.push({ title: b.title, poster: b.img, externalId: b.externalId, mediaType: 'book', year: null });
        }
      }

      // Albums
      if (albumsRes.status === 'fulfilled') {
        for (const a of albumsRes.value.slice(0, 2)) {
          if (!a.externalId) continue;
          results.push({ title: a.title, poster: a.img, externalId: a.externalId, mediaType: 'album', year: null });
        }
      }

      // Podcasts
      if (podcastsRes.status === 'fulfilled') {
        for (const p of podcastsRes.value.slice(0, 2)) {
          if (!p.externalId) continue;
          results.push({ title: p.title, poster: p.img, externalId: p.externalId, mediaType: 'podcast', year: null });
        }
      }

      return results;
    },
    enabled: trimmed.length >= 2,
    staleTime: 60_000,
  });
}

export function useUniversalSearch(query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['universal-search', trimmed],
    queryFn: async (): Promise<UniversalSearchResult[]> => {
      const types: EntryType[] = ['watch', 'read', 'play', 'listen', 'podcast'];
      const settled = await Promise.allSettled(types.map((t) => searchByType(t, trimmed)));
      return settled.flatMap((res, i) =>
        res.status === 'fulfilled'
          ? res.value.slice(0, 3).map((r) => ({ ...r, entryType: types[i] }))
          : [],
      );
    },
    enabled: trimmed.length >= 2,
    staleTime: 30_000,
  });
}

export interface TvSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  poster: string | null;
  airDate: string | null;
}

export interface TvEpisode {
  episodeNumber: number;
  seasonNumber: number;
  name: string;
  airDate: string | null;
  stillPath: string | null;
  overview: string;
}

export function useTVSeasons(tmdbId: string | null) {
  return useQuery({
    queryKey: ['tv-seasons', tmdbId],
    queryFn: async () => {
      const data = await tmdbFetch<any>(`tv/${tmdbId}`);
      return (data.seasons as any[])
        .filter((s) => s.season_number > 0)
        .map((s) => ({
          seasonNumber: s.season_number,
          name: s.name,
          episodeCount: s.episode_count,
          poster: s.poster_path ? `https://image.tmdb.org/t/p/w185${s.poster_path}` : null,
          airDate: s.air_date ?? null,
        })) as TvSeason[];
    },
    enabled: !!tmdbId,
  });
}

export function useTVEpisodes(tmdbId: string | null, seasonNumber: number | null) {
  return useQuery({
    queryKey: ['tv-episodes', tmdbId, seasonNumber],
    queryFn: async () => {
      const data = await tmdbFetch<any>(`tv/${tmdbId}/season/${seasonNumber}`);
      return (data.episodes as any[]).map((e) => ({
        episodeNumber: e.episode_number,
        seasonNumber: e.season_number,
        name: e.name,
        airDate: e.air_date ?? null,
        stillPath: e.still_path ?? null,
        overview: e.overview ?? '',
      })) as TvEpisode[];
    },
    enabled: !!tmdbId && seasonNumber != null,
  });
}


/**
 * UPC barcodes (on DVD/Blu-ray/4K/CD/vinyl cases) don't map to TMDB or
 * Spotify directly, so this resolves the UPC to a product title + category
 * via upcitemdb's free lookup first — same two-hop approach retailers use,
 * no paid image-recognition API required.
 */
async function lookupUpc(upc: string): Promise<{ title: string; category: string } | null> {
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${upc}`);
    if (!res.ok) return null;
    const data = await res.json();
    const item = data.items?.[0];
    if (!item?.title) return null;
    return { title: item.title as string, category: (item.category as string) ?? '' };
  } catch {
    return null;
  }
}

function detectFormatFromText(text: string): CollectionFormat {
  const lower = text.toLowerCase();
  if (/4k|uhd/.test(lower)) return '4k';
  if (/blu-?ray/.test(lower)) return 'bluray';
  return 'dvd';
}

function detectMusicFormatFromText(text: string): CollectionFormat {
  return /vinyl|\blp\b|12"|record/i.test(text) ? 'vinyl' : 'cd';
}

/**
 * Single UPC lookup, routed to either the movie/TV or the music search based
 * on upcitemdb's product category (falls back to movie/TV when the category
 * is missing or ambiguous, matching prior behavior).
 */
export async function searchCollectionByUpc(
  upc: string,
): Promise<{ type: 'watch' | 'listen'; result: SearchResult; detectedFormat: CollectionFormat } | null> {
  const item = await lookupUpc(upc);
  if (!item) return null;
  const isMusic = /music|cd|vinyl|album|record/i.test(item.category) || /vinyl|\blp\b/i.test(item.title);

  if (isMusic) {
    const detectedFormat = detectMusicFormatFromText(item.title);
    // UPC product titles for albums are often retail listings like "Abbey
    // Road [Vinyl LP] - The Beatles" — strip the packaging noise so Spotify
    // search matches on the artist + album title instead.
    const cleaned = item.title
      .replace(/[\[(][^\])]*(vinyl|lp|cd|record|explicit)[^\])]*[\])]/gi, '')
      .replace(/\b(vinyl|lp|cd|explicit)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    const results = await searchSpotifyAlbums(cleaned || item.title);
    return results[0] ? { type: 'listen', result: results[0], detectedFormat } : null;
  }

  const detectedFormat = detectFormatFromText(item.title);
  // UPC product titles are often retail listings like "Inception (DVD, 2010)
  // Widescreen" — strip the packaging/edition noise so TMDB search matches.
  const cleaned = item.title
    .replace(/[\[(][^\])]*(dvd|blu-?ray|4k|uhd|widescreen|full\s*screen|region\s*\d)[^\])]*[\])]/gi, '')
    .replace(/\b(dvd|blu-?ray|4k uhd|4k|widescreen|full screen)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const results = await searchTMDB(cleaned || item.title);
  return results[0] ? { type: 'watch', result: results[0], detectedFormat } : null;
}
