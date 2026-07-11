import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useDmReadState } from '@/features/chats/read-state';
import { useMutualFollows } from '@/features/follows/api';
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
  /** True when this thread's content is gated — a non-mutual sender neither
   * of us has broken the ice with yet, from someone I haven't accepted. */
  isRequest: boolean;
}

interface DmRequestRow {
  id: string;
  sender_id: string;
  recipient_id: string;
  status: 'pending' | 'accepted';
}

function dmThreadStateQueryKey(userId: string | undefined, counterpartId: string | undefined) {
  return ['dm-thread-state', userId, counterpartId] as const;
}

export function useDmThreads() {
  const { user } = useSession();
  const { data: mutuals } = useMutualFollows();
  const { loaded: readLoaded, isUnread, markRead } = useDmReadState();

  const messagesQuery = useQuery({
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

  const requestsQuery = useQuery({
    queryKey: ['dm-requests', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dm_requests')
        .select('*')
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`);
      if (error) throw error;
      return data as DmRequestRow[];
    },
    enabled: !!user,
  });

  const messages = messagesQuery.data ?? [];
  const counterpartIds = [...new Set(messages.map((m) => (m.sender_id === user?.id ? m.recipient_id : m.sender_id)))];

  const profilesQuery = useQuery({
    queryKey: ['dm-counterpart-profiles', counterpartIds.slice().sort().join(',')],
    queryFn: async () => {
      if (!counterpartIds.length) return [];
      const { data, error } = await supabase.from('profiles').select('*').in('id', counterpartIds);
      if (error) throw error;
      return data as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[];
    },
    enabled: counterpartIds.length > 0,
  });

  const mutualIds = new Set((mutuals ?? []).map((m) => m.id));
  const acceptedCounterpartIds = new Set(
    (requestsQuery.data ?? [])
      .filter((r) => r.status === 'accepted')
      .map((r) => (r.sender_id === user?.id ? r.recipient_id : r.sender_id)),
  );
  // I can always see what I've sent, so having replied at all — whether via
  // the explicit Accept action or just by messaging back — is itself enough
  // to unlock a thread, on top of mutual follows / an explicit accept.
  const sentToIds = new Set(messages.filter((m) => m.sender_id === user?.id).map((m) => m.recipient_id));

  const nameById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p.full_name || p.username || 'Someone']));
  const avatarById = new Map((profilesQuery.data ?? []).map((p) => [p.id, p.avatar_url]));

  const unreadCountMap = new Map<string, number>();
  if (readLoaded) {
    for (const m of messages) {
      if (m.sender_id === user?.id) continue;
      const counterpartId = m.sender_id;
      if (isUnread(counterpartId, m.created_at)) {
        unreadCountMap.set(counterpartId, (unreadCountMap.get(counterpartId) ?? 0) + 1);
      }
    }
  }

  const seen = new Set<string>();
  const threads: DmThread[] = [];
  for (const m of messages) {
    const counterpartId = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
    if (seen.has(counterpartId)) continue;
    seen.add(counterpartId);
    const unreadCount = unreadCountMap.get(counterpartId) ?? 0;
    const isRequest =
      !mutualIds.has(counterpartId) && !acceptedCounterpartIds.has(counterpartId) && !sentToIds.has(counterpartId);
    threads.push({
      friendId: counterpartId,
      name: nameById.get(counterpartId) ?? 'Someone',
      avatarUrl: avatarById.get(counterpartId) ?? null,
      lastText: isRequest ? '' : m.content,
      lastTime: m.created_at,
      lastIsMine: m.sender_id === user?.id,
      isUnread: unreadCount > 0,
      unreadCount,
      isRequest,
    });
  }

  return {
    ...messagesQuery,
    isLoading: messagesQuery.isLoading || profilesQuery.isLoading,
    threads: threads.filter((t) => !t.isRequest),
    requestThreads: threads.filter((t) => t.isRequest),
    markRead,
  };
}

/** Whether a specific thread is locked for the signed-in user right now —
 * used by the thread-detail screen to decide whether to show message
 * content or an Accept/Decline prompt. */
export function useDmThreadState(counterpartId: string | undefined) {
  const { user } = useSession();
  const { data: mutuals } = useMutualFollows();
  return useQuery({
    queryKey: dmThreadStateQueryKey(user?.id, counterpartId),
    queryFn: async (): Promise<{ locked: boolean }> => {
      const isMutual = (mutuals ?? []).some((m) => m.id === counterpartId);
      if (isMutual) return { locked: false };

      const [{ data: requestRows, error: reqErr }, { data: sentRows, error: sentErr }] = await Promise.all([
        supabase
          .from('dm_requests')
          .select('status')
          .or(
            `and(sender_id.eq.${user!.id},recipient_id.eq.${counterpartId}),and(sender_id.eq.${counterpartId},recipient_id.eq.${user!.id})`,
          ),
        supabase
          .from('direct_messages')
          .select('id')
          .eq('sender_id', user!.id)
          .eq('recipient_id', counterpartId!)
          .limit(1),
      ]);
      if (reqErr) throw reqErr;
      if (sentErr) throw sentErr;

      const hasAccepted = (requestRows ?? []).some((r) => r.status === 'accepted');
      const iHaveSent = (sentRows ?? []).length > 0;
      return { locked: !hasAccepted && !iHaveSent };
    },
    enabled: !!user && !!counterpartId && mutuals !== undefined,
  });
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
  const { data: mutuals } = useMutualFollows();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { friendId: string; content: string }) => {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user!.id,
        recipient_id: input.friendId,
        content: input.content,
      });
      if (error) throw error;

      const isMutual = (mutuals ?? []).some((m) => m.id === input.friendId);
      if (!isMutual) {
        // ignoreDuplicates so a second message from the same non-mutual
        // sender never downgrades an already-accepted request back to
        // pending.
        await supabase
          .from('dm_requests')
          .upsert(
            { sender_id: user!.id, recipient_id: input.friendId, status: 'pending' },
            { onConflict: 'sender_id,recipient_id', ignoreDuplicates: true },
          );
      }
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['dm-messages', input.friendId] });
      queryClient.invalidateQueries({ queryKey: ['dm-threads'] });
      queryClient.invalidateQueries({ queryKey: ['dm-requests', user?.id] });
      queryClient.invalidateQueries({ queryKey: dmThreadStateQueryKey(user?.id, input.friendId) });
    },
  });
}

export function useAcceptDmRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (senderId: string) => {
      const { error } = await supabase
        .from('dm_requests')
        .update({ status: 'accepted' })
        .eq('sender_id', senderId)
        .eq('recipient_id', user!.id);
      if (error) throw error;
    },
    onSuccess: (_, senderId) => {
      queryClient.invalidateQueries({ queryKey: ['dm-threads'] });
      queryClient.invalidateQueries({ queryKey: ['dm-requests', user?.id] });
      queryClient.invalidateQueries({ queryKey: dmThreadStateQueryKey(user?.id, senderId) });
    },
  });
}

export function useDeclineDmRequest() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (senderId: string) => {
      const { error } = await supabase
        .from('dm_requests')
        .delete()
        .eq('sender_id', senderId)
        .eq('recipient_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dm-threads'] });
      queryClient.invalidateQueries({ queryKey: ['dm-requests', user?.id] });
    },
  });
}
