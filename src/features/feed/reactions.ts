import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Reaction {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  created_at: string;
}

function reactionsQueryKey(postIds: string[]) {
  return ['reactions', ...postIds.sort()] as const;
}

export function useReactions(postIds: string[]) {
  const query = useQuery({
    queryKey: reactionsQueryKey(postIds),
    queryFn: async () => {
      const { data, error } = await supabase.from('reactions').select('*').in('post_id', postIds);
      if (error) throw error;
      const reactions = data as Omit<Reaction, 'avatar_url'>[];
      const uniqueIds = [...new Set(reactions.map((r) => r.user_id))];
      const { data: profiles } = uniqueIds.length
        ? await supabase.from('profiles').select('id, avatar_url').in('id', uniqueIds)
        : { data: [] };
      const avatarMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.avatar_url as string | null]));
      return reactions.map((r) => ({ ...r, avatar_url: avatarMap[r.user_id] ?? null })) as Reaction[];
    },
    enabled: postIds.length > 0,
  });

  const byPost = new Map<string, Reaction[]>();
  for (const reaction of query.data ?? []) {
    const list = byPost.get(reaction.post_id) ?? [];
    list.push(reaction);
    byPost.set(reaction.post_id, list);
  }

  return { ...query, byPost };
}

export function useSendStoryLike() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({
      postId,
      postAuthorId,
      postTitle,
      postType,
      postPoster,
    }: {
      postId: string;
      postAuthorId: string;
      postTitle: string;
      postType: string;
      postPoster?: string | null;
    }) => {
      const userName = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      // Insert reaction
      await supabase
        .from('reactions')
        .upsert({ post_id: postId, user_id: user!.id, user_name: userName }, { onConflict: 'post_id,user_id' });
      // Notify post author (skip if reacting to own post)
      if (postAuthorId !== user!.id) {
        await supabase.from('notifications').insert({
          user_id: postAuthorId,
          from_user_id: user!.id,
          from_user_name: userName,
          type: 'story_like',
          post_id: postId,
          post_title: postTitle,
          post_type: postType,
          post_poster: postPoster ?? null,
          read: false,
        });
      }
    },
  });
}

export function useToggleReaction() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, reacted }: { postId: string; reacted: boolean }) => {
      if (reacted) {
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const userName = user?.user_metadata?.full_name ?? user?.email ?? 'You';
        const { error } = await supabase
          .from('reactions')
          .insert({ post_id: postId, user_id: user!.id, user_name: userName });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reactions'] });
    },
  });
}
