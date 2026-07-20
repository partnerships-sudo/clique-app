import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import { supabase } from '@/lib/supabase';

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

const GUARDIAN_KEY = process.env.EXPO_PUBLIC_GUARDIAN_API_KEY!;
const NEWSAPI_KEY = process.env.EXPO_PUBLIC_NEWSAPI_KEY!;

const GUARDIAN_SECTIONS: Record<Exclude<EntryType, 'podcast'>, string> = {
  watch: 'film|tv-and-radio',
  read: 'books',
  play: 'games',
  listen: 'music',
};

const NEWSAPI_QUERIES: Record<FeedFilterValue, string> = {
  all: 'movies OR television OR books OR gaming OR music',
  watch: 'movies OR film OR television OR TV shows',
  read: 'books OR novels OR literature OR publishing',
  play: 'video games OR gaming OR PlayStation OR Xbox OR Nintendo',
  listen: 'music OR albums OR artists OR concerts',
  podcast: 'podcast OR podcasting',
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function fetchGuardian(filter: FeedFilterValue): Promise<NewsArticle[]> {
  try {
    const params = new URLSearchParams({
      'api-key': GUARDIAN_KEY,
      'show-fields': 'thumbnail,trailText,byline',
      'page-size': '20',
      'order-by': 'newest',
    });

    if (filter === 'podcast') {
      params.set('tag', 'type/podcast');
    } else if (filter === 'all') {
      params.set('section', 'film|tv-and-radio|books|games|music');
    } else {
      params.set('section', GUARDIAN_SECTIONS[filter]);
    }

    const res = await fetch(`https://content.guardianapis.com/search?${params.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();

    return ((data.response?.results ?? []) as any[]).map((r) => ({
      id: `guardian-${r.id}`,
      title: r.webTitle,
      trailText: stripHtml(r.fields?.trailText ?? ''),
      thumbnail: r.fields?.thumbnail ?? null,
      byline: r.fields?.byline ?? null,
      section: r.sectionName,
      publishedAt: r.webPublicationDate,
      url: r.webUrl,
    }));
  } catch {
    return [];
  }
}

async function fetchNewsAPI(filter: FeedFilterValue): Promise<NewsArticle[]> {
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
  } catch {
    return [];
  }
}

async function fetchNews(filter: FeedFilterValue): Promise<NewsArticle[]> {
  const [guardian, newsapi] = await Promise.all([
    fetchGuardian(filter),
    fetchNewsAPI(filter),
  ]);

  // Merge and deduplicate by normalised title
  const seen = new Set<string>();
  const merged: NewsArticle[] = [];
  for (const article of [...guardian, ...newsapi]) {
    const key = article.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 60);
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(article);
    }
  }

  // Sort newest first
  return merged.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
}

export function useNewsArticles(filter: FeedFilterValue) {
  return useQuery({
    queryKey: ['news-v2', filter],
    queryFn: () => fetchNews(filter),
    staleTime: 5 * 60 * 1000,
  });
}
