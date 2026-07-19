import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

// Predefined emoji set for the reaction bar
export const EMOJI_OPTIONS = ['❤️', '👍', '👎', '🔥', '🍿', '😂'];

export interface EmojiReaction {
  id: string;
  post_id: string;
  user_id: string;
  emoji: string;
}

/** { emoji → count } and { emoji → whether current user reacted } for a single post */
export interface EmojiReactionSummary {
  counts: Record<string, number>;
  mine: Set<string>;
}

function queryKey(postIds: string[]) {
  return ['emoji-reactions', ...postIds.sort()] as const;
}

export function useEmojiReactions(postIds: string[]) {
  const { user } = useSession();

  const query = useQuery({
    queryKey: queryKey(postIds),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('emoji_reactions')
        .select('id, post_id, user_id, emoji')
        .in('post_id', postIds);
      if (error) throw error;
      return (data ?? []) as EmojiReaction[];
    },
    enabled: postIds.length > 0,
  });

  const byPost = new Map<string, EmojiReactionSummary>();
  for (const r of query.data ?? []) {
    const entry = byPost.get(r.post_id) ?? { counts: {}, mine: new Set<string>() };
    entry.counts[r.emoji] = (entry.counts[r.emoji] ?? 0) + 1;
    if (r.user_id === user?.id) entry.mine.add(r.emoji);
    byPost.set(r.post_id, entry);
  }

  return { ...query, byPost };
}

export interface EmojiReactor {
  user_id: string;
  user_name: string;
  avatar_url: string | null;
}

export function useEmojiReactors(postId: string | null, emoji: string | null) {
  return useQuery({
    queryKey: ['emoji-reactors', postId, emoji],
    queryFn: async () => {
      const { data: reactions, error } = await supabase
        .from('emoji_reactions')
        .select('user_id')
        .eq('post_id', postId!)
        .eq('emoji', emoji!);
      if (error) throw error;
      const userIds = (reactions ?? []).map((r: any) => r.user_id);
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', userIds);
      return ((profiles ?? []) as any[]).map((p) => ({
        user_id: p.id,
        user_name: p.username ?? 'Someone',
        avatar_url: p.avatar_url ?? null,
      })) as EmojiReactor[];
    },
    enabled: !!postId && !!emoji,
  });
}

export function useToggleEmojiReaction() {
  const { user } = useSession();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      postId,
      emoji,
      reacted,
    }: {
      postId: string;
      emoji: string;
      reacted: boolean;
    }) => {
      if (reacted) {
        const { error } = await supabase
          .from('emoji_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user!.id)
          .eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('emoji_reactions')
          .insert({ post_id: postId, user_id: user!.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emoji-reactions'] });
    },
  });
}
