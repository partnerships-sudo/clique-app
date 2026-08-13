export type SearchResult = {
  title: string;
  sub: string;
  img: string | null;
  externalId: string | null;
  mediaType: string | null;
  rating: string | null;
  type: 'watch' | 'read' | 'play' | 'listen' | 'podcast';
};

const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY!;
const GOOGLE_BOOKS_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY!;
const HARDCOVER_TOKEN = process.env.NEXT_PUBLIC_HARDCOVER_TOKEN!;
const SPOTIFY_CLIENT_ID = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID!;
const SPOTIFY_CLIENT_SECRET = process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_SECRET!;

async function searchTMDB(query: string, type: 'watch'): Promise<SearchResult[]> {
  const res = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(query)}&include_adult=false`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  const data = await res.json();
  return (data.results ?? [])
    .filter((r: any) => r.media_type === 'movie' || r.media_type === 'tv')
    .slice(0, 12)
    .map((r: any) => ({
      title: r.title ?? r.name ?? '',
      sub: r.release_date?.slice(0, 4) ?? r.first_air_date?.slice(0, 4) ?? '',
      img: r.poster_path ? `https://image.tmdb.org/t/p/w185${r.poster_path}` : null,
      externalId: String(r.id),
      mediaType: r.media_type,
      rating: r.vote_average ? String(r.vote_average.toFixed(1)) : null,
      type,
    }));
}

async function searchBooks(query: string): Promise<SearchResult[]> {
  // Try Hardcover first
  try {
    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HARDCOVER_TOKEN}`,
      },
      body: JSON.stringify({
        query: `query Search($q: String!) {
          search(query: $q, query_type: "Book", per_page: 10) {
            results
          }
        }`,
        variables: { q: query },
      }),
    });
    const data = await res.json();
    const hits = data?.data?.search?.results?.hits ?? [];
    if (hits.length > 0) {
      return hits.map((h: any) => {
        const doc = h.document ?? h;
        return {
          title: doc.title ?? '',
          sub: doc.author_names?.[0] ?? doc.contributions?.[0]?.author?.name ?? '',
          img: doc.image?.url ?? doc.cover_url ?? null,
          externalId: String(doc.id ?? ''),
          mediaType: 'book',
          rating: doc.rating ? String(Number(doc.rating).toFixed(1)) : null,
          type: 'read' as const,
        };
      });
    }
  } catch {}

  // Fallback to Google Books
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${GOOGLE_BOOKS_KEY}`,
  );
  const data = await res.json();
  return (data.items ?? []).map((item: any) => {
    const v = item.volumeInfo;
    return {
      title: v.title ?? '',
      sub: (v.authors ?? []).join(', '),
      img: v.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      externalId: item.id,
      mediaType: 'book',
      rating: v.averageRating ? String(v.averageRating) : null,
      type: 'read' as const,
    };
  });
}

let _spotifyToken: { token: string; expires: number } | null = null;
async function getSpotifyToken(): Promise<string> {
  if (_spotifyToken && Date.now() < _spotifyToken.expires) return _spotifyToken.token;
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`)}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  _spotifyToken = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function searchMusic(query: string): Promise<SearchResult[]> {
  const token = await getSpotifyToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  return (data.albums?.items ?? []).map((a: any) => ({
    title: a.name ?? '',
    sub: a.artists?.map((x: any) => x.name).join(', ') ?? '',
    img: a.images?.[1]?.url ?? a.images?.[0]?.url ?? null,
    externalId: a.id,
    mediaType: 'album',
    rating: null,
    type: 'listen' as const,
  }));
}

async function searchPodcasts(query: string): Promise<SearchResult[]> {
  const token = await getSpotifyToken();
  const res = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=show&limit=10`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  return (data.shows?.items ?? []).map((s: any) => ({
    title: s.name ?? '',
    sub: s.publisher ?? '',
    img: s.images?.[1]?.url ?? s.images?.[0]?.url ?? null,
    externalId: s.id,
    mediaType: 'podcast',
    rating: null,
    type: 'podcast' as const,
  }));
}

export async function searchContent(query: string, type: 'watch' | 'read' | 'listen' | 'podcast'): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  switch (type) {
    case 'watch': return searchTMDB(query, 'watch');
    case 'read': return searchBooks(query);
    case 'listen': return searchMusic(query);
    case 'podcast': return searchPodcasts(query);
  }
}
