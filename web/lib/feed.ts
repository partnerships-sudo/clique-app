import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

export type FeedPost = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  sub: string | null;
  poster: string | null;
  note: string | null;
  rating: number | null;
  created_at: string;
  visibility: string;
  external_id: string | null;
  media_type: string | null;
  watch_count: number;
  is_spoiler: boolean;
  // profile fields joined in
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  verified_tier: number;
  comments_count: number;
  likes_count: number;
  liked_by_me: boolean;
};

export function useFeed() {
  return useQuery({
    queryKey: ['web-feed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get following IDs
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = [user.id, ...(follows ?? []).map((f: any) => f.following_id)];

      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', followingIds)
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;

      // Fetch profiles separately (same pattern as mobile app)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, verified_tier')
        .in('id', followingIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const postIds = (posts ?? []).map((p: any) => p.id);

      // Batch fetch comment counts, like counts, and user's own likes in parallel
      const [commentCountsRes, likesRes, myLikesRes] = await Promise.all([
        postIds.length > 0
          ? supabase.from('post_comments').select('post_id').in('post_id', postIds)
          : Promise.resolve({ data: [] }),
        postIds.length > 0
          ? supabase.from('post_likes').select('post_id').in('post_id', postIds)
          : Promise.resolve({ data: [] }),
        postIds.length > 0
          ? supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const commentCounts: Record<string, number> = {};
      for (const c of commentCountsRes.data ?? []) {
        commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
      }

      const likeCounts: Record<string, number> = {};
      for (const l of likesRes.data ?? []) {
        likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
      }

      const myLikedIds = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));

      return (posts ?? []).map((p: any) => ({
        ...p,
        username: profileMap[p.user_id]?.username ?? null,
        full_name: profileMap[p.user_id]?.full_name ?? null,
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
        verified_tier: profileMap[p.user_id]?.verified_tier ?? 0,
        comments_count: commentCounts[p.id] ?? 0,
        likes_count: likeCounts[p.id] ?? 0,
        liked_by_me: myLikedIds.has(p.id),
      })) as FeedPost[];
    },
    staleTime: 30_000,
  });
}

export function usePostLikes(postId: string, initial?: { count: number; likedByMe: boolean }) {
  return useQuery({
    queryKey: ['web-post-likes', postId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        user
          ? supabase.from('post_likes').select('id').eq('post_id', postId).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, likedByMe: !!mine };
    },
    initialData: initial,
    staleTime: 30_000,
  });
}

export function useToggleLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, isLiked }: { postId: string; isLiked: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (isLiked) {
        await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
      } else {
        await supabase.from('post_likes').upsert({ post_id: postId, user_id: user.id });
      }
    },
    onMutate: async ({ postId, isLiked }) => {
      await qc.cancelQueries({ queryKey: ['web-post-likes', postId] });
      const prev = qc.getQueryData(['web-post-likes', postId]);
      qc.setQueryData(['web-post-likes', postId], (old: any) =>
        old ? { count: old.count + (isLiked ? -1 : 1), likedByMe: !isLiked } : old
      );
      return { prev };
    },
    onError: (_e, { postId }, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['web-post-likes', postId], ctx.prev);
    },
    onSettled: (_d, _e, { postId }) => {
      qc.invalidateQueries({ queryKey: ['web-post-likes', postId] });
    },
  });
}

export function useProfile(username: string) {
  return useQuery({
    queryKey: ['web-profile', username],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, bio, verified_tier, created_at')
        .eq('username', username)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!username,
  });
}

export function useProfilePosts(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-profile-posts', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('id, type, title, sub, poster, note, rating, created_at')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });
}

export function useCurrentProfile() {
  return useQuery({
    queryKey: ['web-current-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .eq('id', user.id)
        .single();
      return data;
    },
  });
}

// ── Circles feed ─────────────────────────────────────────────────────────────
// Posts with visibility='close_friends' from people the user has marked as close friends.
export function useCirclesFeed() {
  return useQuery({
    queryKey: ['web-circles-feed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get close friend IDs
      const { data: cfRows } = await supabase
        .from('close_friends')
        .select('friend_id')
        .eq('user_id', user.id);

      const friendIds = [user.id, ...(cfRows ?? []).map((r: any) => r.friend_id)];

      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', friendIds)
        .eq('visibility', 'close_friends')
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      if (!posts?.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, verified_tier')
        .in('id', friendIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const postIds = posts.map((p: any) => p.id);
      const [commentCountsRes, likesRes, myLikesRes] = await Promise.all([
        supabase.from('post_comments').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id),
      ]);

      const commentCounts: Record<string, number> = {};
      for (const c of commentCountsRes.data ?? []) {
        commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
      }
      const likeCounts: Record<string, number> = {};
      for (const l of likesRes.data ?? []) {
        likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
      }
      const myLikedIds = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));

      return posts.map((p: any) => ({
        ...p,
        username: profileMap[p.user_id]?.username ?? null,
        full_name: profileMap[p.user_id]?.full_name ?? null,
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
        verified_tier: profileMap[p.user_id]?.verified_tier ?? 0,
        comments_count: commentCounts[p.id] ?? 0,
        likes_count: likeCounts[p.id] ?? 0,
        liked_by_me: myLikedIds.has(p.id),
      })) as FeedPost[];
    },
    staleTime: 30_000,
  });
}

