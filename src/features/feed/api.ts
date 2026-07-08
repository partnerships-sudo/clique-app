import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
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
}

export type FeedFilterValue = EntryType | 'all';

function postsQueryKey(userId: string | undefined, friendIds: string[]) {
  return ['posts', userId, ...friendIds.sort()] as const;
}

/** All posts for the signed-in user plus their accepted friends. */
function useAllPosts() {
  const { user } = useSession();
  const { data: friends } = useFriends();
  const friendIds = (friends ?? []).map((f) => f.id);

  return useQuery({
    queryKey: postsQueryKey(user?.id, friendIds),
    queryFn: async () => {
      const ids = [user!.id, ...friendIds];

      const [postsResult, profilesResult] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('profiles').select('id, avatar_url, rating_icon').in('id', ids),
      ]);

      if (postsResult.error) throw postsResult.error;

      const profileMap = Object.fromEntries(
        (profilesResult.data ?? []).map((p) => [p.id, p as { avatar_url: string | null; rating_icon: string | null }]),
      );

      return (postsResult.data as any[]).map((post) => ({
        ...post,
        user_avatar_url: profileMap[post.user_id]?.avatar_url ?? null,
        user_rating_icon: profileMap[post.user_id]?.rating_icon ?? null,
      })) as Post[];
    },
    enabled: !!user,
  });
}

export function useFeedPosts(filterType: FeedFilterValue) {
  const query = useAllPosts();
  const posts = query.data ?? [];
  const filtered = filterType === 'all' ? posts : posts.filter((p) => p.type === filterType);
  return { ...query, posts: filtered, allPosts: posts };
}

/** Trending source for the "Global" feed view: recent posts from every user, not just friends. */
export function useGlobalPosts() {
  return useQuery({
    queryKey: ['posts', 'global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as Post[];
    },
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
        })
        .select()
        .single();
      if (error) throw error;
      return data as Post;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts', user?.id] });
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
      queryClient.invalidateQueries({ queryKey: ['posts', user?.id] });
    },
  });
}
