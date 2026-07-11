import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { type Profile, useMutualFollows } from '@/features/follows/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface CloseFriendCandidate extends Profile {
  isCloseFriend: boolean;
}

function closeFriendIdsQueryKey(userId: string | undefined) {
  return ['close-friend-ids', userId] as const;
}

/** The signed-in user's own close-friend ids. Private by RLS — nobody else
 * can see this list, including the tagged friends themselves. */
export function useCloseFriendIds() {
  const { user } = useSession();
  return useQuery({
    queryKey: closeFriendIdsQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from('close_friends').select('friend_id').eq('user_id', user!.id);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.friend_id));
    },
    enabled: !!user,
  });
}

/** Mutual follows ("friends"), filtered by a search query, each flagged
 * with whether they're already a close friend — backs the Close Friends
 * search page. */
export function useCloseFriendCandidates(query: string) {
  const { data: mutuals, isLoading: mutualsLoading } = useMutualFollows();
  const { data: closeFriendIds, isLoading: closeFriendsLoading } = useCloseFriendIds();
  const trimmed = query.trim().toLowerCase();

  const candidates = useMemo((): CloseFriendCandidate[] => {
    const ids = closeFriendIds ?? new Set<string>();
    return (mutuals ?? [])
      .filter(
        (p) =>
          !trimmed ||
          (p.full_name ?? '').toLowerCase().includes(trimmed) ||
          (p.username ?? '').toLowerCase().includes(trimmed),
      )
      .map((p) => ({ ...p, isCloseFriend: ids.has(p.id) }))
      .sort((a, b) => Number(b.isCloseFriend) - Number(a.isCloseFriend));
  }, [mutuals, closeFriendIds, trimmed]);

  return { data: candidates, isLoading: mutualsLoading || closeFriendsLoading };
}

export function useToggleCloseFriend() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ friendId, isCloseFriend }: { friendId: string; isCloseFriend: boolean }) => {
      if (isCloseFriend) {
        const { error } = await supabase
          .from('close_friends')
          .insert({ user_id: user!.id, friend_id: friendId });
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('close_friends')
        .delete()
        .eq('user_id', user!.id)
        .eq('friend_id', friendId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: closeFriendIdsQueryKey(user?.id) });
    },
  });
}
