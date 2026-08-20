import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { normalizeEntryType, type EntryType } from '@/constants/theme';
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
  user_verified_tier: number;
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
  watch_count: number; // 1 = first log, 2 = rewatch/re-read, etc.
  is_spoiler: boolean;
  watched_with: string[]; // user IDs of tagged co-watchers
}

export type FeedFilterValue = EntryType | 'all';

const FEED_PAGE_SIZE = 30;

function useInfiniteFeedPosts() {
  const { user } = useSession();
  const { data: following, isSuccess: followingLoaded } = useFollowing();
  const { blockedIds, mutedIds } = useBlockedMutedIds();
  const followingIds = (following ?? [])
    .map((f) => f.id)
    .filter((id) => !blockedIds.has(id) && !mutedIds.has(id));
  const ids = user ? [user.id, ...followingIds] : [];

  return useInfiniteQuery({
    queryKey: ['posts-feed', user?.id, followingIds.slice().sort().join(',')],
    staleTime: 60_000, // don't refetch on every tab navigation — mutations invalidate when needed
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
        supabase.from('profiles').select('id, avatar_url, rating_icon, verified_tier, username').in('id', ids),
      ]);

      if (postsResult.error) throw postsResult.error;

      const profileMap = Object.fromEntries(
        (profilesResult.data ?? []).map((p) => [p.id, p as { avatar_url: string | null; rating_icon: string | null; verified_tier: number; username: string | null }]),
      );

      const posts = (postsResult.data as any[]).map((post) => ({
        ...post,
        user_name: profileMap[post.user_id]?.username ?? post.user_name,
        user_avatar_url: profileMap[post.user_id]?.avatar_url ?? null,
        user_rating_icon: profileMap[post.user_id]?.rating_icon ?? null,
        user_verified_tier: profileMap[post.user_id]?.verified_tier ?? 0,
      })) as Post[];

      return {
        posts,
        nextCursor: posts.length === FEED_PAGE_SIZE ? posts[posts.length - 1].created_at : undefined,
      };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!user && followingLoaded,
  });
}

export function useFeedPosts(filterType: FeedFilterValue) {
  const query = useInfiniteFeedPosts();
  const allPosts = useMemo(
    () => query.data?.pages.flatMap((p) => p.posts) ?? [],
    [query.data],
  );
  // normalizeEntryType keeps legacy `type: 'tv'` rows visible under "watch".
  const filtered = filterType === 'all'
    ? allPosts
    : allPosts.filter((p) => normalizeEntryType(p.type) === filterType);
  return { ...query, posts: filtered, allPosts };
}

