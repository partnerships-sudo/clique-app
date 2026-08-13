'use client';

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  is_private: boolean;
  verified_tier: number;
}

export interface FollowRequest {
  followId: string;
  fromUserId: string;
  profile: Profile;
}

// ── Compatibility ─────────────────────────────────────────────────────────────

export interface CompatItem {
  title: string;
  type: string;
  rating: number | null;
  sub: string | null;
}

export function computeCompatibility(myPosts: CompatItem[], friendPosts: CompatItem[]): number {
  if (!myPosts.length || !friendPosts.length) return 40;

  const myTitleSet = new Set(myPosts.map((p) => p.title.toLowerCase()));
  const friendTitleSet = new Set(friendPosts.map((p) => p.title.toLowerCase()));
  let sharedTitles = 0;
  for (const t of myTitleSet) { if (friendTitleSet.has(t)) sharedTitles++; }
  const smaller = Math.min(myTitleSet.size, friendTitleSet.size);
  const titleScore = smaller > 0 ? (sharedTitles / smaller) * 25 : 0;

  const myTypes = new Set(myPosts.map((p) => p.type));
  const friendTypes = new Set(friendPosts.map((p) => p.type));
  let sharedTypes = 0;
  for (const t of myTypes) { if (friendTypes.has(t)) sharedTypes++; }
  const maxTypes = Math.max(myTypes.size, friendTypes.size);
  const typeScore = maxTypes > 0 ? (sharedTypes / maxTypes) * 20 : 0;

  const myRatings = new Map<string, number>();
  for (const p of myPosts) { if (p.rating) myRatings.set(p.title.toLowerCase(), p.rating); }
  let ratingPoints = 0, ratingComparisons = 0;
  for (const p of friendPosts) {
    const mine = p.rating ? myRatings.get(p.title.toLowerCase()) : undefined;
    if (p.rating && mine) {
      ratingComparisons++;
      const diff = Math.abs(p.rating - mine);
      if (diff === 0) ratingPoints += 2;
      else if (diff <= 1) ratingPoints += 1;
    }
  }
  const ratingScore = ratingComparisons > 0 ? Math.min(10, (ratingPoints / ratingComparisons) * 5) : 0;

  const total = 40 + titleScore + typeScore + ratingScore;
  return Math.min(99, Math.max(25, Math.round(total)));
}

export function compatColor(n: number) {
  return n >= 90 ? '#E84F4F' : n >= 75 ? '#5B4FE8' : n >= 60 ? '#4F9CE8' : '#9E9E9E';
}

export function compatLabel(n: number) {
  if (n >= 80) return 'Movie Soulmate';
  if (n >= 60) return 'TV Twin';
  if (n >= 40) return 'Curious Minds';
  return 'Fun Seeker';
}

export function compatEmoji(n: number) {
  return n >= 90 ? '🔥' : n >= 75 ? '✨' : n >= 60 ? '👍' : '🤔';
}

export interface CompatBreakdown {
  total: number;
  base: number;           // 40
  titleScore: number;     // 0-25
  typeScore: number;      // 0-20
  ratingScore: number;    // 0-10
  sharedTitles: number;
  myLibSize: number;
  friendLibSize: number;
  sharedTypes: number[];  // the actual type strings in common
}

export function computeCompatibilityBreakdown(myPosts: CompatItem[], friendPosts: CompatItem[]): CompatBreakdown {
  if (!myPosts.length || !friendPosts.length) {
    return { total: 40, base: 40, titleScore: 0, typeScore: 0, ratingScore: 0, sharedTitles: 0, myLibSize: myPosts.length, friendLibSize: friendPosts.length, sharedTypes: [] };
  }

  const myTitleSet = new Set(myPosts.map((p) => p.title.toLowerCase()));
  const friendTitleSet = new Set(friendPosts.map((p) => p.title.toLowerCase()));
  let sharedTitles = 0;
  for (const t of myTitleSet) { if (friendTitleSet.has(t)) sharedTitles++; }
  const smaller = Math.min(myTitleSet.size, friendTitleSet.size);
  const titleScore = smaller > 0 ? (sharedTitles / smaller) * 25 : 0;

  const myTypes = new Set(myPosts.map((p) => p.type));
  const friendTypes = new Set(friendPosts.map((p) => p.type));
  const sharedTypeSet: string[] = [];
  for (const t of myTypes) { if (friendTypes.has(t)) sharedTypeSet.push(t); }
  const maxTypes = Math.max(myTypes.size, friendTypes.size);
  const typeScore = maxTypes > 0 ? (sharedTypeSet.length / maxTypes) * 20 : 0;

  const myRatings = new Map<string, number>();
  for (const p of myPosts) { if (p.rating) myRatings.set(p.title.toLowerCase(), p.rating); }
  let ratingPoints = 0, ratingComparisons = 0;
  for (const p of friendPosts) {
    const mine = p.rating ? myRatings.get(p.title.toLowerCase()) : undefined;
    if (p.rating && mine) {
      ratingComparisons++;
      const diff = Math.abs(p.rating - mine);
      if (diff === 0) ratingPoints += 2;
      else if (diff <= 1) ratingPoints += 1;
    }
  }
  const ratingScore = ratingComparisons > 0 ? Math.min(10, (ratingPoints / ratingComparisons) * 5) : 0;

  const total = Math.min(99, Math.max(25, Math.round(40 + titleScore + typeScore + ratingScore)));
  return {
    total, base: 40,
    titleScore: Math.round(titleScore * 10) / 10,
    typeScore: Math.round(typeScore * 10) / 10,
    ratingScore: Math.round(ratingScore * 10) / 10,
    sharedTitles, myLibSize: myTitleSet.size, friendLibSize: friendTitleSet.size,
    sharedTypes: sharedTypeSet,
  };
}

