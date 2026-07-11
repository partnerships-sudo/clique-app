import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useFollowing } from '@/features/follows/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export type CollectionType = 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
export type CollectionFormat = 'book' | 'dvd' | 'bluray' | '4k' | 'cd' | 'vinyl' | 'game';

export interface CollectionItem {
  id: string;
  user_id: string;
  type: CollectionType;
  format: CollectionFormat | null;
  title: string;
  sub: string | null;
  poster: string | null;
  external_id: string | null;
  media_type: string | null;
  ext_rating: string | null;
  user_rating: number | null;
  created_at: string;
}

function collectionQueryKey(userId: string | undefined) {
  return ['collection-items', userId] as const;
}

export function useCollectionItems() {
  const { user } = useSession();
  const query = useQuery({
    queryKey: collectionQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_items')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CollectionItem[];
    },
    enabled: !!user,
  });
  return { ...query, items: query.data ?? [] };
}

/**
 * Another user's collection, filtered server-side by their sharing toggles
 * (RLS only returns 'read' rows if they've shared books, 'watch' rows if
 * they've shared movies/TV) — never returns anything for the viewer's own
 * id, use useCollectionItems for that.
 */
export function useCollectionItemsByUser(userId: string | undefined) {
  const query = useQuery({
    queryKey: collectionQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collection_items')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CollectionItem[];
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always' as const,
  });
  return { ...query, items: query.data ?? [] };
}

export function useFollowingCollections() {
  const { user } = useSession();
  const { data: following = [] } = useFollowing();
  const followingIds = following.map((f) => f.id);

  return useQuery({
    queryKey: ['following-collections', user?.id, ...followingIds.sort()],
    queryFn: async () => {
      if (!followingIds.length) return [] as (CollectionItem & { user_id: string })[];
      const { data, error } = await supabase
        .from('collection_items')
        .select('*')
        .in('user_id', followingIds);
      if (error) throw error;
      return data as (CollectionItem & { user_id: string })[];
    },
    enabled: !!user && followingIds.length > 0,
    staleTime: 0,
  });
}

export type AddToCollectionInput = {
  type: CollectionType;
  format: CollectionFormat | null;
  title: string;
  sub?: string | null;
  poster?: string | null;
  externalId?: string | null;
  mediaType?: string | null;
  extRating?: string | null;
  userRating?: number | null;
};

export function useAddToCollection() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AddToCollectionInput) => {
      const { error } = await supabase.from('collection_items').insert({
        user_id: user!.id,
        type: input.type,
        format: input.format,
        title: input.title,
        sub: input.sub ?? null,
        poster: input.poster ?? null,
        external_id: input.externalId ?? null,
        media_type: input.mediaType ?? null,
        ext_rating: input.extRating ?? null,
        user_rating: input.userRating ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKey(user?.id) });
    },
  });
}

export function useUpdateCollectionItemRating() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number | null }) => {
      const { error } = await supabase
        .from('collection_items')
        .update({ user_rating: rating })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKey(user?.id) });
    },
  });
}

export function useRemoveFromCollection() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('collection_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: collectionQueryKey(user?.id) });
    },
  });
}
