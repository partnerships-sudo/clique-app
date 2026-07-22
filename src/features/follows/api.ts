import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Post } from '@/features/feed/api';
import { computeCompatibility } from '@/features/friends/compatibility';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_private: boolean;
}

export interface FollowRequest {
  followId: string;
  fromUserId: string;
  profile: Profile;
}

export type FollowStatus =
  | { kind: 'none' }
  | { kind: 'pending' }
  | { kind: 'accepted' };

function followingQueryKey(userId: string | undefined) {
  return ['following', userId] as const;
}

function followersQueryKey(userId: string | undefined) {
  return ['followers', userId] as const;
}

function followStatusQueryKey(userId: string | undefined, targetUserId: string | undefined) {
  return ['follow-status', userId, targetUserId] as const;
}

function followRequestsQueryKey(userId: string | undefined) {
  return ['follow-requests', userId] as const;
}

/** Followers of any user (accepted only) — used by the profile stats sheet. */
export function useFollowersByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['followers-by-user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followed_id', userId!)
        .eq('status', 'accepted');
      if (error) throw error;
      const ids = (data ?? []).map((f) => f.follower_id);
      if (!ids.length) return [] as Profile[];
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Following list for any user (accepted only) — used by the profile stats sheet. */
export function useFollowingByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['following-by-user', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', userId!)
        .eq('status', 'accepted');
      if (error) throw error;
      const ids = (data ?? []).map((f) => f.followed_id);
      if (!ids.length) return [] as Profile[];
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** Profiles the signed-in user follows (accepted only). */
export function useFollowing() {
  const { user } = useSession();
  return useQuery({
    queryKey: followingQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user!.id)
        .eq('status', 'accepted');
      if (error) throw error;
      const ids = (data ?? []).map((f) => f.followed_id);
      if (!ids.length) return [] as Profile[];
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
  });
}

/** Profiles that follow the signed-in user (accepted only). */
export function useFollowers() {
  const { user } = useSession();
  return useQuery({
    queryKey: followersQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('followed_id', user!.id)
        .eq('status', 'accepted');
      if (error) throw error;
      const ids = (data ?? []).map((f) => f.follower_id);
      if (!ids.length) return [] as Profile[];
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('*').in('id', ids);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
  });
}

export function useFollowingCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['following-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('follower_id', userId!)
        .eq('status', 'accepted');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useFollowersCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['followers-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('follows')
        .select('id', { count: 'exact', head: true })
        .eq('followed_id', userId!)
        .eq('status', 'accepted');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

/** One-directional follow state (viewer -> target) — drives the Follow /
 * Requested / Following button on a profile. Approving a pending request
 * always happens in the target's own Follow Requests list, never here. */
export function useFollowStatus(targetUserId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: followStatusQueryKey(user?.id, targetUserId),
    queryFn: async (): Promise<FollowStatus> => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('follower_id', user!.id)
        .eq('followed_id', targetUserId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { kind: 'none' };
      return data.status === 'accepted' ? { kind: 'accepted' } : { kind: 'pending' };
    },
    enabled: !!user && !!targetUserId && targetUserId !== user?.id,
  });
}

/** Incoming pending follow requests — only ever non-empty for private accounts. */
export function useFollowRequests() {
  const { user } = useSession();
  return useQuery({
    queryKey: followRequestsQueryKey(user?.id),
    queryFn: async (): Promise<FollowRequest[]> => {
      const { data, error } = await supabase
        .from('follows')
        .select('*')
        .eq('followed_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const senderIds = rows.map((r) => r.follower_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds);
      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return rows.flatMap((r) => {
        const profile = profileById.get(r.follower_id);
        return profile ? [{ followId: r.id, fromUserId: r.follower_id, profile }] : [];
      });
    },
    enabled: !!user,
  });
}

export function useSearchUsers(query: string) {
  const { user } = useSession();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['user-search', trimmed],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`username.ilike.%${trimmed}%,full_name.ilike.%${trimmed}%`)
        .neq('id', user!.id)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: !!user && trimmed.length >= 2,
  });
}

export interface SuggestedFollow extends Profile {
  mutualCount: number;
}

