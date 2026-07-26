import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
import { useBlockedMutedIds } from '@/features/blocks/api';
import { useChatReadState } from '@/features/chats/read-state';
import { useDmThreads } from '@/features/dms/api';
import { useExtendedNetwork } from '@/features/follows/api';
import { useGroupThreads } from '@/features/groups/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Message {
  id: string;
  user_id: string;
  user_name: string;
  title: string;
  content: string;
  post_type: EntryType;
  ep_season: number | null;
  ep_episode: number | null;
  created_at: string;
}

export interface ChatThread {
  title: string;
  type: EntryType;
  poster: string | null;
  lastUser: string;
  lastText: string;
  lastTime: string;
  isUnread: boolean;
  unreadCount: number;
}

/**
 * Open content-chat channels — one channel per title (movie/book/game/etc).
 * Shows all channels active within the user's extended network: mutual
 * follows plus one degree of separation beyond them (a friend-of-a-friend
 * watching the same thing surfaces the room too). Anyone in that reach can
 * see and post in any channel; it's not scoped to what's in the user's own
 * feed. Like Slack channels for your extended friend group.
 */
export function useChatThreads() {
  const { user } = useSession();
  const { data: extendedNetwork } = useExtendedNetwork();
  const { loaded: readStateLoaded, isUnread, markRead } = useChatReadState();
  const { blockedIds } = useBlockedMutedIds();

  const allIds = extendedNetwork ?? (user ? [user.id] : []);

  // Threads the current user has written in — only these get unread badges
  const { data: participatedTitles } = useQuery({
    queryKey: ['chat-participated', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('messages')
        .select('title')
        .eq('user_id', user!.id);
      return new Set((data ?? []).map((r: any) => r.title as string));
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const query = useQuery({
    queryKey: ['chat-threads', user?.id, allIds.length],
    queryFn: async () => {
      // Server-side DISTINCT ON per title — one row per thread instead of 500 rows
      const { data, error } = await supabase.rpc('get_chat_threads', {
        user_ids: allIds,
      });
      if (error) throw error;

      const rows = (data ?? []) as {
        title: string;
        post_type: string;
        last_user_id: string;
        last_user: string;
        last_text: string;
        last_time: string;
      }[];

      // Fetch poster art for each thread title
      const titles = rows.map((r) => r.title);
      let posterByTitle = new Map<string, string | null>();
      if (titles.length > 0) {
        const { data: postsData } = await supabase
          .from('posts')
          .select('title, poster')
          .in('title', titles);
        posterByTitle = new Map(
          (postsData ?? []).map((p: any) => [p.title, p.poster ?? null]),
        );
      }

      return { rows, posterByTitle };
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const rows = query.data?.rows ?? [];
  const posterByTitle = query.data?.posterByTitle ?? new Map<string, string | null>();

  const threads: ChatThread[] = rows
    .filter((r) => !blockedIds.has(r.last_user_id) || r.last_user_id === user?.id)
    .map((r) => {
      const hasParticipated = participatedTitles?.has(r.title) ?? false;
      const unread = readStateLoaded && hasParticipated && r.last_user_id !== user?.id && isUnread(r.title, r.last_time);
      return {
        title: r.title,
        type: (r.post_type ?? 'watch') as ChatThread['type'],
        poster: posterByTitle.get(r.title) ?? null,
        lastUser: r.last_user,
        lastText: r.last_text,
        lastTime: r.last_time,
        isUnread: unread,
        unreadCount: unread ? 1 : 0,
      };
    });

  return { ...query, threads, markRead };
}

export function useThreadMessages(title: string | null) {
  const { user } = useSession();
  const { blockedIds } = useBlockedMutedIds();
  const query = useQuery({
    queryKey: ['messages', title],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('title', title!)
        .order('created_at', { ascending: true })
        .limit(200);
      if (error) throw error;
      return data as Message[];
    },
    enabled: !!title,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
  const data = useMemo(
    () => (query.data ?? []).filter((m) => m.user_id === user?.id || !blockedIds.has(m.user_id)),
    [query.data, user?.id, blockedIds],
  );
  return { ...query, data };
}

export function useSendMessage() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      type: EntryType;
      content: string;
      epSeason?: number;
      epEpisode?: number;
    }) => {
      const userName = user?.user_metadata?.full_name ?? user?.email ?? 'You';
      const { error } = await supabase.from('messages').insert({
        user_id: user!.id,
        user_name: userName,
        title: input.title,
        content: input.content,
        post_type: input.type,
        ep_season: input.epSeason ?? null,
        ep_episode: input.epEpisode ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['messages', input.title] });
      queryClient.invalidateQueries({ queryKey: ['chat-threads'] });
      queryClient.invalidateQueries({ queryKey: ['chat-participated', user?.id] });
    },
  });
}

export interface UnreadBreakdown {
  content: number;
  private: number;
  total: number;
}

/** Unread message counts broken down by section (content chats, private chats, total). */
export function useUnreadChatsCount(): UnreadBreakdown {
  const { threads } = useChatThreads();
  const { threads: dmThreads } = useDmThreads();
  const { threads: groupThreads } = useGroupThreads();

  const content = threads.reduce((sum, t) => sum + t.unreadCount, 0);
  const privateCount =
    dmThreads.reduce((sum, t) => sum + t.unreadCount, 0) +
    groupThreads.reduce((sum, t) => sum + t.unreadCount, 0);

  return { content, private: privateCount, total: content + privateCount };
}
