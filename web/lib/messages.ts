import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DmMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
}

export interface DmThread {
  friendId: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  lastText: string;
  lastTime: string;
  lastIsMine: boolean;
  isUnread: boolean;
}

export interface GroupThread {
  id: string;
  name: string | null;
  memberCount: number;
  lastText: string | null;
  lastTime: string | null;
  lastUser: string | null;
  isUnread: boolean;
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

// ── DM thread list ────────────────────────────────────────────────────────────

export function useDmThreads(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-dm-threads', userId],
    queryFn: async () => {
      // All messages involving the user, newest first
      const { data: messages, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(300);

      if (error) throw error;

      // Deduplicate into one thread per counterpart
      const counterpartIds: string[] = [];
      const latestByCounterpart = new Map<string, DmMessage>();
      for (const m of (messages ?? []) as DmMessage[]) {
        const other = m.sender_id === userId ? m.recipient_id : m.sender_id;
        if (!latestByCounterpart.has(other)) {
          latestByCounterpart.set(other, m);
          counterpartIds.push(other);
        }
      }

      if (!counterpartIds.length) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', counterpartIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      return counterpartIds.map((cid): DmThread => {
        const last = latestByCounterpart.get(cid)!;
        const profile = profileMap[cid] ?? {};
        return {
          friendId: cid,
          name: profile.full_name || profile.username || 'Someone',
          username: profile.username ?? null,
          avatarUrl: profile.avatar_url ?? null,
          lastText: last.content.length > 50 ? last.content.slice(0, 49) + '…' : last.content,
          lastTime: last.created_at,
          lastIsMine: last.sender_id === userId,
          isUnread: false, // simple for now — no server-side unread tracking on web yet
        };
      });
    },
    enabled: !!userId,
    staleTime: 20_000,
    refetchInterval: 20_000,
  });
}

// ── DM conversation ───────────────────────────────────────────────────────────

export function useDmMessages(userId: string | undefined, friendId: string | null) {
  return useQuery({
    queryKey: ['web-dm-messages', userId, friendId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
        .order('created_at', { ascending: true })
        .limit(500);
      if (error) throw error;
      return ((data ?? []) as DmMessage[]).filter(
        (m) =>
          (m.sender_id === userId && m.recipient_id === friendId) ||
          (m.sender_id === friendId && m.recipient_id === userId),
      );
    },
    enabled: !!userId && !!friendId,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useSendDm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      senderId,
      friendId,
      content,
    }: {
      senderId: string;
      friendId: string;
      content: string;
    }) => {
      const { error } = await supabase
        .from('direct_messages')
        .insert({ sender_id: senderId, recipient_id: friendId, content });
      if (error) throw error;
    },
    onSuccess: (_d, { senderId, friendId }) => {
      qc.invalidateQueries({ queryKey: ['web-dm-messages', senderId, friendId] });
      qc.invalidateQueries({ queryKey: ['web-dm-threads', senderId] });
    },
  });
}

// ── Group thread list ─────────────────────────────────────────────────────────

export function useGroupThreads(userId: string | undefined) {
  return useQuery({
    queryKey: ['web-group-threads', userId],
    queryFn: async () => {
      const { data: memberRows, error: mErr } = await supabase
        .from('group_chat_members')
        .select('chat_id')
        .eq('user_id', userId!);
      if (mErr) throw mErr;

      const chatIds = (memberRows ?? []).map((r: any) => r.chat_id);
      if (!chatIds.length) return [];

      const [groupsRes, allMembersRes, messagesRes] = await Promise.all([
        supabase.from('group_chats').select('id, name, created_at').in('id', chatIds),
        supabase.from('group_chat_members').select('chat_id').in('chat_id', chatIds),
        supabase
          .from('group_chat_messages')
          .select('chat_id, user_id, text, created_at, sender_name')
          .in('chat_id', chatIds)
          .order('created_at', { ascending: false })
          .limit(300),
      ]);

      if (groupsRes.error) throw groupsRes.error;

      const memberCounts: Record<string, number> = {};
      for (const r of allMembersRes.data ?? []) {
        memberCounts[r.chat_id] = (memberCounts[r.chat_id] ?? 0) + 1;
      }

      const latestMessageByChatId: Record<string, any> = {};
      for (const m of messagesRes.data ?? []) {
        if (!latestMessageByChatId[m.chat_id]) latestMessageByChatId[m.chat_id] = m;
      }

      return (groupsRes.data ?? []).map((g: any): GroupThread => {
        const last = latestMessageByChatId[g.id];
        return {
          id: g.id,
          name: g.name,
          memberCount: memberCounts[g.id] ?? 0,
          lastText: last?.text ?? null,
          lastTime: last?.created_at ?? g.created_at,
          lastUser: last?.sender_name ?? null,
          isUnread: false,
        };
      }).sort((a, b) => new Date(b.lastTime ?? 0).getTime() - new Date(a.lastTime ?? 0).getTime());
    },
    enabled: !!userId,
    staleTime: 20_000,
    refetchInterval: 20_000,
  });
}

// ── Group conversation ────────────────────────────────────────────────────────

export function useGroupMessages(groupId: string | null) {
  return useQuery({
    queryKey: ['web-group-messages', groupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('group_chat_messages')
        .select('id, chat_id, user_id, text, created_at, sender_name, sender_avatar')
        .eq('chat_id', groupId!)
        .order('created_at', { ascending: true })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as GroupMessage[];
    },
    enabled: !!groupId,
    staleTime: 5_000,
    refetchInterval: 5_000,
  });
}

export function useSendGroupMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      text,
      senderName,
      senderAvatar,
    }: {
      groupId: string;
      userId: string;
      text: string;
      senderName: string;
      senderAvatar: string | null;
    }) => {
      const { error } = await supabase.from('group_chat_messages').insert({
        chat_id: groupId,
        user_id: userId,
        text,
        sender_name: senderName,
        sender_avatar: senderAvatar,
      });
      if (error) throw error;
    },
    onSuccess: (_d, { groupId, userId }) => {
      qc.invalidateQueries({ queryKey: ['web-group-messages', groupId] });
      qc.invalidateQueries({ queryKey: ['web-group-threads', userId] });
    },
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      userId,
      name,
      memberIds,
    }: {
      userId: string;
      name: string | null;
      memberIds: string[];
    }) => {
      const { data: group, error: gErr } = await supabase
        .from('group_chats')
        .insert({ name: name || null, created_by: userId })
        .select('id')
        .single();
      if (gErr) throw gErr;

      const allIds = [...new Set([userId, ...memberIds])];
      const { error: mErr } = await supabase
        .from('group_chat_members')
        .insert(allIds.map((uid) => ({ chat_id: group.id, user_id: uid })));
      if (mErr) throw mErr;

      return group.id as string;
    },
    onSuccess: (_d, { userId }) => {
      qc.invalidateQueries({ queryKey: ['web-group-threads', userId] });
    },
  });
}

// ── People search (for starting a new DM / group) ────────────────────────────

export function useSearchPeople(query: string) {
  const q = query.trim().toLowerCase();
  return useQuery({
    queryKey: ['web-people-search', q],
    queryFn: async () => {
      if (!q) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(12);
      return (data ?? []) as { id: string; full_name: string | null; username: string | null; avatar_url: string | null }[];
    },
    enabled: q.length >= 1,
    staleTime: 10_000,
  });
}
