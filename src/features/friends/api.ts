import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
}

export interface FriendRequest {
  friendshipId: string;
  fromUserId: string;
  profile: Profile;
}

function friendsQueryKey(userId: string | undefined) {
  return ['friends', userId] as const;
}

function friendRequestsQueryKey(userId: string | undefined) {
  return ['friend-requests', userId] as const;
}

export function useFriends() {
  const { user } = useSession();
  return useQuery({
    queryKey: friendsQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`)
        .eq('status', 'accepted');
      if (error) throw error;
      const friendIds = (data ?? []).map((f) => (f.user_id === user!.id ? f.friend_id : f.user_id));
      if (!friendIds.length) return [];
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', friendIds);
      if (profilesError) throw profilesError;
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
  });
}

export function useFriendsCount(userId: string | undefined) {
  return useQuery({
    queryKey: ['friends-count', userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('friendships')
        .select('id', { count: 'exact', head: true })
        .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
        .eq('status', 'accepted');
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export function useFriendRequests() {
  const { user } = useSession();
  return useQuery({
    queryKey: friendRequestsQueryKey(user?.id),
    queryFn: async (): Promise<FriendRequest[]> => {
      const { data, error } = await supabase
        .from('friendships')
        .select('*')
        .eq('friend_id', user!.id)
        .eq('status', 'pending');
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) return [];
      const senderIds = rows.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('id', senderIds);
      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return rows.flatMap((r) => {
        const profile = profileById.get(r.user_id);
        return profile ? [{ friendshipId: r.id, fromUserId: r.user_id, profile }] : [];
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

export interface SuggestedFriend extends Profile {
  mutualCount: number;
}

export function useSuggestedFriends(limit = 10) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['suggested-friends', user?.id],
    queryFn: async () => {
      // Step 1: all my relationships (any status) to build exclusion + friend sets
      const { data: myRelations, error: relError } = await supabase
        .from('friendships')
        .select('user_id, friend_id, status')
        .or(`user_id.eq.${user!.id},friend_id.eq.${user!.id}`);
      if (relError) throw relError;

      const myFriendIds = new Set<string>();
      const excludeIds = new Set<string>([user!.id]);

      for (const r of myRelations ?? []) {
        const otherId = r.user_id === user!.id ? r.friend_id : r.user_id;
        excludeIds.add(otherId); // exclude anyone already in any relationship with me
        if (r.status === 'accepted') myFriendIds.add(otherId);
      }

      if (!myFriendIds.size) return [] as SuggestedFriend[];

      // Step 2: all accepted friendships involving my friends
      const friendIdList = [...myFriendIds].join(',');
      const { data: friendRelations, error: frErr } = await supabase
        .from('friendships')
        .select('user_id, friend_id')
        .eq('status', 'accepted')
        .or(`user_id.in.(${friendIdList}),friend_id.in.(${friendIdList})`);
      if (frErr) throw frErr;

      // Step 3: count mutual connections per candidate
      const mutualCountMap = new Map<string, number>();
      for (const r of friendRelations ?? []) {
        if (myFriendIds.has(r.user_id) && !excludeIds.has(r.friend_id)) {
          mutualCountMap.set(r.friend_id, (mutualCountMap.get(r.friend_id) ?? 0) + 1);
        }
        if (myFriendIds.has(r.friend_id) && !excludeIds.has(r.user_id)) {
          mutualCountMap.set(r.user_id, (mutualCountMap.get(r.user_id) ?? 0) + 1);
        }
      }

      const candidates = [...mutualCountMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (!candidates.length) return [] as SuggestedFriend[];

      // Step 4: fetch profiles for the top candidates
      const { data: profiles, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', candidates.map(([id]) => id));
      if (profErr) throw profErr;

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));
      return candidates.flatMap(([id, mutualCount]) => {
        const profile = profileById.get(id);
        return profile ? [{ ...profile, mutualCount }] : [];
      }) as SuggestedFriend[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });
}

export function useSendFriendRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendId: string) => {
      const myName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      const { error } = await supabase
        .from('friendships')
        .insert({ user_id: user!.id, friend_id: friendId, status: 'pending' });
      if (error) throw error;
      await supabase.from('notifications').insert({
        user_id: friendId,
        from_user_id: user!.id,
        from_user_name: myName,
        type: 'friend_request',
        message: `${myName} wants to be your friend on TrustMe!`,
        read: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggested-friends', user?.id] });
      queryClient.invalidateQueries({ queryKey: friendsQueryKey(user?.id) });
    },
  });
}

export function useAcceptFriendRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (request: FriendRequest) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', request.friendshipId);
      if (error) throw error;
      const myName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: request.fromUserId,
        from_user_id: user!.id,
        from_user_name: myName,
        type: 'friend_accepted',
        message: `${myName} accepted your friend request!`,
        read: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendsQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: friendRequestsQueryKey(user?.id) });
    },
  });
}

export function useDeclineFriendRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (friendshipId: string) => {
      const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: friendRequestsQueryKey(user?.id) });
    },
  });
}
