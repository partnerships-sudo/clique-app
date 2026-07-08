import { useQuery } from '@tanstack/react-query';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;

export interface NowAndComingMovie {
  id: number;
  title: string;
  poster: string | null;
  releaseDate: string;
}

async function fetchNowPlaying(): Promise<NowAndComingMovie[]> {
  const res = await fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1', {
    headers: { Authorization: `Bearer ${TMDB_KEY}` },
  });
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  const data = await res.json();

  return ((data.results ?? []) as any[])
    .filter((m) => m.release_date && m.poster_path)
    .map((m) => ({
      id: m.id,
      title: m.title,
      poster: `https://image.tmdb.org/t/p/w185${m.poster_path}`,
      releaseDate: m.release_date,
    }));
}

async function fetchUpcoming(): Promise<NowAndComingMovie[]> {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch by popularity so only big/anticipated films appear, then sort
  // client-side by release date so the soonest ones show first in the row.
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&primary_release_date.gte=${today}&with_original_language=en&sort_by=popularity.desc&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
  const data = await res.json();

  return ((data.results ?? []) as any[])
    .filter((m) => m.release_date && m.poster_path)
    .map((m) => ({
      id: m.id,
      title: m.title,
      poster: `https://image.tmdb.org/t/p/w185${m.poster_path}`,
      releaseDate: m.release_date,
    }))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
}

export interface CinemaDetails {
  overview: string;
  cast: { name: string; character: string; profilePath: string | null }[];
}

export function useCinemaDetails(tmdbId: string | undefined) {
  return useQuery({
    queryKey: ['cinema-details', tmdbId],
    queryFn: async () => {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits`,
        { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
      );
      if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
      const data = await res.json();
      return {
        overview: data.overview ?? '',
        cast: ((data.credits?.cast ?? []) as any[]).slice(0, 4).map((c) => ({
          name: c.name as string,
          character: c.character as string,
          profilePath: c.profile_path
            ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
            : null,
        })),
      } as CinemaDetails;
    },
    enabled: !!tmdbId,
    staleTime: 60 * 60 * 1000,
  });
}

export function useNowPlayingMovies() {
  return useQuery({
    queryKey: ['movies', 'now_playing'],
    queryFn: fetchNowPlaying,
    staleTime: 30 * 60 * 1000,
  });
}

export function useUpcomingMovies() {
  return useQuery({
    queryKey: ['movies', 'upcoming'],
    queryFn: fetchUpcoming,
    staleTime: 30 * 60 * 1000,
  });
}
