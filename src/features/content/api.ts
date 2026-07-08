import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_KEY!;
const BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;

export interface ContentDetails {
  overview: string;
  cast: { name: string; character: string; profilePath: string | null }[];
  rating: string | null;
  year: string | null;
  genre: string | null;
  runtime: string | null;
  trailerUrl: string | null;
  trailerThumbnail: string | null;
}

const EMPTY_DETAILS: ContentDetails = {
  overview: '',
  cast: [],
  rating: null,
  year: null,
  genre: null,
  runtime: null,
  trailerUrl: null,
  trailerThumbnail: null,
};

function pickYouTubeTrailer(videos: any[]): { url: string; thumbnail: string } | null {
  const trailers = videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const best = trailers.find((v) => v.official) ?? trailers[0];
  if (!best) return null;
  return {
    url: `https://www.youtube.com/watch?v=${best.key}`,
    thumbnail: `https://img.youtube.com/vi/${best.key}/hqdefault.jpg`,
  };
}

async function fetchWatchDetails(title: string): Promise<ContentDetails> {
  // Multi-search picks up both movies and TV shows
  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  const searchData = await searchRes.json();
  const hit = (searchData.results ?? []).find(
    (r: any) => r.media_type === 'movie' || r.media_type === 'tv',
  );
  if (!hit) return EMPTY_DETAILS;

  const endpoint = hit.media_type === 'movie' ? 'movie' : 'tv';
  const detailRes = await fetch(
    `https://api.themoviedb.org/3/${endpoint}/${hit.id}?append_to_response=credits,videos&language=en-US`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  const detail = await detailRes.json();

  const year = (detail.release_date || detail.first_air_date || '').slice(0, 4) || null;
  const genre = ((detail.genres ?? []) as any[]).map((g) => g.name).slice(0, 2).join(', ') || null;
  const runtime = detail.runtime
    ? `${detail.runtime}min`
    : detail.episode_run_time?.[0]
      ? `${detail.episode_run_time[0]}min/ep`
      : null;

  const trailer = pickYouTubeTrailer(detail.videos?.results ?? []);

  return {
    overview: detail.overview ?? '',
    cast: ((detail.credits?.cast ?? []) as any[]).slice(0, 10).map((c: any) => ({
      name: c.name as string,
      character: (c.character ?? c.roles?.[0]?.character ?? '') as string,
      profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    })),
    rating: detail.vote_average ? detail.vote_average.toFixed(1) : null,
    year,
    genre,
    runtime,
    trailerUrl: trailer?.url ?? null,
    trailerThumbnail: trailer?.thumbnail ?? null,
  };
}

async function fetchGameDetails(title: string): Promise<ContentDetails> {
  const searchRes = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
  );
  const searchData = await searchRes.json();
  const game = searchData.results?.[0];
  if (!game) return EMPTY_DETAILS;

  const detailRes = await fetch(`https://api.rawg.io/api/games/${game.id}?key=${RAWG_KEY}`);
  const detail = await detailRes.json();

  return {
    overview: detail.description_raw ?? '',
    cast: [],
    rating: detail.rating ? detail.rating.toFixed(1) : null,
    year: detail.released ? detail.released.slice(0, 4) : null,
    genre: detail.genres?.[0]?.name ?? null,
    runtime: detail.playtime ? `${detail.playtime}h avg playtime` : null,
    trailerUrl: null,
    trailerThumbnail: null,
  };
}

async function fetchBookDetails(title: string): Promise<ContentDetails> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${BOOKS_KEY}`,
  );
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return EMPTY_DETAILS;

  return {
    overview: info.description ?? '',
    cast: [],
    rating: info.averageRating ? info.averageRating.toFixed(1) : null,
    year: info.publishedDate ? info.publishedDate.slice(0, 4) : null,
    genre: info.categories?.[0] ?? null,
    runtime: info.pageCount ? `${info.pageCount} pages` : null,
    trailerUrl: null,
    trailerThumbnail: null,
  };
}

const SUPPORTED_TYPES: EntryType[] = ['watch', 'play', 'read'];

export function useContentDetails(title: string | undefined, type: EntryType | undefined) {
  return useQuery({
    queryKey: ['content-details', type, title],
    queryFn: async (): Promise<ContentDetails | null> => {
      if (!title || !type) return null;
      switch (type) {
        case 'watch':
          return fetchWatchDetails(title);
        case 'play':
          return fetchGameDetails(title);
        case 'read':
          return fetchBookDetails(title);
        default:
          return null;
      }
    },
    enabled: !!title && !!type && SUPPORTED_TYPES.includes(type as EntryType),
    staleTime: 60 * 60 * 1000,
  });
}