// ── Following (people I follow) ───────────────────────────────────────────────

export function useFollowing() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-following', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('follows')
        .select('followed_id')
        .eq('follower_id', user!.id)
        .eq('status', 'accepted');
      const ids = (data ?? []).map((r: any) => r.followed_id);
      if (!ids.length) return [] as Profile[];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar_url, is_private, verified_tier').in('id', ids);
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

// ── Compat items (library) for computing scores ───────────────────────────────

export function useCompatItems(allIds: string[]) {
  const key = allIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['web-compat-items', key],
    queryFn: async (): Promise<Map<string, CompatItem[]>> => {
      const { data } = await supabase
        .from('library')
        .select('user_id, title, type, sub, rating')
        .in('user_id', allIds)
        .eq('status', 'logged');
      const map = new Map<string, CompatItem[]>();
      for (const row of data ?? []) {
        const list = map.get(row.user_id) ?? [];
        list.push({ title: row.title, type: row.type, rating: row.rating, sub: row.sub });
        map.set(row.user_id, list);
      }
      return map;
    },
    enabled: allIds.length > 0,
    staleTime: 5 * 60_000,
  });
}

// ── Friend list with compat scores ────────────────────────────────────────────

export interface FriendEntry extends Profile {
  compatibility: number;
}

export function useFriendsWithCompat() {
  const { user } = useSession();
  const { data: following = [], isLoading: followingLoading } = useFollowing();
  const allIds = useMemo(() => (user ? [user.id, ...following.map((f) => f.id)] : []), [user?.id, following.map((f) => f.id).join(',')]);
  const { data: compatItems, isLoading: itemsLoading } = useCompatItems(allIds);

  const friends = useMemo((): FriendEntry[] => {
    if (!user || !compatItems) return following.map((f) => ({ ...f, compatibility: 40 }));
    const myItems = compatItems.get(user.id) ?? [];
    return following
      .map((f) => ({ ...f, compatibility: computeCompatibility(myItems, compatItems.get(f.id) ?? []) }))
      .sort((a, b) => b.compatibility - a.compatibility);
  }, [following, compatItems, user?.id]);

  return { friends, isLoading: followingLoading || itemsLoading };
}

// ── Follow requests ───────────────────────────────────────────────────────────

export function useFollowRequests() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-follow-requests', user?.id],
    queryFn: async (): Promise<FollowRequest[]> => {
      const { data } = await supabase
        .from('follows')
        .select('id, follower_id')
        .eq('followed_id', user!.id)
        .eq('status', 'pending');
      const rows = data ?? [];
      if (!rows.length) return [];
      const ids = rows.map((r: any) => r.follower_id);
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar_url, is_private, verified_tier').in('id', ids);
      const byId = new Map((profiles ?? []).map((p: any) => [p.id, p as Profile]));
      return rows.flatMap((r: any) => {
        const profile = byId.get(r.follower_id);
        return profile ? [{ followId: r.id, fromUserId: r.follower_id, profile }] : [];
      });
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useAcceptFollowRequest() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (req: FollowRequest) => {
      const { error } = await supabase.from('follows').update({ status: 'accepted' }).eq('id', req.followId);
      if (error) throw error;
      const myName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      await supabase.from('notifications').insert({
        user_id: req.fromUserId, from_user_id: user!.id, from_user_name: myName,
        type: 'follow_accepted', message: `${myName} accepted your follow request!`, read: false,
      });
    },
    onMutate: async (req) => {
      const key = ['web-follow-requests', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData<FollowRequest[]>(key, (old) => (old ?? []).filter((r) => r.followId !== req.followId));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) qc.setQueryData(['web-follow-requests', user?.id], ctx.prev); },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['web-follow-requests', user?.id] });
      qc.invalidateQueries({ queryKey: ['web-following', user?.id] });
    },
  });
}

