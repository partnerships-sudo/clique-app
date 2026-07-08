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
    } else {
      counts.set(key, {
        title: post.title,
        sub: post.sub,
        type: post.type,
        poster: post.poster,
        count: 1,
        users: [post.user_name],
        loggers: [{ name: post.user_name, avatarUrl: post.user_avatar_url }],
      });
    }
  }
  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
