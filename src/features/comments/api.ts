import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  parent_id: string | null;
  created_at: string;
  upvote_count: number;
  did_upvote: boolean;
  reply_count: number;
}

async function enrichComments(
  rows: any[],
  myUpvotes: Set<string>,
): Promise<PostComment[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  // post_comments.user_id references auth.users, not profiles, so PostgREST
  // cannot embed the author — the previous
  // `profiles!post_comments_user_id_fkey(...)` hint failed with PGRST200 and
  // took the whole query down with it. Look the authors up separately, the way
  // the rest of the app does.
  const authorIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
  const [upvoteRows, replyRows, authorRows] = await Promise.all([
    supabase.from('post_comment_upvotes').select('comment_id').in('comment_id', ids),
    supabase.from('post_comments').select('parent_id').in('parent_id', ids),
    authorIds.length
      ? supabase.from('profiles').select('id, username, avatar_url').in('id', authorIds)
      : Promise.resolve({ data: [] as any[] }),
  ]);
  const authors = new Map<string, { username: string | null; avatar_url: string | null }>();
  for (const a of (authorRows.data ?? []) as any[]) {
    authors.set(a.id, { username: a.username, avatar_url: a.avatar_url });
  }
  const upvoteCounts = new Map<string, number>();
  for (const u of upvoteRows.data ?? []) {
    const id = (u as any).comment_id as string;
    upvoteCounts.set(id, (upvoteCounts.get(id) ?? 0) + 1);
  }
  const replyCounts = new Map<string, number>();
  for (const r of replyRows.data ?? []) {
    const pid = (r as any).parent_id as string;
    replyCounts.set(pid, (replyCounts.get(pid) ?? 0) + 1);
  }
  return rows.map((c) => ({
    id: c.id,
    post_id: c.post_id,
    user_id: c.user_id,
    user_name: authors.get(c.user_id)?.username ?? 'user',
    user_avatar_url: authors.get(c.user_id)?.avatar_url ?? null,
    content: c.content,
    parent_id: c.parent_id ?? null,
    created_at: c.created_at,
    upvote_count: upvoteCounts.get(c.id) ?? 0,
    did_upvote: myUpvotes.has(c.id),
    reply_count: replyCounts.get(c.id) ?? 0,
  }));
}

export function usePostComments(postId: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['post-comments', postId],
    queryFn: async () => {
      const [commentsRes, upvotesRes] = await Promise.all([
        supabase
          .from('post_comments')
          .select('*')
          .eq('post_id', postId)
          .is('parent_id', null)
          .order('created_at', { ascending: false }),
        user
          ? supabase.from('post_comment_upvotes').select('comment_id').eq('user_id', user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (commentsRes.error) throw commentsRes.error;
      const myUpvotes = new Set<string>((upvotesRes.data ?? []).map((u: any) => u.comment_id));
      return enrichComments(commentsRes.data ?? [], myUpvotes);
    },
    staleTime: 30_000,
  });
}

export function useCommentReplies(commentId: string, enabled: boolean) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['comment-replies', commentId],
    enabled,
    queryFn: async () => {
      const [repliesRes, upvotesRes] = await Promise.all([
        supabase
          .from('post_comments')
          .select('*')
          .eq('parent_id', commentId)
          .order('created_at', { ascending: true }),
        user
          ? supabase.from('post_comment_upvotes').select('comment_id').eq('user_id', user.id)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      if (repliesRes.error) throw repliesRes.error;
      const myUpvotes = new Set<string>((upvotesRes.data ?? []).map((u: any) => u.comment_id));
      return enrichComments(repliesRes.data ?? [], myUpvotes);
    },
    staleTime: 30_000,
  });
}

export function usePostCommentCount(postId: string) {
  return useQuery({
    queryKey: ['post-comment-count', postId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 60_000,
  });
}

export function usePostCommentCounts(postIds: string[]) {
  return useQuery({
    queryKey: ['post-comment-counts', postIds.slice().sort().join(',')],
    enabled: postIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('post_id')
        .in('post_id', postIds)
        .is('parent_id', null);
      if (error) throw error;
      const counts = new Map<string, number>();
      for (const row of data ?? []) {
        const pid = (row as any).post_id as string;
        counts.set(pid, (counts.get(pid) ?? 0) + 1);
      }
      return counts;
    },
    staleTime: 60_000,
  });
}

export function useAddComment() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      postId,
      content,
      parentId,
    }: {
      postId: string;
      content: string;
      parentId?: string;
    }) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: content.trim(),
        parent_id: parentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, { postId, parentId }) => {
      qc.invalidateQueries({ queryKey: ['post-comments', postId] });
      qc.invalidateQueries({ queryKey: ['post-comment-count', postId] });
      qc.invalidateQueries({ queryKey: ['post-comment-counts'] });
      if (parentId) qc.invalidateQueries({ queryKey: ['comment-replies', parentId] });
    },
  });
}

export function useToggleCommentUpvote() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      commentId,
      didUpvote,
      postId,
      parentId,
    }: {
      commentId: string;
      didUpvote: boolean;
      postId: string;
      parentId: string | null;
    }) => {
      if (!user) throw new Error('Not logged in');
      if (didUpvote) {
        const { error } = await supabase
          .from('post_comment_upvotes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_comment_upvotes')
          .insert({ comment_id: commentId, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: (_, { postId, parentId }) => {
      qc.invalidateQueries({ queryKey: ['post-comments', postId] });
      if (parentId) qc.invalidateQueries({ queryKey: ['comment-replies', parentId] });
    },
  });
}

export function useDeleteComment() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, postId }: { commentId: string; postId: string }) => {
      if (!user) throw new Error('Not logged in');
      const { error } = await supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: ['post-comments', postId] });
      qc.invalidateQueries({ queryKey: ['post-comment-count', postId] });
      qc.invalidateQueries({ queryKey: ['post-comment-counts'] });
    },
  });
}