/** Trending source for the "Global" feed view: recent posts from every user, not just friends. */
export function useGlobalPosts() {
  const { blockedIds, mutedIds } = useBlockedMutedIds();
  const query = useQuery({
    queryKey: ['posts', 'global'],
    staleTime: 60_000,
    queryFn: async () => {
      // posts.user_id references auth.users, not profiles, so PostgREST cannot
      // embed the author — the previous `profiles!posts_user_id_fkey(...)` hint
      // failed with PGRST200 and took the whole query down. Authors are looked
      // up separately, as elsewhere in the app.
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('visibility', 'everyone')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const authorIds = [...new Set(rows.map((p) => p.user_id).filter(Boolean))];
      const { data: authorRows } = authorIds.length
        ? await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url, verified_tier')
            .in('id', authorIds)
        : { data: [] as any[] };
      const authors = new Map<string, any>();
      for (const a of (authorRows ?? []) as any[]) authors.set(a.id, a);

      return rows.map((p) => {
        const a = authors.get(p.user_id);
        return {
          ...p,
          user_name: a?.username ?? a?.full_name ?? p.user_name,
          user_avatar_url: a?.avatar_url ?? null,
          user_verified_tier: a?.verified_tier ?? 0,
        };
      }) as Post[];
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
          { name: p.username ?? p.full_name ?? 'someone', avatarUrl: p.avatar_url ?? null },
        ]),
      );

      return rows.map((r) => ({
        user_name: profileMap[r.user_id]?.name ?? 'someone',
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
  isSpoiler?: boolean;
  watchedWith?: string[]; // array of user IDs
};

export function useCreatePost() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePostInput) => {
      const userName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'You';

      // Count how many times the user has already logged this title so we can
      // label the new post as "2nd watch", "3rd read", etc.
      const priorQ = supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('type', input.type);
      if (input.externalId) {
        priorQ.eq('external_id', input.externalId);
      } else {
        priorQ.eq('title', input.title);
      }
      const { count: priorCount } = await priorQ;
      const watch_count = (priorCount ?? 0) + 1;

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
          watch_count,
          is_spoiler: input.isSpoiler ?? false,
          watched_with: input.watchedWith ?? [],
        })
        .select()
        .single();
      if (error) throw error;
      const post = data as Post;

      // Notify each tagged friend (in-app notification + push)
      if (input.watchedWith && input.watchedWith.length > 0) {
        const myName = user?.user_metadata?.username ?? user?.email?.split('@')[0] ?? 'Someone';
        const typeLabel = normalizeEntryType(input.type) === 'watch' ? 'watched' : input.type === 'read' ? 'read' : input.type === 'listen' || input.type === 'podcast' ? 'listened to' : 'played';
        await supabase.from('notifications').insert(
          input.watchedWith.map((friendId) => ({
            user_id: friendId,
            from_user_id: user!.id,
            from_user_name: myName,
            type: 'watched_with',
            post_id: post.id,
            post_title: input.title,
            post_type: input.type,
            post_poster: input.poster ?? null,
            message: `${myName} ${typeLabel} ${input.title} with you — log your review!`,
            read: false,
          })),
        );
        // Fire push notifications — fire-and-forget, never block the post
        supabase.functions.invoke('notify-watched-with', {
          body: {
            friendIds: input.watchedWith,
            fromName: myName,
            title: input.title,
            postType: input.type,
          },
        }).catch(() => {});
      }

      return post;
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
      // Fetch the post so we can match the library entry
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('external_id, title, type')
        .eq('id', input.postId)
        .eq('user_id', user!.id)
        .single();
      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('posts')
        .update({ note: input.note, rating: input.rating, visibility: input.visibility })
        .eq('id', input.postId)
        .eq('user_id', user!.id);
      if (error) throw error;

      // Keep library in sync: update rating and promote watchlist → finished
      const libUpdate: Record<string, unknown> = { rating: input.rating };
      if (input.rating) libUpdate.status = 'finished';
      const libQ = supabase
        .from('library')
        .update(libUpdate)
        .eq('user_id', user!.id)
        .eq('type', post.type);
      if (post.external_id) {
        await libQ.eq('external_id', post.external_id);
      } else {
        await libQ.eq('title', post.title);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['library', user?.id] });
    },
  });
}

export function useDeletePost() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      const { data: post, error: fetchError } = await supabase
        .from('posts')
        .select('title, type, external_id')
        .eq('id', postId)
        .eq('user_id', user!.id) // ownership guard
        .single();
      if (fetchError) throw fetchError;
      const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', user!.id);
      if (error) throw error;
      if (post) {
        // Match on external_id when available to avoid collisions on shared titles
        const libDelete = supabase
          .from('library')
          .delete()
          .eq('user_id', user!.id)
          .eq('type', post.type)
          .eq('status', 'logged');
        if (post.external_id) {
          await libDelete.eq('external_id', post.external_id);
        } else {
          await libDelete.eq('title', post.title);
        }
      }
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

