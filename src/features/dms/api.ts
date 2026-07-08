import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDmReadState } from '@/features/chats/read-state';
import { useFriends } from '@/features/friends/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface DirectMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

export interface DmThread {
  friendId: string;
  name: string;
  avatarUrl: string | null;
  lastText: string;
  lastTime: string;
  lastIsMine: boolean;
  isUnread: boolean;
  unreadCount: number;
}

export function useDmThreads() {
  const { user } = useSession();
  const { data: friends } = useFriends();
  const { loaded: readLoaded, isUnread, markRead } = useDmReadState();

  const query = useQuery({
    queryKey: ['dm-threads', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as DirectMessage[];
    },
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 15_000,
  });

  const nameById = new Map((friends ?? []).map((f) => [f.id, f.full_name || f.username || 'Someone']));
  const avatarById = new Map((friends ?? []).map((f) => [f.id, f.avatar_url]));

  // Count unread messages per counterpart from all fetched messages
  const unreadCountMap = new Map<string, number>();
  if (readLoaded) {
    for (const m of query.data ?? []) {
      if (m.sender_id === user?.id) continue;
      const counterpartId = m.sender_id;
      if (isUnread(counterpartId, m.created_at)) {
        unreadCountMap.set(counterpartId, (unreadCountMap.get(counterpartId) ?? 0) + 1);
      }
    }
  }

  const seen = new Set<string>();
  const threads: DmThread[] = [];
  for (const m of query.data ?? []) {
    const counterpartId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
    if (seen.has(counterpartId)) continue;
    seen.add(counterpartId);
    const unreadCount = unreadCountMap.get(counterpartId) ?? 0;
    threads.push({
      friendId: counterpartId,
      name: nameById.get(counterpartId) ?? 'Someone',
      avatarUrl: avatarById.get(counterpartId) ?? null,
      lastText: m.content,
      lastTime: m.created_at,
      lastIsMine: m.sender_id === user?.id,
      isUnread: unreadCount > 0,
      unreadCount,
    });
  }

  return { ...query, threads, markRead };
}

export function useDmMessages(friendId: string | null) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['dm-messages', friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user!.id},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${user!.id})`
        )
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return data as DirectMessage[];
    },
    enabled: !!friendId && !!user,
    staleTime: 0,
    refetchInterval: 5_000,
  });
}

export function useSendDm() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendId: string; content: string }) => {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user!.id,
        recipient_id: input.friendId,
        content: input.content,
      });
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages', input.friendId] });
      queryClient.invalidateQueries({ queryKey: ['dm-threads'] });
    },
  });
}
