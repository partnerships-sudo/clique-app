import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export const TAPBACK_EMOJIS = ['❤️', '👍', '👎', '😂', '😮', '❗'];

export interface MessageReaction {
  id: string;
  user_id: string;
  emoji: string;
}

function reactionsKey(messageId: string) {
  return ['message-reactions', messageId] as const;
}

export function useMessageReactions(messageId: string) {
  return useQuery({
    queryKey: reactionsKey(messageId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_reactions')
        .select('id, user_id, emoji')
        .eq('message_id', messageId);
      if (error) throw error;
      return data as MessageReaction[];
    },
    staleTime: 10_000,
  });
}

export function useToggleMessageReaction(messageId: string, messageType: 'dm' | 'group' | 'chat') {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (emoji: string) => {
      const existing = queryClient.getQueryData<MessageReaction[]>(reactionsKey(messageId));
      const mine = existing?.find((r) => r.user_id === user!.id);
      if (mine?.emoji === emoji) {
        await supabase.from('message_reactions').delete().eq('id', mine.id);
      } else if (mine) {
        await supabase.from('message_reactions').update({ emoji }).eq('id', mine.id);
      } else {
        await supabase.from('message_reactions').insert({
          user_id: user!.id,
          message_type: messageType,
          message_id: messageId,
          emoji,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reactionsKey(messageId) });
    },
  });
}
