import type { EntryType } from '@/constants/theme';
import type { Post } from './api';

export interface TrendingLogger {
  name: string;
  avatarUrl: string | null;
}

export interface TrendingEntry {
  title: string;
  sub: string | null;
  type: EntryType;
  poster: string | null;
  count: number;
  users: string[];
  loggers: TrendingLogger[];
  ratingSum?: number;
  ratingCount?: number;
  externalId?: string;
  mediaType?: string;
  // Normalized 0-100 relevance score, comparable ACROSS content types (unlike
  // `count`, whose meaning/scale differs per source — TMDB vote average, RAWG
  // rating, raw Spotify episode count, or a friend-circle log tally). Used
  // only for ranking "For You" entries against each other fairly; falls back
  // to `count`-derived heuristics where a real score isn't available.
  score?: number;
}

export function computeTrendingInCircle(posts: Post[], limit = 5): TrendingEntry[] {
  const counts = new Map<string, TrendingEntry>();
  for (const post of posts) {
    const key = post.title.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
      if (!existing.poster && post.poster) existing.poster = post.poster;
      if (!existing.users.includes(post.user_name)) {
        existing.users.push(post.user_name);
        existing.loggers.push({ name: post.user_name, avatarUrl: post.user_avatar_url });
      }
      if (post.rating) {
        existing.ratingSum = (existing.ratingSum ?? 0) + post.rating;
        existing.ratingCount = (existing.ratingCount ?? 0) + 1;
      }
    } else {
      counts.set(key, {
        title: post.title,
        sub: post.sub,
        type: post.type,
        poster: post.poster,
        count: 1,
        users: [post.user_name],
        loggers: [{ name: post.user_name, avatarUrl: post.user_avatar_url }],
        ratingSum: post.rating ?? 0,
        ratingCount: post.rating ? 1 : 0,
        externalId: post.external_id ?? undefined,
        mediaType: post.media_type ?? undefined,
      });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function avgRating(entry: TrendingEntry): number | null {
  if (!entry.ratingCount) return null;
  return Math.round((entry.ratingSum ?? 0) / entry.ratingCount);
}
