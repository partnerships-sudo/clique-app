import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { EntryType } from '@/constants/theme';
import { useBlockedMutedIds } from '@/features/blocks/api';
import { useFollowing } from '@/features/follows/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Post {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  user_rating_icon: string | null;
  type: EntryType;
  title: string;
  sub: string | null;
  note: string | null;
  rating: number | null;
  poster: string | null;
  ext_rating: string | null;
  external_id: string | null;
  media_type: string | null;
  created_at: string;
  visibility: 'everyone' | 'close_friends';
}

export type FeedFilterValue = EntryType | 'all';

const FEED_PAGE_SIZE = 30;

function useInfiniteFeedPosts() {
  const { user } = useSession();
  const { data: following } = useFollowing();
  const { blockedIds, mutedIds } = useBlockedMutedIds();
  const followingIds = (following ?? [])
    .map((f) => f.id)
    .filter((id) => !blockedIds.has(id) && !mutedIds.has(id));
  const ids = user ? [user.id, ...followingIds] : [];

  return useInfiniteQuery({
    queryKey: ['posts-feed', user?.id, followingIds.slice().sort().join(',')],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      let postsQuery = supabase
        .from('posts')
        .select('*')
        .in('user_id', ids)
        .order('created_at', { ascending: false })
        .limit(FEED_PAGE_SIZE);

      if (pageParam) postsQuery = postsQuery.lt('created_at', pageParam);

      const [postsResult, profilesResult] = await Promise.all([
        postsQuery,
        supabase.from('profiles').select('id, avatar_url, rating_icon').in('id', ids),
      ]);

      if (postsResult.error) throw postsResult.error;

      const profileMap = Object.fromEntries(
        (profilesResult.data ?? []).map((p) => [p.id, p as { avatar_url: string | null; rating_icon: string | null }]),
      );

      const posts = (postsResult.data as any[]).map((post) => ({
        ...post,
        user_avatar_url: profileMap[post.user_id]?.avatar_url ?? null,
        user_rating_icon: profileMap[post.user_id]?.rating_icon ?? null,
      })) as Post[];

      return {
        posts,
        nextCursor: posts.length === FEED_PAGE_SIZE ? posts[posts.length - 1].created_at : undefined,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user,
  });
}

export function useFeedPosts(filterType: FeedFilterValue) {
  const query = useInfiniteFeedPosts();
  const allPosts = useMemo(
    () => query.data?.pages.flatMap((p) => p.posts) ?? [],
    [query.data],
  );
  const filtered = filterType === 'all' ? allPosts : allPosts.filter((p) => p.type === filterType);
  return { ...query, posts: filtered, allPosts };
}

/** Trending source for the "Global" feed view: recent posts from every user, not just friends. */
export function useGlobalPosts() {
  const { blockedIds, mutedIds } = useBlockedMutedIds();
  const query = useQuery({
    queryKey: ['posts', 'global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const posts = data as Post[];
      const uniqueUserIds = [...new Set(posts.map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', uniqueUserIds);
      const avatarMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.avatar_url]));
      return posts.map((p) => ({ ...p, user_avatar_url: avatarMap[p.user_id] ?? null })) as Post[];
    },
  });
  const data = useMemo(
    () => (query.data ?? []).filter((p) => !blockedIds.has(p.user_id) && !mutedIds.has(p.user_id)),
    [query.data, blockedIds, mutedIds],
  );
  return { ...query, data };
}

/** All logged items (not watchlist) from the user + people they follow.
 *  Used for circle trending — gives a full history view vs the paginated feed. */
