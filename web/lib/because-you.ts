import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY!;
const GOOGLE_BOOKS_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY!;
const SPOTIFY_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const SPOTIFY_SECRET = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET!;

export interface RecItem {
  title: string;
  sub: string | null;
  poster: string | null;
  type: string;
  externalId: string | null;
  mediaType?: string;
}

export interface BecauseYouRow {
  seedTitle: string;
  type: string;
  verb: string;
  items: RecItem[];
}

// ── Seed: pick highest-rated (or most recent) per type ────────────────────────
async function fetchSeeds(userId: string): Promise<Array<{ title: string; type: string; external_id: string | null; media_type: string | null }>> {
  const { data } = await supabase
    .from('posts')
    .select('title, type, external_id, media_type, rating, created_at')
    .eq('user_id', userId)
    .in('type', ['watch', 'read', 'listen', 'podcast'])
    .order('rating', { ascending: false, nullsFirst: false })
    .limit(60);

  if (!data?.length) return [];

  // Pick best (highest rated → most recent) per type
  const seen = new Set<string>();
  const seeds: typeof data = [];
  for (const row of data) {
    if (!seen.has(row.type)) {
      seen.add(row.type);
      seeds.push(row);
    }
  }
  return seeds;
}

// ── TMDB recommendations ──────────────────────────────────────────────────────
async function tmdbRecs(title: string, externalId: string | null, mediaType: string | null): Promise<RecItem[]> {
  let id = externalId;
  let mType: 'movie' | 'tv' = mediaType === 'tv' ? 'tv' : 'movie';

  if (!id) {
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&include_adult=false&page=1`,
      { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    const first = (data.results ?? []).find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!first) return [];
    id = String(first.id);
    mType = first.media_type as 'movie' | 'tv';
  }

  const res = await fetch(
    `https://api.themoviedb.org/3/${mType}/${id}/recommendations?page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();

  return ((data.results ?? []) as any[]).slice(0, 18).flatMap((r: any) => {
    const t: string = r.title || r.name;
    if (!t) return [];
    const isTV = !r.title;
    const year = (r.release_date || r.first_air_date || '').slice(0, 4);
    return [{
      title: t,
      sub: `${isTV ? 'TV Series' : 'Film'}${year ? ` · ${year}` : ''}`,
      type: 'watch',
      poster: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
      externalId: String(r.id),
      mediaType: isTV ? 'tv' : 'movie',
    }];
  });
}

// ── Google Books recommendations ──────────────────────────────────────────────
async function bookRecs(title: string): Promise<RecItem[]> {
  // Get the book's categories, then search for similar
  const searchRes = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const first = searchData.items?.[0];
  const categories: string[] = first?.volumeInfo?.categories ?? [];
  const authors: string[] = first?.volumeInfo?.authors ?? [];

  // Search by first category or author
  const query = categories[0]
    ? `subject:${encodeURIComponent(categories[0])}`
    : authors[0]
    ? `inauthor:${encodeURIComponent(authors[0])}`
    : title;

  const recRes = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=20&orderBy=relevance&key=${GOOGLE_BOOKS_KEY}`,
  );
  if (!recRes.ok) return [];
  const recData = await recRes.json();

  const titleLower = title.toLowerCase();
  const seen = new Set<string>([titleLower]);

  return ((recData.items ?? []) as any[]).flatMap((item: any) => {
    const vi = item.volumeInfo;
    const t: string = vi?.title ?? '';
    const tl = t.toLowerCase();
    if (!t || seen.has(tl)) return [];
    seen.add(tl);
    const thumb = vi.imageLinks?.thumbnail ?? vi.imageLinks?.smallThumbnail ?? null;
    const author = vi.authors?.[0] ?? null;
    return [{
      title: t,
      sub: author ?? null,
      type: 'read',
      poster: thumb ? thumb.replace('http:', 'https:') : null,
      externalId: item.id ?? null,
    }];
  }).slice(0, 15);
}

// ── Spotify recommendations ───────────────────────────────────────────────────
let _spotifyToken: { token: string; expires: number } | null = null;

async function getSpotifyToken(): Promise<string | null> {
  if (_spotifyToken && Date.now() < _spotifyToken.expires) return _spotifyToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${SPOTIFY_ID}&client_secret=${SPOTIFY_SECRET}`,
  });
  if (!res.ok) return null;
  const data = await res.json();
  _spotifyToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function musicRecs(title: string, type: 'listen' | 'podcast'): Promise<RecItem[]> {
  const token = await getSpotifyToken();
  if (!token) return [];

  if (type === 'podcast') {
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(title)}&type=show&limit=12`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.shows?.items ?? []) as any[]).flatMap((s: any) => {
      if (!s?.name) return [];
      return [{
        title: s.name,
        sub: s.publisher ?? null,
        type: 'podcast',
        poster: s.images?.[0]?.url ?? null,
        externalId: s.id,
      }];
    }).slice(0, 12);
  }

  // Music: find the artist then get their related artists' top tracks
  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(title)}&type=track&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!searchRes.ok) return [];
  const searchData = await searchRes.json();
  const track = searchData.tracks?.items?.[0];
  if (!track) return [];

  const artistId = track.artists?.[0]?.id;
  if (!artistId) return [];

  const relRes = await fetch(
    `https://api.spotify.com/v1/artists/${artistId}/related-artists`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!relRes.ok) return [];
  const relData = await relRes.json();

  return ((relData.artists ?? []) as any[]).slice(0, 15).flatMap((a: any) => {
    if (!a?.name) return [];
    return [{
      title: a.name,
      sub: `${a.followers?.total ? `${(a.followers.total / 1000).toFixed(0)}k listeners` : 'Artist'}`,
      type: 'listen',
      poster: a.images?.[0]?.url ?? null,
      externalId: a.id,
    }];
  });
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useBecauseYou() {
  return useQuery({
    queryKey: ['web-because-you'],
    queryFn: async (): Promise<BecauseYouRow[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const seeds = await fetchSeeds(user.id);
      if (!seeds.length) return [];

      const VERBS: Record<string, string> = {
        watch: 'watched', read: 'read', listen: 'listened to', podcast: 'listened to',
      };

      const rows = await Promise.allSettled(
        seeds.map(async (seed) => {
          let items: RecItem[] = [];
          if (seed.type === 'watch') items = await tmdbRecs(seed.title, seed.external_id, seed.media_type);
          else if (seed.type === 'read') items = await bookRecs(seed.title);
          else if (seed.type === 'listen') items = await musicRecs(seed.title, 'listen');
          else if (seed.type === 'podcast') items = await musicRecs(seed.title, 'podcast');
          if (!items.length) return null;
          return {
            seedTitle: seed.title,
            type: seed.type,
            verb: VERBS[seed.type] ?? 'logged',
            items,
          } as BecauseYouRow;
        })
      );

      return rows
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((r): r is BecauseYouRow => r !== null && r.items.length > 0);
    },
    staleTime: 5 * 60_000,
  });
}
