import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

// React Query's cache is the shared in-memory store so every hook instance
// (chats list, tab badge, thread screen) updates instantly when any one of
// them calls markRead — same guarantee as before, now backed by Supabase
// instead of AsyncStorage so state survives reinstalls and new devices.

type ThreadType = 'chat' | 'group' | 'dm';

function readStateQueryKey(type: ThreadType) {
  return ['read-state', type] as const;
}

function useReadState(type: ThreadType) {
  const { user } = useSession();
  const queryClient = useQueryClient();

  const { data: readMap = {}, isLoading } = useQuery({
    queryKey: readStateQueryKey(type),
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase
        .from('chat_read_state')
        .select('thread_key, last_read_at')
        .eq('user_id', user!.id)
        .eq('thread_type', type);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.thread_key, r.last_read_at as string]));
    },
    enabled: !!user,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const markRead = useCallback(
    (threadKey: string) => {
      const now = new Date().toISOString();
      // Optimistic in-memory update — instant badge clear
      queryClient.setQueryData(readStateQueryKey(type), { ...readMap, [threadKey]: now });
      // Persist to Supabase fire-and-forget
      if (user) {
        supabase
          .from('chat_read_state')
          .upsert(
            { user_id: user.id, thread_key: threadKey, thread_type: type, last_read_at: now },
            { onConflict: 'user_id,thread_key,thread_type' },
          )
          .then(() => {});
      }
    },
    [readMap, queryClient, type, user],
  );

  const isUnread = useCallback(
    (threadKey: string, messageTime: string) => {
      const lastRead = readMap[threadKey];
      if (!lastRead) return true;
      return new Date(messageTime) > new Date(lastRead);
    },
    [readMap],
  );

  return { loaded: !isLoading, markRead, isUnread };
}

export function useChatReadState() { return useReadState('chat'); }
export function useGroupReadState() { return useReadState('group'); }
export function useDmReadState() { return useReadState('dm'); }