// ── Lounge feed ───────────────────────────────────────────────────────────────
// Public posts from all users — community view. Ordered by recency.
export function useLoungeFeed() {
  return useQuery({
    queryKey: ['web-lounge-feed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('visibility', 'everyone')
        .order('created_at', { ascending: false })
        .limit(80);

      if (error) throw error;
      if (!posts?.length) return [];

      const userIds = [...new Set(posts.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, verified_tier')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      const postIds = posts.map((p: any) => p.id);

      const [commentCountsRes, likesRes, myLikesRes] = await Promise.all([
        supabase.from('post_comments').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds),
        user
          ? supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      const commentCounts: Record<string, number> = {};
      for (const c of commentCountsRes.data ?? []) {
        commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
      }
      const likeCounts: Record<string, number> = {};
      for (const l of likesRes.data ?? []) {
        likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
      }
      const myLikedIds = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));

      return posts.map((p: any) => ({
        ...p,
        username: profileMap[p.user_id]?.username ?? null,
        full_name: profileMap[p.user_id]?.full_name ?? null,
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
        verified_tier: profileMap[p.user_id]?.verified_tier ?? 0,
        comments_count: commentCounts[p.id] ?? 0,
        likes_count: likeCounts[p.id] ?? 0,
        liked_by_me: myLikedIds.has(p.id),
      })) as FeedPost[];
    },
    staleTime: 60_000,
  });
}

// ── For You feed ──────────────────────────────────────────────────────────────
// Public posts from people the user doesn't follow, ranked by engagement.
export function useForYouFeed() {
  return useQuery({
    queryKey: ['web-for-you-feed'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get following IDs so we can exclude them
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = new Set([user.id, ...(follows ?? []).map((f: any) => f.following_id)]);

      // Fetch recent public posts from all users
      const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .eq('visibility', 'everyone')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!posts?.length) return [];

      // Filter out people the user already follows
      const discovery = posts.filter((p: any) => !followingIds.has(p.user_id));
      if (!discovery.length) return [];

      const userIds = [...new Set(discovery.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, verified_tier')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
      const postIds = discovery.map((p: any) => p.id);

      const [commentCountsRes, likesRes, myLikesRes] = await Promise.all([
        supabase.from('post_comments').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds),
        supabase.from('post_likes').select('post_id').in('post_id', postIds).eq('user_id', user.id),
      ]);

      const commentCounts: Record<string, number> = {};
      for (const c of commentCountsRes.data ?? []) {
        commentCounts[c.post_id] = (commentCounts[c.post_id] ?? 0) + 1;
      }
      const likeCounts: Record<string, number> = {};
      for (const l of likesRes.data ?? []) {
        likeCounts[l.post_id] = (likeCounts[l.post_id] ?? 0) + 1;
      }
      const myLikedIds = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));

      const enriched = discovery.map((p: any) => ({
        ...p,
        username: profileMap[p.user_id]?.username ?? null,
        full_name: profileMap[p.user_id]?.full_name ?? null,
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
        verified_tier: profileMap[p.user_id]?.verified_tier ?? 0,
        comments_count: commentCounts[p.id] ?? 0,
        likes_count: likeCounts[p.id] ?? 0,
        liked_by_me: myLikedIds.has(p.id),
      })) as FeedPost[];

      // Score: likes*2 + comments + recency boost (decay over 7 days)
      const now = Date.now();
      const scored = enriched.map((p) => {
        const ageDays = (now - new Date(p.created_at).getTime()) / 86_400_000;
        const recency = Math.max(0, 1 - ageDays / 7);
        const score = p.likes_count * 2 + p.comments_count + recency * 3;
        return { post: p, score };
      });

      return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 60)
        .map((s) => s.post);
    },
    staleTime: 120_000,
  });
}

export function useFollowList(userId: string | undefined, type: 'followers' | 'following') {
  return useQuery({
    queryKey: ['web-follow-list', userId, type],
    queryFn: async () => {
      if (!userId) return [];
      if (type === 'followers') {
        const { data } = await supabase
          .from('follows')
          .select('follower_id, profiles!follows_follower_id_fkey(id, username, full_name, avatar_url)')
          .eq('following_id', userId);
        return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
      } else {
        const { data } = await supabase
          .from('follows')
          .select('following_id, profiles!follows_following_id_fkey(id, username, full_name, avatar_url)')
          .eq('follower_id', userId);
        return (data ?? []).map((r: any) => r.profiles).filter(Boolean);
      }
    },
    enabled: !!userId,
  });
}

export function useFollowCounts(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-follow-counts', userId],
    queryFn: async () => {
      if (!userId) return { followers: 0, following: 0 };
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', userId),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', userId),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
    enabled: !!userId,
  });
}

export function useFollowState(targetUserId: string | undefined) {
  return useQuery({
    queryKey: ['web-follow-state', targetUserId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !targetUserId) return false;
      const { data } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();
      return !!data;
    },
    enabled: !!targetUserId,
  });
}

export function useToggleFollow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, isFollowing }: { targetId: string; isFollowing: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (isFollowing) {
        await supabase.from('follows').delete()
          .eq('follower_id', user.id).eq('following_id', targetId);
      } else {
        await supabase.from('follows').upsert({ follower_id: user.id, following_id: targetId });
      }
    },
    onSuccess: (_d, { targetId }) => {
      qc.invalidateQueries({ queryKey: ['web-follow-state', targetId] });
      qc.invalidateQueries({ queryKey: ['web-feed'] });
    },
  });
}
