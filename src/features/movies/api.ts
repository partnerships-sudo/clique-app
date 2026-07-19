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
  trailerUrl: string | null;
  trailerThumbnail: string | null;
}

export function useCinemaDetails(tmdbId: string | undefined) {
  return useQuery({
    queryKey: ['cinema-details', tmdbId],
    queryFn: async () => {
      const res = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?append_to_response=credits,videos`,
        { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
      );
      if (!res.ok) throw new Error(`TMDB error: ${res.status}`);
      const data = await res.json();
      const trailer = ((data.videos?.results ?? []) as any[]).find(
        (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
      ) ?? ((data.videos?.results ?? []) as any[]).find((v) => v.site === 'YouTube');
      return {
        overview: data.overview ?? '',
        cast: ((data.credits?.cast ?? []) as any[]).slice(0, 4).map((c) => ({
          name: c.name as string,
          character: c.character as string,
          profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
        })),
        trailerUrl: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null,
        trailerThumbnail: trailer ? `https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg` : null,
      } as CinemaDetails;
    },
    enabled: !!tmdbId,
    staleTime: 60 * 60 * 1000,
  });
}

export interface BoxOfficeEntry {
  id: number;
  title: string;
  poster: string | null;
  revenue: number;
  releaseDate: string;
  weeksInTheater: number;
}

export interface MovieTrailer {
  movieId: number;
  movieTitle: string;
  poster: string | null;
  youtubeKey: string;
}

export function useMovieTrailers(movies: { id: number; title: string; poster: string | null }[]) {
  return useQuery({
    queryKey: ['movie-trailers', movies.map((m) => m.id).sort().join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        movies.map(async (m) => {
          const res = await fetch(`https://api.themoviedb.org/3/movie/${m.id}/videos?language=en-US`, {
            headers: { Authorization: `Bearer ${TMDB_KEY}` },
          });
          if (!res.ok) return null;
          const data = await res.json();
          const trailer = ((data.results ?? []) as any[]).find(
            (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser') && v.official,
          ) ?? ((data.results ?? []) as any[]).find((v) => v.site === 'YouTube');
          if (!trailer) return null;
          return { movieId: m.id, movieTitle: m.title, poster: m.poster, youtubeKey: trailer.key } as MovieTrailer;
        }),
      );
      return results.filter(Boolean) as MovieTrailer[];
    },
    enabled: movies.length > 0,
    staleTime: 60 * 60 * 1000,
  });
}

export function useBoxOfficeTop10() {
  return useQuery({
    queryKey: ['movies', 'box_office_top10'],
    queryFn: async () => {
      const today = new Date();
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      const TWENTY_WEEKS_MS = 20 * ONE_WEEK_MS;
      const sevenDaysAgo = new Date(today.getTime() - ONE_WEEK_MS).toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      // now_playing covers the established box office; discover covers brand-new
      // releases that may not have propagated to now_playing yet.
      const [np1, np2, recent] = await Promise.all([
        fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1', { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
        fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=2', { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
        fetch(`https://api.themoviedb.org/3/discover/movie?primary_release_date.gte=${sevenDaysAgo}&primary_release_date.lte=${todayStr}&sort_by=popularity.desc&language=en-US&page=1`, { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
      ]);

      const seen = new Set<number>();
      const candidates = [...(np1.results ?? []), ...(np2.results ?? []), ...(recent.results ?? [])] as any[];
      const movies = candidates
        .filter((m) => m.release_date && m.poster_path && !seen.has(m.id) && seen.add(m.id))
        .slice(0, 35);

      // Fetch individual details to get the revenue field
      const details = await Promise.all(
        movies.map((m) =>
          fetch(`https://api.themoviedb.org/3/movie/${m.id}`, { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
        ),
      );

      return details
        .filter((d) => {
          const age = today.getTime() - new Date(d.release_date).getTime();
          if (age <= 0 || age > TWENTY_WEEKS_MS) return false;
          const isNew = age <= ONE_WEEK_MS;
          return isNew || d.revenue > 0;
        })
        .map((d) => ({
          id: d.id,
          title: d.title,
          poster: d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : null,
          revenue: (d.revenue ?? 0) as number,
          releaseDate: d.release_date as string,
          weeksInTheater: Math.max(1, Math.ceil((today.getTime() - new Date(d.release_date).getTime()) / ONE_WEEK_MS)),
        }))
        .sort((a, b) => b.revenue / b.weeksInTheater - a.revenue / a.weeksInTheater)
        .slice(0, 10) as BoxOfficeEntry[];
    },
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
