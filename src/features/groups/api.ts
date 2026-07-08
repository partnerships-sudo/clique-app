import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useGroupReadState } from '@/features/chats/read-state';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface GroupThread {
  id: string;
  name: string | null;
  memberCount: number;
  lastText: string | null;
  lastTime: string;
  isUnread: boolean;
  unreadCount: number;
}

export interface GroupMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  isCreator: boolean;
}

export interface GroupMessage {
  id: string;
  chat_id: string;
  user_id: string;
  text: string;
  created_at: string;
  sender_name: string;
  sender_avatar: string | null;
}

export function useGroupThreads() {
  const { user } = useSession();
  const { loaded: readLoaded, isUnread, markRead } = useGroupReadState();
  const query = useQuery({
    queryKey: ['group-threads', user?.id],
    queryFn: async () => {
      const { data: memberRows, error: mErr } = await supabase
        .from('group_chat_members')
        .select('chat_id')
        .eq('user_id', user!.id);
      if (mErr) throw mErr;

      const chatIds = (memberRows ?? []).map((r) => r.chat_id);
      if (!chatIds.length) return [] as GroupThread[];

      const { data: groups, error: gErr } = await supabase
        .from('group_chats')
        .select('id, name, created_at')
        .in('id', chatIds)
        .order('created_at', { ascending: false });
      if (gErr) throw gErr;

      const threads: GroupThread[] = await Promise.all(
        (groups ?? []).map(async (g) => {
          const { count } = await supabase
            .from('group_chat_members')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', g.id);

          const { data: last } = await supabase
            .from('group_chat_messages')
            .select('text, created_at')
            .eq('chat_id', g.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            id: g.id,
            name: g.name,
            memberCount: count ?? 0,
            lastText: last?.text ?? null,
            lastTime: last?.created_at ?? g.created_at,
            isUnread: false,
            unreadCount: 0, // both filled below after read state loads
          };
        }),
      );

      return threads;
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchInterval: 15_000,
  });

  const threads = (query.data ?? []).map((t) => {
    const unread = readLoaded && !!t.lastText && isUnread(t.id, t.lastTime);
    return { ...t, isUnread: unread, unreadCount: unread ? 1 : 0 };
  });

  return { ...query, threads, markRead };
}

export function useGroupMembers(groupId: string | null) {
  return useQuery({
    queryKey: ['group-members', groupId],
    queryFn: async () => {
      const { data: gc, error: gcErr } = await supabase
        .from('group_chats')
        .select('created_by')
        .eq('id', groupId!)
        .single();
      if (gcErr) throw gcErr;

      const { data, error } = await supabase
        .from('group_chat_members')
        .select('user_id, profiles(full_name, username, avatar_url)')
        .eq('chat_id', groupId!);
      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        userId: row.user_id,
        name: row.profiles?.full_name ?? row.profiles?.username ?? 'Someone',
        avatarUrl: row.profiles?.avatar_url ?? null,
        isCreator: row.user_id === gc.created_by,
      })) as GroupMember[];
    },
    enabled: !!groupId,
  });
}

export function useCreateGroup() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string | null; memberIds: string[] }) => {
      const { data: group, error: gErr } = await supabase
        .from('group_chats')
        .insert({ name: input.name || null, created_by: user!.id })
        .select('id')
        .single();
      if (gErr) throw gErr;

      const allIds = [...new Set([user!.id, ...input.memberIds])];
      const { error: mErr } = await supabase
        .from('group_chat_members')
        .insert(allIds.map((uid) => ({ chat_id: group.id, user_id: uid })));
      if (mErr) throw mErr;

      return group.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-threads'] });
    },
  });
}

export function useGroupMessages(groupId: string | null) {
  return useQuery({
    queryKey: ['group-messages', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .select('id, chat_id, user_id, text, created_at, profiles(full_name, avatar_url)')
        .eq('chat_id', groupId!)
        .order('created_at', { ascending: true })
        .limit(100);
      if (error) throw error;
      return (data ?? []).map((m: any) => ({
        id: m.id,
        chat_id: m.chat_id,
        user_id: m.user_id,
        text: m.text,
        created_at: m.created_at,
        sender_name: (m.profiles as any)?.full_name ?? 'Someone',
        sender_avatar: (m.profiles as any)?.avatar_url ?? null,
      })) as GroupMessage[];
    },
    enabled: !!groupId,
    staleTime: 0,
    refetchInterval: 5_000,
  });
}

export function useSendGroupMessage(groupId: string | null) {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const { error } = await supabase
        .from('group_chat_messages')
        .insert({ chat_id: groupId!, user_id: user!.id, text });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-threads'] });
    },
  });
}

export function useAddGroupMembers(groupId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (memberIds: string[]) => {
      const { error } = await supabase
        .from('group_chat_members')
        .insert(memberIds.map((uid) => ({ chat_id: groupId!, user_id: uid })));
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', groupId] });
      queryClient.invalidateQueries({ queryKey: ['group-threads'] });
    },
  });
}
