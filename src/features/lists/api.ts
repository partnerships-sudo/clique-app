import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface ListRecord {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
}

export interface ListItem {
  id: string;
  list_id: string;
  library_item_id: string | null;
  title: string;
  sub: string | null;
  poster: string | null;
  type: string | null;
  position: number;
  created_at: string;
}

// Augmented list with item count + first 4 posters for cover mosaic
export interface ListSummary extends ListRecord {
  item_count: number;
  cover_posters: (string | null)[];
}

function listsKey(userId: string | undefined) {
  return ['lists', userId] as const;
}

function listItemsKey(listId: string | undefined) {
  return ['list-items', listId] as const;
}

// ─── Own lists ───────────────────────────────────────────────────────────────

export function useLists() {
  const { user } = useSession();
  return useQuery({
    queryKey: listsKey(user?.id),
    queryFn: async (): Promise<ListSummary[]> => {
      const { data: lists, error } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch items for all lists in one query, then group client-side
      const listIds = (lists as ListRecord[]).map((l) => l.id);
      if (listIds.length === 0) return [];

      const { data: items, error: itemErr } = await supabase
        .from('list_items')
        .select('list_id, poster')
        .in('list_id', listIds)
        .order('position', { ascending: true });
      if (itemErr) throw itemErr;

      const grouped: Record<string, { count: number; posters: (string | null)[] }> = {};
      for (const item of items as { list_id: string; poster: string | null }[]) {
        if (!grouped[item.list_id]) grouped[item.list_id] = { count: 0, posters: [] };
        grouped[item.list_id].count += 1;
        if (grouped[item.list_id].posters.length < 4) grouped[item.list_id].posters.push(item.poster);
      }

      return (lists as ListRecord[]).map((l) => ({
        ...l,
        item_count: grouped[l.id]?.count ?? 0,
        cover_posters: grouped[l.id]?.posters ?? [],
      }));
    },
    enabled: !!user,
  });
}

export function useListItems(listId: string | undefined) {
  return useQuery({
    queryKey: listItemsKey(listId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select('*')
        .eq('list_id', listId!)
        .order('position', { ascending: true });
      if (error) throw error;
      return data as ListItem[];
    },
    enabled: !!listId,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateList() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { title: string; description?: string; is_public?: boolean }) => {
      const { data, error } = await supabase
        .from('lists')
        .insert({ user_id: user!.id, title: input.title, description: input.description ?? null, is_public: input.is_public ?? true })
        .select()
        .single();
      if (error) throw error;
      return data as ListRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey(user?.id) }),
  });
}

export function useUpdateList() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; title: string; description?: string; is_public?: boolean }) => {
      const { error } = await supabase
        .from('lists')
        .update({ title: input.title, description: input.description ?? null, is_public: input.is_public ?? true })
        .eq('id', input.id)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey(user?.id) }),
  });
}

export function useDeleteList() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listId: string) => {
      const { error } = await supabase.from('lists').delete().eq('id', listId).eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: listsKey(user?.id) }),
  });
}

export function useAddToList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      list_id: string;
      library_item_id: string | null;
      title: string;
      sub: string | null;
      poster: string | null;
      type: string | null;
    }) => {
      // Get current max position
      const { data: existing } = await supabase
        .from('list_items')
        .select('position')
        .eq('list_id', input.list_id)
        .order('position', { ascending: false })
        .limit(1);
      const nextPos = existing && existing.length > 0 ? (existing[0].position ?? 0) + 1 : 0;

      const { error } = await supabase.from('list_items').insert({
        list_id: input.list_id,
        library_item_id: input.library_item_id,
        title: input.title,
        sub: input.sub,
        poster: input.poster,
        type: input.type,
        position: nextPos,
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: listItemsKey(vars.list_id) });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useRemoveFromList() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      // Get the list_id before deleting so we can invalidate
      const { data } = await supabase.from('list_items').select('list_id').eq('id', itemId).single();
      const { error } = await supabase.from('list_items').delete().eq('id', itemId);
      if (error) throw error;
      return data?.list_id as string | undefined;
    },
    onSuccess: (listId) => {
      if (listId) qc.invalidateQueries({ queryKey: listItemsKey(listId) });
      qc.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

// Check which of the user's lists already contain a given library_item_id
export function useListMembership(libraryItemId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['list-membership', libraryItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('list_items')
        .select('list_id')
        .eq('library_item_id', libraryItemId!);
      if (error) throw error;
      return new Set((data as { list_id: string }[]).map((r) => r.list_id));
    },
    enabled: !!libraryItemId && !!user,
  });
}