export function useCircleLogActivity() {
  const { user } = useSession();
  const { data: following } = useFollowing();
  const { blockedIds, mutedIds } = useBlockedMutedIds();

  const followingIds = useMemo(
    () =>
      (following ?? [])
        .map((f: { id: string }) => f.id)
        .filter((id: string) => !blockedIds.has(id) && !mutedIds.has(id)),
    [following, blockedIds, mutedIds],
  );

  return useQuery({
    queryKey: ['circle-log-activity', user?.id, followingIds.slice().sort().join(',')],
    queryFn: async () => {
      const ids = [user!.id, ...followingIds];
      const { data, error } = await supabase
        .from('library')
        .select('user_id, type, title, sub, poster, rating, external_id, media_type')
        .in('user_id', ids)
        .neq('status', 'watchlist')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;

      const rows = (data ?? []) as {
        user_id: string; type: EntryType; title: string; sub: string | null;
        poster: string | null; rating: number | null; external_id: string | null; media_type: string | null;
      }[];

      const uniqueUserIds = [...new Set(rows.map((r) => r.user_id))];
      if (!uniqueUserIds.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', uniqueUserIds);
      const profileMap = Object.fromEntries(
        (profiles ?? []).map((p: any) => [
          p.id,
          { name: p.full_name ?? p.username ?? 'Someone', avatarUrl: p.avatar_url ?? null },
        ]),
      );

      return rows.map((r) => ({
        user_name: profileMap[r.user_id]?.name ?? 'Someone',
        user_avatar_url: profileMap[r.user_id]?.avatarUrl ?? null,
        title: r.title,
        sub: r.sub,
        type: r.type,
        poster: r.poster,
        rating: r.rating,
        external_id: r.external_id,
        media_type: r.media_type,
      }));
    },
    enabled: !!user && !!following,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

type CreatePostInput = {
  type: EntryType;
  title: string;
  sub?: string;
  poster?: string;
  note?: string;
  rating?: number;
  extRating?: string;
  externalId?: string;
  mediaType?: string;
  visibility?: 'everyone' | 'close_friends';
};

export function useCreatePost() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const userName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'You';
      const { data, error } = await supabase
        .from('posts')
        .insert({
          user_id: user!.id,
          user_name: userName,
          type: input.type,
          title: input.title,
          sub: input.sub ?? null,
          poster: input.poster ?? null,
          note: input.note ?? null,
          rating: input.rating ?? null,
          ext_rating: input.extRating ?? null,
          external_id: input.externalId ?? null,
          media_type: input.mediaType ?? null,
          visibility: input.visibility ?? 'everyone',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
    },
  });
}

export function useUpdatePost() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { postId: string; note: string | null; rating: number | null; visibility: 'everyone' | 'close_friends' }) => {
      const { error } = await supabase
        .from('posts')
        .update({ note: input.note, rating: input.rating, visibility: input.visibility })
        .eq('id', input.postId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
    },
  });
}

export function useDeletePost() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
    },
  });
}


export type MostReviewedPeriod = 'week' | 'month' | 'year' | 'alltime';

export interface MostReviewedEntry {
  title: string;
  type: EntryType;
  poster: string | null;
  sub: string | null;
  externalId?: string;
  mediaType?: string;
  count: number;
  avgRating: number | null;
}

export function useMostReviewed(period: MostReviewedPeriod) {
  return useQuery({
    queryKey: ['most-reviewed', period],
    queryFn: async () => {
      const now = new Date();
      let since: string | null = null;
      if (period === 'week') {
        since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (period === 'month') {
        since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      } else if (period === 'year') {
        since = new Date(now.getFullYear(), 0, 1).toISOString();
      }

      let query = supabase
        .from('posts')
        .select('title, type, poster, sub, rating, external_id, media_type')
        .not('title', 'is', null);
      if (since) query = query.gte('created_at', since);

      const { data, error } = await query;
      if (error) throw error;

      const map = new Map<string, { title: string; type: EntryType; poster: string | null; sub: string | null; externalId?: string; count: number; ratingSum: number; ratingCount: number }>();
      for (const row of (data ?? []) as any[]) {
        const key = `${row.type}:${row.title}`;
        const entry = map.get(key) ?? { title: row.title, type: row.type, poster: row.poster ?? null, sub: row.sub ?? null, externalId: row.external_id ?? undefined, mediaType: row.media_type ?? undefined, count: 0, ratingSum: 0, ratingCount: 0 };
        entry.count += 1;
        if (row.rating) { entry.ratingSum += row.rating; entry.ratingCount += 1; }
        map.set(key, entry);
      }

      return [...map.values()]
        .map((e) => ({ title: e.title, type: e.type, poster: e.poster, sub: e.sub, externalId: e.externalId, mediaType: e.mediaType, count: e.count, avgRating: e.ratingCount > 0 ? e.ratingSum / e.ratingCount : null }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20) as MostReviewedEntry[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
