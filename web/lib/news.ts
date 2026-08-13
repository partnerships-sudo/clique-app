import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

const GUARDIAN_KEY = process.env.NEXT_PUBLIC_GUARDIAN_API_KEY!;
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY!;

export type NewsFilter = 'all' | 'watch' | 'read' | 'play' | 'listen' | 'podcast';

export interface NewsArticle {
  id: string;
  title: string;
  trailText: string;
  thumbnail: string | null;
  byline: string | null;
  section: string;
  publishedAt: string;
  url: string;
}

// ── Guardian ──────────────────────────────────────────────────────────────────

const GUARDIAN_SECTIONS: Record<string, string> = {
  watch: 'film|tv-and-radio',
  read: 'books',
  play: 'games',
  listen: 'music',
  podcast: 'tv-and-radio',
  all: 'film|tv-and-radio|books|games|music',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function fetchGuardian(filter: NewsFilter): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      'api-key': GUARDIAN_KEY,
      'show-fields': 'thumbnail,trailText,byline',
      'page-size': '30',
      'order-by': 'newest',
      section: GUARDIAN_SECTIONS[filter] ?? 'film|tv-and-radio|books|games|music',
    });
    if (filter === 'podcast') { params.delete('section'); params.set('tag', 'type/podcast'); }
    const res = await fetch(`https://content.guardianapis.com/search?${params}`);
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.response?.results ?? []) as any[]).map((r: any) => ({
      id: `guardian-${r.id}`,
      title: r.webTitle,
      trailText: stripHtml(r.fields?.trailText ?? ''),
      thumbnail: r.fields?.thumbnail ?? null,
      byline: r.fields?.byline ?? null,
      section: r.sectionName,
      publishedAt: r.webPublicationDate,
      url: r.webUrl,
    }));
  } catch { return []; }
}

const NEWSAPI_QUERIES: Record<NewsFilter, string> = {
  all: 'movies OR television OR books OR gaming OR music',
  watch: 'movies OR film OR television OR TV shows',
  read: 'books OR novels OR literature OR publishing',
  play: 'video games OR gaming OR PlayStation OR Xbox OR Nintendo',
  listen: 'music OR albums OR artists OR concerts',
  podcast: 'podcast OR podcasting',
};

async function fetchNewsAPI(filter: NewsFilter): Promise<NewsArticle[]> {
  try {
    const { data, error } = await supabase.functions.invoke('news-proxy', {
      body: { q: NEWSAPI_QUERIES[filter], pageSize: 20, sortBy: 'publishedAt' },
    });
    if (error || !data) return [];
    return ((data.articles ?? []) as any[])
      .filter((a: any) => a.title && a.title !== '[Removed]' && a.urlToImage)
      .map((a: any) => ({
        id: `newsapi-${a.url}`,
        title: a.title,
        trailText: a.description ?? '',
        thumbnail: a.urlToImage ?? null,
        byline: a.author ?? a.source?.name ?? null,
        section: a.source?.name ?? 'News',
        publishedAt: a.publishedAt,
        url: a.url,
      }));
  } catch { return []; }
}

async function fetchNews(filter: NewsFilter): Promise<NewsArticle[]> {
  const [guardian, newsapi] = await Promise.all([fetchGuardian(filter), fetchNewsAPI(filter)]);
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const a of [...guardian, ...newsapi]) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seen.has(key)) { seen.add(key); merged.push(a); }
  }
  return merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function useNewsArticles(filter: NewsFilter) {
  return useQuery({
    queryKey: ['web-news', filter],
    queryFn: () => fetchNews(filter),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });
}

// ── Cinema: Now Playing, Upcoming, Box Office ─────────────────────────────────

export interface CinemaMovie {
  id: number;
  title: string;
  poster: string | null;
  releaseDate: string;
}

export interface BoxOfficeEntry extends CinemaMovie {
  revenue: number;
  weeksInTheater: number;
}

async function fetchNowPlaying(): Promise<CinemaMovie[]> {
  const res = await fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1', {
    headers: { Authorization: `Bearer ${TMDB_KEY}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.results ?? []) as any[])
    .filter((m) => m.release_date && m.poster_path)
    .map((m) => ({ id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w185${m.poster_path}`, releaseDate: m.release_date }));
}

