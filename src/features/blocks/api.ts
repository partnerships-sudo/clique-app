import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { type Profile, useMutualFollows } from '@/features/follows/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface BlockableUser extends Profile {
  isFriend: boolean;
  isBlocked: boolean;
  isMuted: boolean;
}

function myBlocksQueryKey(userId: string | undefined) {
  return ['my-blocks', userId] as const;
}

/** The signed-in user's own block/mute rows, keyed by target id. Private to
 * the signed-in user by RLS — nobody can see who blocked/muted them. */
function useMyBlocks() {
  const { user } = useSession();
  return useQuery({
    queryKey: myBlocksQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_blocks')
        .select('target_id, is_blocked, is_muted')
        .eq('blocker_id', user!.id);
      if (error) throw error;
      return new Map(
        (data ?? []).map((r) => [r.target_id, { isBlocked: r.is_blocked, isMuted: r.is_muted }]),
      );
    },
    enabled: !!user,
  });
}

// Same bounded-pool-sorted-in-app idiom as useDiscoverPeople — "who's a
// friend" needs a follows-graph walk that can't be pushed into SQL, so a
// capped pool is fetched and sorted client-side.
const BLOCKABLE_POOL_SIZE = 200;

/** Searchable directory of every other user, mutual follows ("friends")
 * surfaced first — backs the Blocked & Muted Accounts search page. */
export function useBlockableUsers(query: string) {
  const { user } = useSession();
  const trimmed = query.trim();
  const pool = useQuery({
    queryKey: ['blockable-users-pool', user?.id, trimmed],
    queryFn: async (): Promise<Profile[]> => {
      let q = supabase.from('profiles').select('*').neq('id', user!.id).limit(BLOCKABLE_POOL_SIZE);
      q = trimmed
        ? q.or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
        : q.order('created_at', { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });
  const { data: mutuals, isLoading: mutualsLoading } = useMutualFollows();
  const { data: myBlocks, isLoading: blocksLoading } = useMyBlocks();

  const users = useMemo((): BlockableUser[] => {
    const mutualIds = new Set((mutuals ?? []).map((m) => m.id));
    const blocksMap = myBlocks ?? new Map<string, { isBlocked: boolean; isMuted: boolean }>();
    return (pool.data ?? [])
      .map((p) => {
        const status = blocksMap.get(p.id);
        return {
          ...p,
          isFriend: mutualIds.has(p.id),
          isBlocked: status?.isBlocked ?? false,
          isMuted: status?.isMuted ?? false,
        };
      })
      .sort((a, b) => Number(b.isFriend) - Number(a.isFriend));
  }, [pool.data, mutuals, myBlocks]);

  return { data: users, isLoading: pool.isLoading || mutualsLoading || blocksLoading };
}

/** Sets the full block/mute pair for a target user in one write — the row
 * is deleted once both flags are false, mirroring how `follows` rows are
 * deleted on unfollow rather than kept around in a "false" state. */
export function useSetBlockMute() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      targetUserId,
      isBlocked,
      isMuted,
    }: {
      targetUserId: string;
      isBlocked: boolean;
      isMuted: boolean;
    }) => {
      if (!isBlocked && !isMuted) {
        const { error } = await supabase
          .from('user_blocks')
          .delete()
          .eq('blocker_id', user!.id)
          .eq('target_id', targetUserId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from('user_blocks').upsert(
        {
          blocker_id: user!.id,
          target_id: targetUserId,
          is_blocked: isBlocked,
          is_muted: isMuted,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'blocker_id,target_id' },
      );
      if (error) throw error;
    },
    onSuccess: (_data, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: myBlocksQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['follow-status', user?.id, targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['following', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['followers', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['mutual-follows', user?.id] });
    },
  });
}