/** People followed by people I follow, ranked by overlap — "Suggested for you". */
export function useSuggestedFollows(limit = 10) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['suggested-follows', user?.id],
    queryFn: async () => {
      const { data: myFollowing, error: mfErr } = await supabase
        .from('follows')
        .select('followed_id, status')
        .eq('follower_id', user!.id);
      if (mfErr) throw mfErr;

      const acceptedFollowingIds = (myFollowing ?? [])
        .filter((f) => f.status === 'accepted')
        .map((f) => f.followed_id);
      const excludeIds = new Set<string>([user!.id, ...(myFollowing ?? []).map((f) => f.followed_id)]);

      if (!acceptedFollowingIds.length) return [] as SuggestedFollow[];

      const { data: secondHop, error: shErr } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('status', 'accepted')
        .in('follower_id', acceptedFollowingIds);
      if (shErr) throw shErr;

      const mutualCountMap = new Map<string, number>();
      for (const r of secondHop ?? []) {
        if (excludeIds.has(r.followed_id)) continue;
        mutualCountMap.set(r.followed_id, (mutualCountMap.get(r.followed_id) ?? 0) + 1);
      }

      const candidates = [...mutualCountMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
      if (!candidates.length) return [] as SuggestedFollow[];

      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', candidates.map(([id]) => id));
      if (profErr) throw profErr;

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return candidates.flatMap(([id, mutualCount]) => {
        const profile = profileById.get(id);
        return profile ? [{ ...profile, mutualCount }] : [];
      }) as SuggestedFollow[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });
}

export type DiscoverSortBy = 'compatibility' | 'mutual' | 'recent';

export interface DiscoverProfile extends Profile {
  mutualCount?: number;
  compatibility?: number;
}

// Compatibility/mutual-count sorting can't be pushed into SQL — both need
// per-user data (post history, follow-graph walk) computed in-app, same as
// the compatibility bar on FriendCard already does. So instead of true
// server-side pagination, this fetches a single bounded pool (newest
// signups first) and sorts/filters it in memory. Fine at this app's scale;
// would need a DB-side materialized score if the user base grew large.
const DISCOVER_POOL_SIZE = 200;

/** Browsable pool of people not already followed, sortable by compatibility
 * score, mutual-connection count, or recency, and filterable by location —
 * backs the "Discover People" page opened from the search filter button. */
export function useDiscoverPeople(sortBy: DiscoverSortBy, location: string) {
  const { user } = useSession();
  const trimmedLocation = location.trim();
  return useQuery({
    queryKey: ['discover-people', user?.id, sortBy, trimmedLocation],
    queryFn: async (): Promise<DiscoverProfile[]> => {
      const { data: myFollows, error: mfErr } = await supabase
        .from('follows')
        .select('followed_id, status')
        .eq('follower_id', user!.id);
      if (mfErr) throw mfErr;
      const excludeIds = new Set<string>([user!.id, ...(myFollows ?? []).map((f) => f.followed_id)]);

      let poolQuery = supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(DISCOVER_POOL_SIZE);
      if (trimmedLocation) poolQuery = poolQuery.ilike('location', `%${trimmedLocation}%`);
      const { data: pool, error: poolErr } = await poolQuery;
      if (poolErr) throw poolErr;
      const profiles = ((pool ?? []) as Profile[]).filter((p) => !excludeIds.has(p.id));
      if (!profiles.length) return [];

      if (sortBy === 'recent') return profiles;

      if (sortBy === 'mutual') {
        const acceptedFollowingIds = (myFollows ?? [])
          .filter((f) => f.status === 'accepted')
          .map((f) => f.followed_id);
        const mutualCountMap = new Map<string, number>();
        if (acceptedFollowingIds.length) {
          const { data: secondHop, error: shErr } = await supabase
            .from('follows')
            .select('followed_id')
            .eq('status', 'accepted')
            .in('follower_id', acceptedFollowingIds);
          if (shErr) throw shErr;
          for (const r of secondHop ?? []) {
            mutualCountMap.set(r.followed_id, (mutualCountMap.get(r.followed_id) ?? 0) + 1);
          }
        }
        return profiles
          .map((p) => ({ ...p, mutualCount: mutualCountMap.get(p.id) ?? 0 }))
          .sort((a, b) => (b.mutualCount ?? 0) - (a.mutualCount ?? 0));
      }

      // sortBy === 'compatibility'
      const [{ data: myPosts, error: mpErr }, { data: poolPosts, error: ppErr }] = await Promise.all([
        supabase.from('posts').select('*').eq('user_id', user!.id),
        supabase.from('posts').select('*').in('user_id', profiles.map((p) => p.id)),
      ]);
      if (mpErr) throw mpErr;
      if (ppErr) throw ppErr;
      const postsByUser = new Map<string, Post[]>();
      for (const post of (poolPosts ?? []) as Post[]) {
        const list = postsByUser.get(post.user_id) ?? [];
        list.push(post);
        postsByUser.set(post.user_id, list);
      }
      return profiles
        .map((p) => ({
          ...p,
          compatibility: computeCompatibility((myPosts ?? []) as Post[], postsByUser.get(p.id) ?? []),
        }))
        .sort((a, b) => (b.compatibility ?? 0) - (a.compatibility ?? 0));
    },
    enabled: !!user,
  });
}

