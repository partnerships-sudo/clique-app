import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export type LibraryStatus = 'watching' | 'reading' | 'playing' | 'listening' | 'finished' | 'watchlist';

export interface LibraryItem {
  id: string;
  user_id: string;
  type: EntryType;
  title: string;
  sub: string | null;
  poster: string | null;
  status: LibraryStatus;
  rating: number | null;
  ext_rating: string | null;
  external_id: string | null;
  media_type: string | null;
  note: string | null;
  date: string | null;
  created_at: string;
  rec_from_user_name: string | null;
  rec_compat_score: number | null;
}

const STATUS_BY_TYPE: Record<EntryType, LibraryStatus> = {
  watch: 'watching',
  read: 'reading',
  play: 'playing',
  listen: 'listening',
  podcast: 'listening',
};

function libraryQueryKey(userId: string | undefined) {
  return ['library', userId] as const;
}

function todayLabel() {
  return new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function useLibraryItems() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: libraryQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LibraryItem[];
    },
    enabled: !!user,
  });
  const items = query.data ?? [];
  const watchlist = items.filter((i) => i.status === 'watchlist');
  return {
    ...query,
    logged: items.filter((i) => i.status !== 'watchlist'),
    watchlist,
    friendRecItems: watchlist.filter((i) => !!i.rec_from_user_name),
  };
}

export function useLibraryItemsByUser(userId: string | undefined) {
  const query = useQuery({
    queryKey: libraryQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LibraryItem[];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const items = query.data ?? [];
  return {
    ...query,
    logged: items.filter((i) => i.status !== 'watchlist'),
    watchlist: items.filter((i) => i.status === 'watchlist'),
  };
}

export type AddLibraryItemInput = {
  type: EntryType;
  title: string;
  sub?: string;
  poster?: string;
  note?: string;
  rating?: number;
  extRating?: string;
  externalId?: string;
  mediaType?: string;
  intent: 'log' | 'watchlist';
  recFromUserName?: string;
  recCompatScore?: number;
};

export function useAddLibraryItem() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddLibraryItemInput) => {
      const status: LibraryStatus =
        input.intent === 'watchlist' ? 'watchlist' : STATUS_BY_TYPE[input.type];
      const { data, error } = await supabase
        .from('library')
        .insert({
          user_id: user!.id,
          type: input.type,
          title: input.title,
          sub: input.sub ?? null,
          poster: input.poster ?? null,
          note: input.note ?? null,
          rating: input.intent === 'watchlist' ? null : input.rating ?? null,
          ext_rating: input.extRating ?? null,
          external_id: input.externalId ?? null,
          media_type: input.mediaType ?? null,
          status,
          date: todayLabel(),
          rec_from_user_name: input.recFromUserName ?? null,
          rec_compat_score: input.recCompatScore ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as LibraryItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKey(user?.id) });
    },
  });
}

export function useMoveToLibrary() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: LibraryItem) => {
      const { error } = await supabase
        .from('library')
        .update({ status: STATUS_BY_TYPE[item.type], date: todayLabel() })
        .eq('id', item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKey(user?.id) });
    },
  });
}

export interface FriendWatchlistItem extends LibraryItem {
  recommendedBy: string;
}

export function useFriendWatchlist() {
  const { user } = useSession();
  const { data: friends } = useFriends();
  const friendIds = (friends ?? []).map((f) => f.id);

  const query = useQuery({
    queryKey: ['friend-watchlist', user?.id, [...friendIds].sort().join('|')],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('library')
        .select('*')
        .in('user_id', friendIds)
        .eq('status', 'watchlist')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LibraryItem[];
    },
    enabled: !!user && friendIds.length > 0,
  });

  const nameById = new Map((friends ?? []).map((f) => [f.id, f.full_name ?? f.username ?? 'A friend']));
  const items: FriendWatchlistItem[] = (query.data ?? []).map((item) => ({
    ...item,
    recommendedBy: nameById.get(item.user_id) ?? 'A friend',
  }));

  return { ...query, items, isLoading: query.isLoading && friendIds.length > 0 };
}

export function useRateLibraryItem() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; rating: number; title: string; type: EntryType }) => {
      const [libraryResult, postsResult] = await Promise.all([
        supabase.from('library').update({ rating: input.rating }).eq('id', input.id),
        supabase
          .from('posts')
          .update({ rating: input.rating })
          .eq('user_id', user!.id)
          .eq('title', input.title)
          .eq('type', input.type),
      ]);
      if (libraryResult.error) throw libraryResult.error;
      if (postsResult.error) throw postsResult.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });
}

export function useRemoveLibraryItem() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('library').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: libraryQueryKey(user?.id) });
    },
  });
}
