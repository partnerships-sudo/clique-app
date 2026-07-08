import { Buffer } from 'buffer';
import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;
const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_KEY!;
const SPOTIFY_CLIENT_ID = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET!;

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
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}`, 'Content-Type': 'application/json' } },
  );
  const data = await res.json();
  const raw = (data.results ?? []).slice(0, 8) as any[];

  const results: (Omit<SearchResult, 'externalId' | 'mediaType'> & { tmdbId: number; mediaType: string })[] = raw
    .map((r) => {
      const isTV = r.media_type === 'tv';
      const year = (r.release_date || r.first_air_date || '').slice(0, 4);
      const sub = isTV ? `TV Series${year ? ` · ${year}` : ''}` : `Film${year ? ` · ${year}` : ''}`;
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
        const detail = await fetch(
          `https://api.themoviedb.org/3/tv/${r.tmdbId}?append_to_response=networks`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        ).then((res) => res.json());
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
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=8&key=${GOOGLE_BOOKS_KEY}`,
  );
  const data = await res.json();
  return ((data.items ?? []) as any[]).map((item) => {
    const info = item.volumeInfo ?? {};
    const publisher = info.publisher ? ` · ${info.publisher}` : '';
    return {
      title: info.title ?? 'Untitled',
      sub: `${info.authors?.[0] ?? 'Unknown'}${info.publishedDate ? ` · ${info.publishedDate.slice(0, 4)}` : ''}${publisher}`,
      img: info.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      rating: info.averageRating ? info.averageRating.toFixed(1) : null,
      square: false,
      externalId: item.id as string,
      mediaType: 'book',
    };
  });
}

async function searchGames(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(query)}&page_size=8`,
  );
  const data = await res.json();
  return ((data.results ?? []) as any[]).map((g) => ({
    title: g.name,
    sub: `${g.genres?.[0]?.name ?? 'Game'}${g.released ? ` · ${g.released.slice(0, 4)}` : ''}`,
    img: g.background_image ?? null,
    rating: g.rating ? g.rating.toFixed(1) : null,
    square: true,
    externalId: String(g.id),
    mediaType: 'game',
  }));
}

let spotifyToken: string | null = null;
let spotifyTokenExpiresAt = 0;

export async function getSpotifyToken(): Promise<string> {
  if (spotifyToken && Date.now() < spotifyTokenExpiresAt) return spotifyToken;
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  spotifyToken = data.access_token;
  spotifyTokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
  return spotifyToken!;
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

async function searchByType(type: EntryType, query: string): Promise<SearchResult[]> {
  switch (type) {
    case 'watch':
      return searchTMDB(query);
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

export function useTitleSearch(type: EntryType | null, query: string) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['title-search', type, trimmed],
    queryFn: () => searchByType(type!, trimmed),
    enabled: !!type && trimmed.length >= 2,
  });
}