/** Resolves the actual people behind a "N mutual connections" count — people
 * I follow (accepted) who also follow the given target (accepted). Powers
 * the mutual-connections bottom sheet on suggested/discover user cards. */
export function useMutualConnections(targetUserId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['mutual-connections', user?.id, targetUserId],
    queryFn: async (): Promise<Profile[]> => {
      const [{ data: myFollowing, error: mfErr }, { data: targetFollowers, error: tfErr }] = await Promise.all([
        supabase.from('follows').select('followed_id').eq('follower_id', user!.id).eq('status', 'accepted'),
        supabase.from('follows').select('follower_id').eq('followed_id', targetUserId!).eq('status', 'accepted'),
      ]);
      if (mfErr) throw mfErr;
      if (tfErr) throw tfErr;
      const myFollowingIds = new Set((myFollowing ?? []).map((f) => f.followed_id));
      const mutualIds = (targetFollowers ?? []).map((f) => f.follower_id).filter((id) => myFollowingIds.has(id));
      if (!mutualIds.length) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', mutualIds);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user && !!targetUserId,
  });
}

/** People who follow me AND whom I follow back — the closest thing to the
 * old "friends" concept, used for messaging/group-chat trust checks. */
export function useMutualFollows() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['mutual-follows', user?.id],
    queryFn: async () => {
      const [{ data: followingRows, error: e1 }, { data: followerRows, error: e2 }] = await Promise.all([
        supabase.from('follows').select('followed_id').eq('follower_id', user!.id).eq('status', 'accepted'),
        supabase.from('follows').select('follower_id').eq('followed_id', user!.id).eq('status', 'accepted'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const followingIds = new Set((followingRows ?? []).map((f) => f.followed_id));
      const mutualIds = (followerRows ?? []).map((f) => f.follower_id).filter((id) => followingIds.has(id));
      if (!mutualIds.length) return [] as Profile[];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', mutualIds);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
  });
}

/** Self + mutual follows + everyone those mutuals follow (1 degree of
 * separation beyond direct mutuals) — the wider network used for group
 * chats and per-title content-chat discovery, not for DMs. */
export function useExtendedNetwork() {
  const { user } = useSession();
  const { data: mutuals } = useMutualFollows();
  return useQuery({
    queryKey: ['extended-network', user?.id, (mutuals ?? []).map((m) => m.id).join(',')],
    queryFn: async () => {
      const mutualIds = (mutuals ?? []).map((m) => m.id);
      const ids = new Set<string>([user!.id, ...mutualIds]);
      if (mutualIds.length) {
        const { data: secondHop, error } = await supabase
          .from('follows')
          .select('followed_id')
          .eq('status', 'accepted')
          .in('follower_id', mutualIds);
        if (error) throw error;
        for (const r of secondHop ?? []) ids.add(r.followed_id);
      }
      return [...ids];
    },
    enabled: !!user && mutuals !== undefined,
  });
}

/** Same reach as `useExtendedNetwork()`, resolved to full profiles (self
 * excluded) — for pickers like "who can I add to this group". */
export function useExtendedNetworkProfiles() {
  const { user } = useSession();
  const { data: ids } = useExtendedNetwork();
  return useQuery({
    queryKey: ['extended-network-profiles', user?.id, (ids ?? []).join(',')],
    queryFn: async () => {
      const otherIds = (ids ?? []).filter((id) => id !== user!.id);
      if (!otherIds.length) return [] as Profile[];
      const { data: profiles, error } = await supabase.from('profiles').select('*').in('id', otherIds);
      if (error) throw error;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user && ids !== undefined,
  });
}

/** Follows a target user — auto-accepted for public accounts, pending
 * (awaiting approval) for private ones. */
export function useFollow() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetUserId, isTargetPrivate }: { targetUserId: string; isTargetPrivate: boolean }) => {
      const myName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      const status = isTargetPrivate ? 'pending' : 'accepted';
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: user!.id, followed_id: targetUserId, status });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: targetUserId,
        from_user_id: user!.id,
        from_user_name: myName,
        type: status === 'pending' ? 'follow_request' : 'new_follower',
        message: status === 'pending' ? `${myName} wants to follow you` : `${myName} started following you`,
        read: false,
      });
    },
    onSuccess: (_data, { targetUserId }) => {
      queryClient.invalidateQueries({ queryKey: followingQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: followStatusQueryKey(user?.id, targetUserId) });
      queryClient.invalidateQueries({ queryKey: ['followers-count', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['suggested-follows', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['mutual-follows', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
    },
  });
}

export function useUnfollow() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user!.id)
        .eq('followed_id', targetUserId);
      if (error) throw error;
    },
    onSuccess: (_data, targetUserId) => {
      queryClient.invalidateQueries({ queryKey: followingQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: followStatusQueryKey(user?.id, targetUserId) });
      queryClient.invalidateQueries({ queryKey: ['posts-feed', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['followers-count', targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['mutual-follows', user?.id] });
    },
  });
}

