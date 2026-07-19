import { useQuery } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface FriendLogEntry {
  userId: string;
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  rating: number | null;
  ratingIcon: string | null;
  loggedAt: string;
  isCloseFriend: boolean;
}

export function useFriendsWhoLogged(title: string | undefined, type: EntryType | undefined) {
  const { user } = useSession();

  return useQuery({
    queryKey: ['friends-who-logged', user?.id, title, type],
    queryFn: async () => {
      // 1. IDs of people I follow (accepted)
      const { data: followRows } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user!.id)
        .eq('status', 'accepted');
      const followingIds = (followRows ?? []).map((r) => r.followed_id);
      if (!followingIds.length) return [] as FriendLogEntry[];

      // 2. My close friend ids
      const { data: cfRows } = await supabase
        .from('close_friends')
        .select('friend_id')
        .eq('user_id', user!.id);
      const closeFriendSet = new Set((cfRows ?? []).map((r) => r.friend_id));

      // 3. Posts from those friends matching this title+type
      const [postsResult, profilesResult] = await Promise.all([
        supabase
          .from('posts')
          .select('user_id, user_name, rating, created_at')
          .eq('title', title!)
          .eq('type', type!)
          .in('user_id', followingIds)
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('id, avatar_url, rating_icon, username')
          .in('id', followingIds),
      ]);
      if (postsResult.error) throw postsResult.error;

      const profileMap = Object.fromEntries(
        (profilesResult.data ?? []).map((p) => [p.id, p]),
      );

      const entries: FriendLogEntry[] = (postsResult.data ?? []).map((p) => ({
        userId: p.user_id,
        username: profileMap[p.user_id]?.username ?? p.user_name ?? null,
        fullName: null,
        avatarUrl: profileMap[p.user_id]?.avatar_url ?? null,
        rating: p.rating ?? null,
        ratingIcon: profileMap[p.user_id]?.rating_icon ?? null,
        loggedAt: p.created_at,
        isCloseFriend: closeFriendSet.has(p.user_id),
      }));

      // Sort: close friends first, then others; within each group, rated before unrated, then by log date
      entries.sort((a, b) => {
        if (a.isCloseFriend !== b.isCloseFriend) return a.isCloseFriend ? -1 : 1;
        const aRated = a.rating !== null ? 1 : 0;
        const bRated = b.rating !== null ? 1 : 0;
        if (aRated !== bRated) return bRated - aRated;
        return new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime();
      });

      return entries;
    },
    enabled: !!user && !!title && !!type,
    staleTime: 60_000,
  });
}
