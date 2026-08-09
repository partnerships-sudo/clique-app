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

export function useListsByUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['lists', userId],
    queryFn: async (): Promise<ListSummary[]> => {
      const { data: lists, error } = await supabase
        .from('lists')
        .select('*')
        .eq('user_id', userId!)
        .eq('is_public', true)
        .order('created_at', { ascending: false });
      if (error) throw error;

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
    enabled: !!userId,
  });
}

export function useSaveList() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, title }: { listId: string; title: string }) => {
      // Create new list
      const { data: newList, error: listErr } = await supabase
        .from('lists')
        .insert({ user_id: user!.id, title, description: null, is_public: false })
        .select()
        .single();
      if (listErr) throw listErr;

      // Copy items
      const { data: items, error: itemsErr } = await supabase
        .from('list_items')
        .select('title, sub, poster, type, position, library_item_id')
        .eq('list_id', listId);
      if (itemsErr) throw itemsErr;

      if (items && items.length > 0) {
        const { error: insertErr } = await supabase.from('list_items').insert(
          (items as any[]).map((item) => ({ ...item, list_id: (newList as ListRecord).id })),
        );
        if (insertErr) throw insertErr;
      }

      return newList as ListRecord;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lists', user?.id] }),
  });
}

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

// ─── Likes ───────────────────────────────────────────────────────────────────

export interface ListLikeState {
  liked: boolean;
  count: number;
}

function listLikeKey(listId: string) {
  return ['list-like', listId] as const;
}

export function useListLikeState(listId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: listLikeKey(listId!),
    queryFn: async (): Promise<ListLikeState> => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase.from('list_likes').select('*', { count: 'exact', head: true }).eq('list_id', listId!),
        supabase.from('list_likes').select('id').eq('list_id', listId!).eq('user_id', user!.id).maybeSingle(),
      ]);
      return { liked: !!mine, count: count ?? 0 };
    },
    enabled: !!listId && !!user,
  });
}

export function useToggleListLike() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, liked }: { listId: string; liked: boolean }) => {
      if (liked) {
        await supabase.from('list_likes').delete().eq('list_id', listId).eq('user_id', user!.id);
      } else {
        await supabase.from('list_likes').insert({ list_id: listId, user_id: user!.id });
      }
    },
    onMutate: async ({ listId, liked }) => {
      await qc.cancelQueries({ queryKey: listLikeKey(listId) });
      const prev = qc.getQueryData<ListLikeState>(listLikeKey(listId));
      qc.setQueryData<ListLikeState>(listLikeKey(listId), (old) =>
        old ? { liked: !liked, count: old.count + (liked ? -1 : 1) } : old,
      );
      return { prev };
    },
    onError: (_e, { listId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(listLikeKey(listId), ctx.prev);
    },
    onSettled: (_d, _e, { listId }) => qc.invalidateQueries({ queryKey: listLikeKey(listId) }),
  });
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface ListComment {
  id: string;
  list_id: string;
  user_id: string;
  parent_id: string | null;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  created_at: string;
  likes_count: number;
  liked_by_me: boolean;
  replies: ListComment[];
}

function listCommentsKey(listId: string) {
  return ['list-comments', listId] as const;
}

export function useListComments(listId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: listCommentsKey(listId!),
    queryFn: async (): Promise<ListComment[]> => {
      const { data, error } = await supabase
        .from('list_comments')
        .select('id, list_id, user_id, parent_id, content, created_at')
        .eq('list_id', listId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const commentIds = (data as any[]).map((r) => r.id);
      const userIds = [...new Set((data as any[]).map((r) => r.user_id))];

      const [{ data: profiles }, { data: likes }] = await Promise.all([
        supabase.from('profiles').select('id, username, avatar_url').in('id', userIds),
        supabase.from('comment_likes').select('comment_id, user_id').in('comment_id', commentIds),
      ]);

      const profileMap: Record<string, { username: string; avatar_url: string | null }> = {};
      for (const p of profiles ?? []) profileMap[p.id] = { username: p.username, avatar_url: p.avatar_url };

      const likeCountMap: Record<string, number> = {};
      const likedByMeSet = new Set<string>();
      for (const l of likes ?? []) {
        likeCountMap[l.comment_id] = (likeCountMap[l.comment_id] ?? 0) + 1;
        if (l.user_id === user?.id) likedByMeSet.add(l.comment_id);
      }

      const mapped: ListComment[] = (data as any[]).map((row) => ({
        id: row.id,
        list_id: row.list_id,
        user_id: row.user_id,
        parent_id: row.parent_id ?? null,
        user_name: profileMap[row.user_id]?.username ?? 'unknown',
        user_avatar_url: profileMap[row.user_id]?.avatar_url ?? null,
        content: row.content,
        created_at: row.created_at,
        likes_count: likeCountMap[row.id] ?? 0,
        liked_by_me: likedByMeSet.has(row.id),
        replies: [],
      }));

      // Group replies under parents
      const byId: Record<string, ListComment> = {};
      for (const c of mapped) byId[c.id] = c;
      const top: ListComment[] = [];
      for (const c of mapped) {
        if (c.parent_id && byId[c.parent_id]) {
          byId[c.parent_id].replies.push(c);
        } else {
          top.push(c);
        }
      }
      return top;
    },
    enabled: !!listId,
  });
}

export function useToggleCommentLike() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, listId, liked }: { commentId: string; listId: string; liked: boolean }) => {
      if (liked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', user!.id);
      } else {
        await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: user!.id });
      }
    },
    onMutate: async ({ commentId, listId, liked }) => {
      await qc.cancelQueries({ queryKey: listCommentsKey(listId) });
      const prev = qc.getQueryData<ListComment[]>(listCommentsKey(listId));
      qc.setQueryData<ListComment[]>(listCommentsKey(listId), (old) =>
        old?.map((c) =>
          c.id === commentId
            ? { ...c, liked_by_me: !liked, likes_count: c.likes_count + (liked ? -1 : 1) }
            : c,
        ),
      );
      return { prev };
    },
    onError: (_e, { listId }, ctx) => {
      if (ctx?.prev) qc.setQueryData(listCommentsKey(listId), ctx.prev);
    },
  });
}

export function useListCommentCount(listId: string | undefined) {
  return useQuery({
    queryKey: ['list-comment-count', listId],
    queryFn: async () => {
      const { count } = await supabase
        .from('list_comments')
        .select('*', { count: 'exact', head: true })
        .eq('list_id', listId!);
      return count ?? 0;
    },
    enabled: !!listId,
  });
}

export function useAddListComment() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ listId, content, parentId }: { listId: string; content: string; parentId?: string }) => {
      const { error } = await supabase
        .from('list_comments')
        .insert({ list_id: listId, user_id: user!.id, content, parent_id: parentId ?? null });
      if (error) throw error;
    },
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: listCommentsKey(listId) });
      qc.invalidateQueries({ queryKey: ['list-comment-count', listId] });
    },
  });
}

export function useDeleteListComment() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, listId }: { commentId: string; listId: string }) => {
      const { error } = await supabase
        .from('list_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_d, { listId }) => {
      qc.invalidateQueries({ queryKey: listCommentsKey(listId) });
      qc.invalidateQueries({ queryKey: ['list-comment-count', listId] });
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