async function fetchUpcoming(): Promise<CinemaMovie[]> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(
    `https://api.themoviedb.org/3/discover/movie?include_adult=false&language=en-US&primary_release_date.gte=${today}&with_original_language=en&sort_by=popularity.desc&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return ((data.results ?? []) as any[])
    .filter((m) => m.release_date && m.poster_path)
    .map((m) => ({ id: m.id, title: m.title, poster: `https://image.tmdb.org/t/p/w185${m.poster_path}`, releaseDate: m.release_date }))
    .sort((a, b) => a.releaseDate.localeCompare(b.releaseDate));
}

async function fetchBoxOffice(): Promise<BoxOfficeEntry[]> {
  const today = new Date();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = new Date(today.getTime() - ONE_WEEK_MS).toISOString().slice(0, 10);
  const todayStr = today.toISOString().slice(0, 10);

  const [np1, np2, recent] = await Promise.all([
    fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=1', { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
    fetch('https://api.themoviedb.org/3/movie/now_playing?language=en-US&page=2', { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
    fetch(`https://api.themoviedb.org/3/discover/movie?primary_release_date.gte=${sevenDaysAgo}&primary_release_date.lte=${todayStr}&sort_by=popularity.desc&language=en-US&page=1`, { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json()),
  ]);

  const seen = new Set<number>();
  const candidates = [...(np1.results ?? []), ...(np2.results ?? []), ...(recent.results ?? [])] as any[];
  const movies = candidates.filter((m) => m.release_date && m.poster_path && !seen.has(m.id) && seen.add(m.id)).slice(0, 30);

  const details = await Promise.all(
    movies.map((m) => fetch(`https://api.themoviedb.org/3/movie/${m.id}`, { headers: { Authorization: `Bearer ${TMDB_KEY}` } }).then((r) => r.json())),
  );

  return details
    .filter((d) => {
      const age = today.getTime() - new Date(d.release_date).getTime();
      return age > 0 && age <= 20 * ONE_WEEK_MS && (age <= ONE_WEEK_MS || d.revenue > 0);
    })
    .map((d) => ({
      id: d.id,
      title: d.title,
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w185${d.poster_path}` : null,
      revenue: d.revenue ?? 0,
      releaseDate: d.release_date,
      weeksInTheater: Math.max(1, Math.ceil((today.getTime() - new Date(d.release_date).getTime()) / ONE_WEEK_MS)),
    }))
    .sort((a, b) => (b.revenue / b.weeksInTheater) - (a.revenue / a.weeksInTheater))
    .slice(0, 10);
}

export function useNowPlaying() {
  return useQuery({ queryKey: ['web-now-playing'], queryFn: fetchNowPlaying, staleTime: 30 * 60_000 });
}
export function useUpcoming() {
  return useQuery({ queryKey: ['web-upcoming'], queryFn: fetchUpcoming, staleTime: 30 * 60_000 });
}
export function useBoxOffice() {
  return useQuery({ queryKey: ['web-box-office'], queryFn: fetchBoxOffice, staleTime: 60 * 60_000 });
}

// ── Followed lounges ──────────────────────────────────────────────────────────

export interface FollowedRoom {
  externalId: string;
  mediaType: string;
  contentTitle: string;
  contentPoster: string | null;
  followerCount: number;
}

export function useFollowedRooms(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-followed-rooms', userId],
    queryFn: async (): Promise<FollowedRoom[]> => {
      if (!userId) return [];
      const { data: follows } = await supabase
        .from('content_room_follows')
        .select('external_id, media_type')
        .eq('user_id', userId);
      if (!follows?.length) return [];

      const rooms: FollowedRoom[] = [];
      for (const f of follows) {
        const [discRes, countRes] = await Promise.all([
          supabase.from('discussions')
            .select('content_title, content_poster')
            .eq('content_external_id', f.external_id)
            .eq('content_media_type', f.media_type)
            .not('content_poster', 'is', null)
            .limit(1)
            .maybeSingle(),
          supabase.from('content_room_follows')
            .select('id', { count: 'exact', head: true })
            .eq('external_id', f.external_id)
            .eq('media_type', f.media_type),
        ]);
        if (discRes.data?.content_title) {
          rooms.push({
            externalId: f.external_id,
            mediaType: f.media_type,
            contentTitle: discRes.data.content_title,
            contentPoster: discRes.data.content_poster ?? null,
            followerCount: countRes.count ?? 0,
          });
        }
      }
      return rooms;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });
}
