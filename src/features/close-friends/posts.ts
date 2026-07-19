import { useQuery } from '@tanstack/react-query';

import { useCloseFriendIds } from '@/features/close-friends/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import type { EntryType } from '@/constants/theme';

export interface StoryPost {
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
  created_at: string;
}

export function useCloseFriendsPosts() {
  const { user } = useSession();
  const { data: closeFriendIds } = useCloseFriendIds();
  const ids = closeFriendIds ? [...closeFriendIds] : [];

  // Always include the signed-in user's own posts so they see their own story
  const allIds = user ? [...new Set([user.id, ...ids])] : ids;

  return useQuery({
    queryKey: ['close-friends-posts', user?.id, ...ids.sort()],
    queryFn: async () => {
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

      const [postsResult, profilesResult] = await Promise.all([
        supabase
          .from('posts')
          .select('*')
          .in('user_id', allIds)
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .limit(50),
        supabase.from('profiles').select('id, avatar_url, rating_icon').in('id', allIds),
      ]);

      if (postsResult.error) throw postsResult.error;

      const profileMap = Object.fromEntries(
        (profilesResult.data ?? []).map((p) => [
          p.id,
          { avatar_url: p.avatar_url as string | null, rating_icon: p.rating_icon as string | null },
        ]),
      );

      return (postsResult.data as any[]).map((post) => ({
        id: post.id,
        user_id: post.user_id,
        user_name: post.user_name ?? 'Friend',
        user_avatar_url: profileMap[post.user_id]?.avatar_url ?? null,
        user_rating_icon: profileMap[post.user_id]?.rating_icon ?? null,
        type: post.type as EntryType,
        title: post.title,
        sub: post.sub ?? null,
        note: post.note ?? null,
        rating: post.rating ?? null,
        poster: post.poster ?? null,
        created_at: post.created_at,
      })) as StoryPost[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}