export function useDeclineFollowRequest() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (followId: string) => {
      const { error } = await supabase.from('follows').delete().eq('id', followId);
      if (error) throw error;
    },
    onMutate: async (followId) => {
      const key = ['web-follow-requests', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData<FollowRequest[]>(key, (old) => (old ?? []).filter((r) => r.followId !== followId));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) qc.setQueryData(['web-follow-requests', user?.id], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['web-follow-requests', user?.id] }),
  });
}

// ── Mutual follows (people who follow me AND I follow back) ───────────────────

export function useMutualFollows() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-mutual-follows', user?.id],
    queryFn: async () => {
      const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
        supabase.from('follows').select('followed_id').eq('follower_id', user!.id).eq('status', 'accepted'),
        supabase.from('follows').select('follower_id').eq('followed_id', user!.id).eq('status', 'accepted'),
      ]);
      const followingIds = new Set((followingRows ?? []).map((r: any) => r.followed_id));
      const mutualIds = (followerRows ?? []).map((r: any) => r.follower_id).filter((id: string) => followingIds.has(id));
      if (!mutualIds.length) return [] as Profile[];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, is_private, verified_tier')
        .in('id', mutualIds);
      return (profiles ?? []) as Profile[];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
}

// ── Close friends ─────────────────────────────────────────────────────────────

export interface CloseFriendCandidate extends Profile {
  isCloseFriend: boolean;
}

export function useCloseFriendIds() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-close-friend-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('close_friends').select('friend_id').eq('user_id', user!.id);
      return new Set((data ?? []).map((r: any) => r.friend_id as string));
    },
    enabled: !!user,
  });
}

export function useCloseFriendCandidates(query: string) {
  const { data: mutuals = [], isLoading: mutualsLoading } = useMutualFollows();
  const { data: cfIds, isLoading: cfLoading } = useCloseFriendIds();
  const trimmed = query.trim().toLowerCase();

  const candidates = useMemo((): CloseFriendCandidate[] => {
    const ids = cfIds ?? new Set<string>();
    return mutuals
      .filter((p) =>
        !trimmed ||
        (p.full_name ?? '').toLowerCase().includes(trimmed) ||
        (p.username ?? '').toLowerCase().includes(trimmed),
      )
      .map((p) => ({ ...p, isCloseFriend: ids.has(p.id) }))
      .sort((a, b) => Number(b.isCloseFriend) - Number(a.isCloseFriend));
  }, [mutuals, cfIds, trimmed]);

  return { data: candidates, isLoading: mutualsLoading || cfLoading };
}

export function useToggleCloseFriend() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ friendId, isCloseFriend }: { friendId: string; isCloseFriend: boolean }) => {
      if (isCloseFriend) {
        const { error } = await supabase.from('close_friends').delete().eq('user_id', user!.id).eq('friend_id', friendId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('close_friends').insert({ user_id: user!.id, friend_id: friendId });
        if (error) throw error;
      }
    },
    onMutate: async ({ friendId, isCloseFriend }) => {
      const key = ['web-close-friend-ids', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData<Set<string>>(key, (old) => {
        const next = new Set(old ?? []);
        if (isCloseFriend) next.delete(friendId); else next.add(friendId);
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx: any) => { if (ctx?.prev) qc.setQueryData(['web-close-friend-ids', user?.id], ctx.prev); },
    onSettled: () => qc.invalidateQueries({ queryKey: ['web-close-friend-ids', user?.id] }),
  });
}

// ── MyTaste: all following with compat + breakdown ────────────────────────────

export interface MyTasteEntry extends FriendEntry {
  breakdown: CompatBreakdown;
}

export function useMyTasteAll() {
  const { user } = useSession();
  const { data: following = [], isLoading: followingLoading } = useFollowing();
  const allIds = useMemo(
    () => (user ? [user.id, ...following.map((f) => f.id)] : []),
    [user?.id, following.map((f) => f.id).join(',')],
  );
  const { data: compatItems, isLoading: itemsLoading } = useCompatItems(allIds);

  const entries = useMemo((): MyTasteEntry[] => {
    if (!user || !compatItems) return [];
    const myItems = compatItems.get(user.id) ?? [];
    return following
      .map((f) => {
        const bd = computeCompatibilityBreakdown(myItems, compatItems.get(f.id) ?? []);
        return { ...f, compatibility: bd.total, breakdown: bd };
      })
      .sort((a, b) => b.compatibility - a.compatibility);
  }, [following, compatItems, user?.id]);

  return { entries, isLoading: followingLoading || itemsLoading };
}
