import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { EntryType } from '@/constants/theme';
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

  const allIds = extendedNetwork ?? (user ? [user.id] : []);

  const query = useQuery({
    queryKey: ['chat-threads', user?.id, allIds.length],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .in('user_id', allIds)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const msgs = data as Message[];

      // Fetch poster art from the posts table for each channel title
      const titles = [...new Set(msgs.map((m) => m.title))];
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

      return { messages: msgs, posterByTitle };
    },
    // Wait for the extended network to load so the social-graph query is complete
    enabled: !!user && extendedNetwork !== undefined,
    staleTime: 0,
    refetchOnMount: 'always' as const,
    refetchInterval: 15_000,
  });

  const messages = query.data?.messages ?? [];
  const posterByTitle = query.data?.posterByTitle ?? new Map<string, string | null>();

  // Count unread messages per title
  const unreadCountMap = new Map<string, number>();
  if (readStateLoaded) {
    for (const m of messages) {
      if (m.user_id !== user?.id && isUnread(m.title, m.created_at)) {
        unreadCountMap.set(m.title, (unreadCountMap.get(m.title) ?? 0) + 1);
      }
    }
  }

  const seen = new Set<string>();
  const threads: ChatThread[] = [];
  for (const message of messages) {
    if (seen.has(message.title)) continue;
    seen.add(message.title);
    const unreadCount = unreadCountMap.get(message.title) ?? 0;
    threads.push({
      title: message.title,
      type: message.post_type ?? 'watch',
      poster: posterByTitle.get(message.title) ?? null,
      lastUser: message.user_name,
      lastText: message.content,
      lastTime: message.created_at,
      isUnread: unreadCount > 0,
      unreadCount,
    });
  }

  return { ...query, threads, markRead };
}

export function useThreadMessages(title: string | null) {
  return useQuery({
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
    staleTime: 0,
    refetchInterval: 5_000,
  });
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
