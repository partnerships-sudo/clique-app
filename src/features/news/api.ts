import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';

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

const GUARDIAN_API_KEY = process.env.EXPO_PUBLIC_GUARDIAN_API_KEY!;

const SECTIONS_BY_TYPE: Record<Exclude<EntryType, 'podcast'>, string> = {
  watch: 'film|tv-and-radio',
  read: 'books',
  play: 'games',
  listen: 'music',
};

const ALL_SECTIONS = 'film|tv-and-radio|books|games|music';

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

async function fetchNews(filter: FeedFilterValue): Promise<NewsArticle[]> {
  const params = new URLSearchParams({
    'api-key': GUARDIAN_API_KEY,
    'show-fields': 'thumbnail,trailText,byline',
    'page-size': '30',
    'order-by': 'newest',
  });

  if (filter === 'podcast') {
    params.set('tag', 'type/podcast');
  } else if (filter === 'all') {
    params.set('section', ALL_SECTIONS);
  } else {
    params.set('section', SECTIONS_BY_TYPE[filter]);
  }

  const res = await fetch(`https://content.guardianapis.com/search?${params.toString()}`);
  if (!res.ok) throw new Error(`Guardian API error: ${res.status}`);
  const data = await res.json();

  return ((data.response?.results ?? []) as any[]).map((r) => ({
    id: r.id,
    title: r.webTitle,
    trailText: stripHtml(r.fields?.trailText ?? ''),
    thumbnail: r.fields?.thumbnail ?? null,
    byline: r.fields?.byline ?? null,
    section: r.sectionName,
    publishedAt: r.webPublicationDate,
    url: r.webUrl,
  }));
}

export function useNewsArticles(filter: FeedFilterValue) {
  return useQuery({
    queryKey: ['news', filter],
    queryFn: () => fetchNews(filter),
    staleTime: 5 * 60 * 1000,
  });
}