export function useMostReviewedInCircle(period: MostReviewedPeriod, followingIds: string[]) {
  return useQuery({
    queryKey: ['most-reviewed-circle', period, followingIds],
    queryFn: async () => {
      if (followingIds.length === 0) return [];
      const now = new Date();
      let since: string | null = null;
      if (period === 'week') since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      else if (period === 'month') since = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      else if (period === 'year') since = new Date(now.getFullYear(), 0, 1).toISOString();

      let query = supabase
        .from('posts')
        .select('title, type, poster, sub, external_id, media_type, rating')
        .in('user_id', followingIds);
      if (since) query = query.gte('created_at', since);
      const { data, error } = await query;
      if (error) throw error;

      // Group and count
      const map = new Map<string, { title: string; type: EntryType; poster: string | null; sub: string | null; externalId?: string; mediaType?: string; count: number; totalRating: number; ratingCount: number }>();
      for (const row of (data ?? []) as any[]) {
        const key = `${row.type}:${row.title?.toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          if (row.rating) { existing.totalRating += row.rating; existing.ratingCount++; }
        } else {
          map.set(key, { title: row.title, type: row.type, poster: row.poster, sub: row.sub, externalId: row.external_id, mediaType: row.media_type, count: 1, totalRating: row.rating ?? 0, ratingCount: row.rating ? 1 : 0 });
        }
      }
      return [...map.values()]
        .sort((a, b) => b.count - a.count)
        .map(({ totalRating, ratingCount, ...rest }) => ({ ...rest, avgRating: ratingCount > 0 ? totalRating / ratingCount : null })) as MostReviewedEntry[];
    },
    staleTime: 5 * 60 * 1000,
    enabled: followingIds.length > 0,
  });
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

      const { data, error } = await supabase.rpc('get_most_reviewed', { since_date: since });
      if (error) throw error;

      return ((data ?? []) as any[]).map((row) => ({
        title: row.title as string,
        type: row.type as EntryType,
        poster: row.poster as string | null,
        sub: row.sub as string | null,
        externalId: row.external_id as string | undefined,
        mediaType: row.media_type as string | undefined,
        count: Number(row.count),
        avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
      })) as MostReviewedEntry[];
    },
    staleTime: 10 * 60 * 1000,
  });
}

export interface HotThread {
  title: string;
  post_type: string;
  message_count: number;
  last_text: string;
  last_user: string;
  poster: string | null;
}

export function useHotThreads(typeFilter: FeedFilterValue = 'all') {
  return useQuery({
    queryKey: ['hot-threads', typeFilter],
    queryFn: async () => {
      // Fetch threads with message count from last 7 days
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('messages')
        .select('title, post_type, content, user_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (typeFilter !== 'all') {
        query = query.eq('post_type', typeFilter);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Group by title and count
      const map = new Map<string, { post_type: string; message_count: number; last_text: string; last_user: string }>();
      for (const row of (data ?? []) as any[]) {
        const existing = map.get(row.title);
        if (!existing) {
          map.set(row.title, { post_type: row.post_type, message_count: 1, last_text: row.content, last_user: row.user_name });
        } else {
          existing.message_count += 1;
        }
      }

      const titles = Array.from(map.keys());
      let posterByTitle = new Map<string, string | null>();
      if (titles.length > 0) {
        const { data: postsData } = await supabase
          .from('posts')
          .select('title, poster')
          .in('title', titles);
        posterByTitle = new Map((postsData ?? []).map((p: any) => [p.title, p.poster ?? null]));
      }

      return Array.from(map.entries())
        .map(([title, v]) => ({ title, ...v, poster: posterByTitle.get(title) ?? null } as HotThread))
        .sort((a, b) => b.message_count - a.message_count)
        .slice(0, 20);
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useThreadSearch(query: string) {
  return useQuery({
    queryKey: ['thread-search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('messages')
        .select('title, post_type, user_name, created_at')
        .ilike('title', `%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const map = new Map<string, { post_type: string; count: number }>();
      for (const row of (data ?? []) as any[]) {
        const existing = map.get(row.title);
        if (!existing) {
          map.set(row.title, { post_type: row.post_type, count: 1 });
        } else {
          existing.count += 1;
        }
      }
      return Array.from(map.entries())
        .map(([title, v]) => ({ title, post_type: v.post_type, message_count: v.count }))
        .sort((a, b) => b.message_count - a.message_count)
        .slice(0, 8);
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });
}

// Counts by type + media_type from the user's own posts — used for Top Categories
// when library data is sparse (e.g. the user logged posts before library was populated).
export interface PostTypeCounts {
  watch: number; // movies (type=watch, media_type=movie or null)
  tv: number;    // TV shows (type=watch, media_type=tv)
  read: number;
  play: number;
  listen: number;
  podcast: number;
  subs: { type: string; media_type: string | null; sub: string | null }[];
}

export function usePostsByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['posts-by-user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Post[];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useMyPostCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ['my-post-counts', userId],
    queryFn: async (): Promise<PostTypeCounts> => {
      const { data, error } = await supabase
        .from('posts')
        .select('type, media_type, sub')
        .eq('user_id', userId!);
      if (error) throw error;
      const counts: PostTypeCounts = { watch: 0, tv: 0, read: 0, play: 0, listen: 0, podcast: 0, subs: [] };
      for (const row of (data ?? []) as { type: string; media_type: string | null; sub: string | null }[]) {
        counts.subs.push({ type: row.type, media_type: row.media_type, sub: row.sub });
        if (row.type === 'watch' && row.media_type === 'tv') counts.tv += 1;
        else if (row.type === 'watch') counts.watch += 1;
        else if (row.type in counts) (counts as any)[row.type] += 1;
      }
      return counts;
    },
    enabled: !!userId,
  });
}
