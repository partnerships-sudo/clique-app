import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { BADGE_CATALOG, COMPLETIONIST_BADGE, type BadgeContext, type BadgeDef } from '@/features/badges/catalog';
import { useLibraryItems } from '@/features/library/api';
import { useProfile } from '@/features/profile/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface EvaluatedBadge extends BadgeDef {
  progress: number;
  earned: boolean;
}

function earnedBadgesQueryKey(userId: string | undefined) {
  return ['user-badges', userId] as const;
}

export function useEarnedBadges(userId: string | undefined) {
  return useQuery({
    queryKey: earnedBadgesQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_key, earned_at')
        .eq('user_id', userId!);
      if (error) throw error;
      return data as { badge_key: string; earned_at: string }[];
    },
    enabled: !!userId,
  });
}

function useMyReactionsTotal() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['my-reactions-total', user?.id],
    queryFn: async () => {
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', user!.id);
      if (postsError) throw postsError;
      const postIds = (posts ?? []).map((p) => p.id);
      if (!postIds.length) return 0;
      const { count, error } = await supabase
        .from('reactions')
        .select('id', { count: 'exact', head: true })
        .in('post_id', postIds);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

/** Evaluates every badge for the signed-in user, persists newly-crossed
 * badges to `user_badges` (achievements never revoke, so only additions are
 * written), and returns the full evaluated list including the meta
 * Completionist badge. */
export function useBadges() {
  const { user } = useSession();
  const { logged, isLoading: libraryLoading } = useLibraryItems();
  const { data: reactionsTotal = 0 } = useMyReactionsTotal();
  const { data: earnedRows, isLoading: earnedLoading } = useEarnedBadges(user?.id);
  const queryClient = useQueryClient();

  const earnedKeys = useMemo(() => new Set((earnedRows ?? []).map((r) => r.badge_key)), [earnedRows]);

  const evaluated: EvaluatedBadge[] = useMemo(() => {
    const ctx: BadgeContext = { items: logged, reactionsTotal };
    const base = BADGE_CATALOG.map((badge) => {
      const progress = earnedKeys.has(badge.key) ? badge.target : badge.getProgress(ctx);
      return { ...badge, progress: Math.min(progress, badge.target), earned: earnedKeys.has(badge.key) || progress >= badge.target };
    });
    const completionistProgress = base.filter((b) => b.earned).length;
    const completionist: EvaluatedBadge = {
      ...COMPLETIONIST_BADGE,
      progress: Math.min(completionistProgress, COMPLETIONIST_BADGE.target),
      earned: earnedKeys.has('completionist') || completionistProgress >= COMPLETIONIST_BADGE.target,
    };
    return [...base, completionist];
  }, [logged, reactionsTotal, earnedKeys]);

  const newlyEarned = useMemo(
    () => evaluated.filter((b) => b.earned && !earnedKeys.has(b.key)).map((b) => b.key),
    [evaluated, earnedKeys],
  );

  const syncMutation = useMutation({
    mutationFn: async (keys: string[]) => {
      if (!user || !keys.length) return;
      const { error } = await supabase
        .from('user_badges')
        .upsert(
          keys.map((badge_key) => ({ user_id: user.id, badge_key })),
          { onConflict: 'user_id,badge_key', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: earnedBadgesQueryKey(user?.id) });
    },
  });

  return {
    badges: evaluated,
    isLoading: libraryLoading || earnedLoading,
    newlyEarned,
    syncNewlyEarned: () => {
      if (newlyEarned.length) syncMutation.mutate(newlyEarned);
    },
  };
}

/** Read-only badge view for someone else's profile — no sync/write, just
 * evaluates their earned rows against the shared catalog for display. */
export function useBadgesForUser(userId: string | undefined) {
  const { data: earnedRows, isLoading } = useEarnedBadges(userId);
  const earnedKeys = useMemo(() => new Set((earnedRows ?? []).map((r) => r.badge_key)), [earnedRows]);
  const evaluated: EvaluatedBadge[] = useMemo(() => {
    const base = BADGE_CATALOG.map((badge) => ({
      ...badge,
      progress: earnedKeys.has(badge.key) ? badge.target : 0,
      earned: earnedKeys.has(badge.key),
    }));
    const completionist: EvaluatedBadge = {
      ...COMPLETIONIST_BADGE,
      progress: earnedKeys.has('completionist') ? COMPLETIONIST_BADGE.target : base.filter((b) => b.earned).length,
      earned: earnedKeys.has('completionist'),
    };
    return [...base, completionist];
  }, [earnedKeys]);
  return { badges: evaluated, isLoading };
}

export function useUpdateFeaturedBadges() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (badgeKeys: string[]) => {
      const { error } = await supabase
        .from('profiles')
        .update({ featured_badges: badgeKeys })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile', user?.id] });
    },
  });
}

export function useFeaturedBadges() {
  const { data: profile } = useProfile();
  return profile?.featured_badges ?? [];
}