export function useAcceptFollowRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: FollowRequest) => {
      const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('id', request.followId);
      if (error) throw error;
      const myName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: request.fromUserId,
        from_user_id: user!.id,
        from_user_name: myName,
        type: 'follow_accepted',
        message: `${myName} accepted your follow request!`,
        read: false,
      });
    },
    onSuccess: (_data, request) => {
      queryClient.invalidateQueries({ queryKey: followersQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: followRequestsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: followStatusQueryKey(request.fromUserId, user?.id) });
      queryClient.invalidateQueries({ queryKey: ['followers-count', user?.id] });
      queryClient.invalidateQueries({ queryKey: ['mutual-follows', user?.id] });
    },
  });
}

export function useDeclineFollowRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (followId: string) => {
      const { error } = await supabase.from('follows').delete().eq('id', followId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followRequestsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['follow-status'] });
    },
  });
}

export interface MyTasteEntry extends Profile {
  compatibility: number;
}

export function useMyTasteTop4() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['mytaste-top4', user?.id],
    queryFn: async (): Promise<MyTasteEntry[]> => {
      const { data: followingRows, error: e1 } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user!.id)
        .eq('status', 'accepted');
      if (e1) throw e1;
      const followingIds = (followingRows ?? []).map((r) => r.followed_id);
      if (!followingIds.length) return [];

      const [{ data: profiles, error: e2 }, { data: myPosts, error: e3 }, { data: friendPosts, error: e4 }] =
        await Promise.all([
          supabase.from('profiles').select('*').in('id', followingIds),
          supabase.from('posts').select('*').eq('user_id', user!.id),
          supabase.from('posts').select('*').in('user_id', followingIds),
        ]);
      if (e2) throw e2;
      if (e3) throw e3;
      if (e4) throw e4;

      const postsByUser = new Map<string, Post[]>();
      for (const p of (friendPosts ?? []) as Post[]) {
        const list = postsByUser.get(p.user_id) ?? [];
        list.push(p);
        postsByUser.set(p.user_id, list);
      }

      return ((profiles ?? []) as Profile[])
        .map((p) => ({ ...p, compatibility: computeCompatibility((myPosts ?? []) as Post[], postsByUser.get(p.id) ?? []) }))
        .sort((a, b) => b.compatibility - a.compatibility)
        .slice(0, 4);
    },
    enabled: !!user,
  });
}

export function useRemoveFollower() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (followerId: string) => {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', followerId)
        .eq('followed_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: followersQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['mutual-follows', user?.id] });
    },
  });
}
