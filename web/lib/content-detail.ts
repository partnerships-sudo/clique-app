// Content detail — TMDB, Google Books, Spotify data for the detail modal

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY!;
const GOOGLE_BOOKS_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY!;

export interface CastMember {
  name: string;
  character: string;
  photo: string | null;
}

export interface WatchProvider {
  name: string;
  logo: string;
  type: 'flatrate' | 'rent' | 'buy' | 'free';
}

export interface ContentDetail {
  type: 'watch' | 'read' | 'listen' | 'podcast';
  title: string;
  poster: string | null;
  backdrop: string | null;
  overview: string | null;
  year: string | null;
  rating: number | null; // 0–10 TMDB or 0–5 goodreads
  ratingLabel: string | null;
  genres: string[];
  cast: CastMember[];
  providers: WatchProvider[];
  // Books
  author: string | null;
  pageCount: number | null;
  publisher: string | null;
  categories: string[];
  // Links
  tmdbUrl: string | null;
  imdbUrl: string | null;
}

// ── TMDB ──────────────────────────────────────────────────────────────────────

export async function fetchTmdbDetail(
  externalId: string | null,
  title: string,
  mediaType: string | null,
): Promise<ContentDetail> {
  let id = externalId;
  let mType: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';

  // Resolve by search if no ID
  if (!id) {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false`,
      { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
    );
    const data = await res.json();
    const hit = (data.results ?? []).find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (hit) { id = String(hit.id); mType = hit.media_type; }
  }

  if (!id) {
    return blankDetail('watch', title);
  }

  const [detailRes, creditsRes, providersRes] = await Promise.all([
    fetch(`https://api.themoviedb.org/3/${mType}/${id}?append_to_response=external_ids`, {
      headers: { Authorization: `Bearer ${TMDB_KEY}` },
    }),
    fetch(`https://api.themoviedb.org/3/${mType}/${id}/credits`, {
      headers: { Authorization: `Bearer ${TMDB_KEY}` },
    }),
    fetch(`https://api.themoviedb.org/3/${mType}/${id}/watch/providers`, {
      headers: { Authorization: `Bearer ${TMDB_KEY}` },
    }),
  ]);

  const d = detailRes.ok ? await detailRes.json() : {};
  const c = creditsRes.ok ? await creditsRes.json() : {};
  const wp = providersRes.ok ? await providersRes.json() : {};

  const cast: CastMember[] = ((c.cast ?? []) as any[]).slice(0, 12).map((m: any) => ({
    name: m.name,
    character: m.character,
    photo: m.profile_path ? `https://image.tmdb.org/t/p/w185${m.profile_path}` : null,
  }));

  // Pick US providers; fall back to any country
  const countryProviders = wp.results?.US ?? Object.values(wp.results ?? {})[0] ?? {};
  const providers: WatchProvider[] = [
    ...buildProviders(countryProviders.flatrate, 'flatrate'),
    ...buildProviders(countryProviders.free, 'free'),
    ...buildProviders(countryProviders.rent, 'rent'),
    ...buildProviders(countryProviders.buy, 'buy'),
  ];

  const imdbId = d.external_ids?.imdb_id ?? d.imdb_id;
  const releaseDate = d.release_date ?? d.first_air_date ?? '';
  const genres = (d.genres ?? []).map((g: any) => g.name).slice(0, 3);
  const tmdbScore = d.vote_average ? Math.round(d.vote_average * 10) / 10 : null;

  return {
    type: 'watch',
    title: d.title ?? d.name ?? title,
    poster: d.poster_path ? `https://image.tmdb.org/t/p/w342${d.poster_path}` : null,
    backdrop: d.backdrop_path ? `https://image.tmdb.org/t/p/w780${d.backdrop_path}` : null,
    overview: d.overview || null,
    year: releaseDate.slice(0, 4) || null,
    rating: tmdbScore,
    ratingLabel: tmdbScore ? `${tmdbScore}/10 TMDB` : null,
    genres,
    cast,
    providers,
    author: null,
    pageCount: null,
    publisher: null,
    categories: [],
    tmdbUrl: `https://www.themoviedb.org/${mType}/${id}`,
    imdbUrl: imdbId ? `https://www.imdb.com/title/${imdbId}` : null,
  };
}

function buildProviders(list: any[] | undefined, type: WatchProvider['type']): WatchProvider[] {
  if (!list) return [];
  return list.slice(0, 6).map((p: any) => ({
    name: p.provider_name,
    logo: `https://image.tmdb.org/t/p/original${p.logo_path}`,
    type,
  }));
}

// ── Google Books ──────────────────────────────────────────────────────────────

export async function fetchBookDetail(
  externalId: string | null,
  title: string,
): Promise<ContentDetail> {
  let volumeId = externalId;

  if (!volumeId) {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${GOOGLE_BOOKS_KEY}`,
    );
    const data = await res.json();
    volumeId = data.items?.[0]?.id ?? null;
  }

  if (!volumeId) return blankDetail('read', title);

  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes/${volumeId}?key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!res.ok) return blankDetail('read', title);
  const data = await res.json();
  const vi = data.volumeInfo ?? {};

  const rating = vi.averageRating ?? null;

  return {
    type: 'read',
    title: vi.title ?? title,
    poster: vi.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
    backdrop: null,
    overview: vi.description ? stripHtml(vi.description) : null,
    year: vi.publishedDate?.slice(0, 4) ?? null,
    rating,
    ratingLabel: rating ? `${rating}/5 Google Books` : null,
    genres: [],
    cast: [],
    providers: [],
    author: (vi.authors ?? []).join(', ') || null,
    pageCount: vi.pageCount ?? null,
    publisher: vi.publisher ?? null,
    categories: (vi.categories ?? []).slice(0, 3),
    tmdbUrl: null,
    imdbUrl: null,
  };
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Fallback ──────────────────────────────────────────────────────────────────

function blankDetail(type: ContentDetail['type'], title: string): ContentDetail {
  return {
    type, title, poster: null, backdrop: null, overview: null,
    year: null, rating: null, ratingLabel: null, genres: [],
    cast: [], providers: [], author: null, pageCount: null,
    publisher: null, categories: [], tmdbUrl: null, imdbUrl: null,
  };
}
