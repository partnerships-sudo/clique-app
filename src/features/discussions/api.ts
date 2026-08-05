import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export type DiscussionType = 'read' | 'watch' | 'tv' | 'play' | 'listen' | 'podcast' | 'general';

export interface Discussion {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: DiscussionType;
  content_title: string | null;
  content_poster: string | null;
  content_external_id: string | null;
  content_media_type: string | null;
  upvote_count: number;
  comment_count: number;
  created_at: string;
  // joined from profiles
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  // viewer state
  has_voted: boolean;
}

export interface DiscussionComment {
  id: string;
  discussion_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
}

// ── List ────────────────────────────────────────────────────────────────────

export function useDiscussions(type?: DiscussionType | 'all') {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussions', type ?? 'all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) { console.error('[discussions] fetch error:', JSON.stringify(error)); throw error; }

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      return (data ?? []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id,
          user_id: row.user_id,
          title: row.title,
          body: row.body,
          type: row.type as DiscussionType,
          content_title: row.content_title,
          content_poster: row.content_poster,
          content_external_id: row.content_external_id,
          content_media_type: row.content_media_type,
          upvote_count: row.upvote_count,
          comment_count: row.comment_count,
          created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '',
          author_avatar: profile?.avatar_url ?? null,
          has_voted: votes.some((v) => v.user_id === user?.id),
        } as Discussion;
      }).filter((d) => !type || type === 'all' || d.type === type);
    },
    staleTime: 60 * 1000,
  });
}

// ── Single discussion (for detail screen) ────────────────────────────────────

export function useDiscussion(id: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussion', id, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id)')
        .eq('id', id!)
        .single();
      if (error) throw error;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, username, avatar_url')
        .eq('id', data.user_id)
        .single();
      const profile = profileData;
      const votes: any[] = data.discussion_votes ?? [];
      return {
        id: data.id,
        user_id: data.user_id,
        title: data.title,
        body: data.body,
        type: data.type as DiscussionType,
        content_title: data.content_title,
        content_poster: data.content_poster,
        content_external_id: data.content_external_id,
        content_media_type: data.content_media_type,
        upvote_count: data.upvote_count,
        comment_count: data.comment_count,
        created_at: data.created_at,
        author_name: (profile as any)?.username || profile?.full_name || 'Someone',
        author_handle: (profile as any)?.username ?? '',
        author_avatar: profile?.avatar_url ?? null,
        has_voted: votes.some((v) => v.user_id === user?.id),
      } as Discussion;
    },
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function useDiscussionComments(discussionId: string | undefined) {
  return useQuery({
    queryKey: ['discussion-comments', discussionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussion_comments')
        .select('*')
        .eq('discussion_id', discussionId!)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      return (data ?? []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        return {
          id: row.id,
          discussion_id: row.discussion_id,
          user_id: row.user_id,
          body: row.body,
          parent_id: row.parent_id,
          created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '',
          author_avatar: profile?.avatar_url ?? null,
        } as DiscussionComment;
      });
    },
    enabled: !!discussionId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

// ── Create discussion ─────────────────────────────────────────────────────────

export interface CreateDiscussionInput {
  title: string;
  body?: string;
  type: DiscussionType;
  contentTitle?: string;
  contentPoster?: string;
  contentExternalId?: string;
  contentMediaType?: string;
}

export function useCreateDiscussion() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateDiscussionInput) => {
      const { data, error } = await supabase
        .from('discussions')
        .insert({
          user_id: user!.id,
          title: input.title.trim(),
          body: input.body?.trim() || null,
          type: input.type,
          content_title: input.contentTitle ?? null,
          content_poster: input.contentPoster ?? null,
          content_external_id: input.contentExternalId ?? null,
          content_media_type: input.contentMediaType ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

// ── Vote (toggle) ─────────────────────────────────────────────────────────────

export function useToggleDiscussionVote() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, hasVoted }: { discussionId: string; hasVoted: boolean }) => {
      if (hasVoted) {
        const { error } = await supabase
          .from('discussion_votes')
          .delete()
          .eq('discussion_id', discussionId)
          .eq('user_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('discussion_votes')
          .insert({ discussion_id: discussionId, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
    },
  });
}

// ── Add comment ───────────────────────────────────────────────────────────────

export function useAddDiscussionComment() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      discussionId,
      body,
      parentId,
    }: {
      discussionId: string;
      body: string;
      parentId?: string | null;
    }) => {
      const { error } = await supabase.from('discussion_comments').insert({
        discussion_id: discussionId,
        user_id: user!.id,
        body: body.trim(),
        parent_id: parentId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-comments', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

// ── Delete discussion ─────────────────────────────────────────────────────────

export function useDeleteDiscussion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('discussions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

// ── Delete comment ────────────────────────────────────────────────────────────

export function useDeleteDiscussionComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, discussionId }: { id: string; discussionId: string }) => {
      const { error } = await supabase.from('discussion_comments').delete().eq('id', id);
      if (error) throw error;
      return discussionId;
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-comments', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

// ── Trending discussions (top by engagement) ──────────────────────────────────

export function useTrendingDiscussions(limit = 5, type?: DiscussionType | 'all') {
  const { user } = useSession();
  return useQuery({
    queryKey: ['trending-discussions', limit, type ?? 'all', user?.id],
    queryFn: async () => {
      let query = supabase
        .from('discussions')
        .select('*, discussion_votes(user_id)')
        .order('upvote_count', { ascending: false })
        .order('comment_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      return (data ?? []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id,
          user_id: row.user_id,
          title: row.title,
          body: row.body,
          type: row.type as DiscussionType,
          content_title: row.content_title,
          content_poster: row.content_poster,
          content_external_id: row.content_external_id,
          content_media_type: row.content_media_type,
          upvote_count: row.upvote_count,
          comment_count: row.comment_count,
          created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '',
          author_avatar: profile?.avatar_url ?? null,
          has_voted: votes.some((v) => v.user_id === user?.id),
        } as Discussion;
      });
    },
    staleTime: 60 * 1000,
  });
}

// ── Personalized content rooms (based on user's recent logs) ──────────────────

export interface PersonalizedRoom {
  externalId: string;
  mediaType: string;
  contentTitle: string;
  contentPoster: string | null;
  discussions: Discussion[];
}

export function usePersonalizedRooms() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['personalized-rooms', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Fetch user's recent unique logged items that have an external_id
      const { data: recentPosts } = await supabase
        .from('posts')
        .select('external_id, media_type, title, poster')
        .eq('user_id', user.id)
        .not('external_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30);

      if (!recentPosts?.length) return [];

      // Deduplicate by external_id, keep most recent occurrence
      const seen = new Set<string>();
      const uniqueItems: { externalId: string; mediaType: string; title: string; poster: string | null }[] = [];
      for (const p of recentPosts) {
        if (p.external_id && !seen.has(p.external_id)) {
          seen.add(p.external_id);
          uniqueItems.push({
            externalId: p.external_id,
            mediaType: p.media_type ?? '',
            title: p.title,
            poster: p.poster ?? null,
          });
        }
      }

      // Find which of these have discussions
      const externalIds = uniqueItems.map((i) => i.externalId);
      const { data: discussionRows, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id)')
        .in('content_external_id', externalIds)
        .order('created_at', { ascending: false });
      if (error) throw error;

      if (!discussionRows?.length) return [];

      // Fetch profiles for discussion authors
      const authorIds = [...new Set(discussionRows.map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', authorIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      const mapDiscussion = (row: any): Discussion => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id, user_id: row.user_id, title: row.title, body: row.body,
          type: row.type as DiscussionType,
          content_title: row.content_title, content_poster: row.content_poster,
          content_external_id: row.content_external_id, content_media_type: row.content_media_type,
          upvote_count: row.upvote_count, comment_count: row.comment_count, created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '', author_avatar: profile?.avatar_url ?? null,
          has_voted: votes.some((v) => v.user_id === user?.id),
        };
      };

      // Group discussions by external_id, preserving user's log order
      const rooms: PersonalizedRoom[] = [];
      for (const item of uniqueItems) {
        const itemDiscussions = discussionRows
          .filter((r: any) => r.content_external_id === item.externalId)
          .map(mapDiscussion);
        if (itemDiscussions.length > 0) {
          rooms.push({
            externalId: item.externalId,
            mediaType: item.mediaType,
            contentTitle: item.title,
            contentPoster: item.poster,
            discussions: itemDiscussions,
          });
        }
      }

      return rooms.slice(0, 5); // max 5 personalized sections
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Content room (all discussions for one piece of content) ──────────────────

export function useContentRoomDiscussions(externalId: string | undefined, mediaType: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['content-room-discussions', externalId, mediaType, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id)')
        .eq('content_external_id', externalId!)
        .eq('content_media_type', mediaType!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      return (data ?? []).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id,
          user_id: row.user_id,
          title: row.title,
          body: row.body,
          type: row.type as DiscussionType,
          content_title: row.content_title,
          content_poster: row.content_poster,
          content_external_id: row.content_external_id,
          content_media_type: row.content_media_type,
          upvote_count: row.upvote_count,
          comment_count: row.comment_count,
          created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '',
          author_avatar: profile?.avatar_url ?? null,
          has_voted: votes.some((v) => v.user_id === user?.id),
        } as Discussion;
      });
    },
    enabled: !!externalId && !!mediaType,
    staleTime: 30 * 1000,
  });
}

// ── Search discussions ────────────────────────────────────────────────────────

export function useDiscussionSearch(query: string) {
  return useQuery({
    queryKey: ['discussion-search', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const { data, error } = await supabase
        .from('discussions')
        .select('id, title, type, comment_count')
        .ilike('title', `%${query.trim()}%`)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as { id: string; title: string; type: DiscussionType; comment_count: number }[];
    },
    enabled: query.trim().length >= 2,
    staleTime: 30 * 1000,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Polls ─────────────────────────────────────────────────────────────────────

export interface DiscussionPoll {
  id: string;
  discussion_id: string;
  question: string;
  options: string[];
  // aggregated client-side
  vote_counts: number[];   // parallel array to options
  total_votes: number;
  my_vote: number | null;  // option_index the current user voted, or null
}

export function useDiscussionPoll(discussionId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussion-poll', discussionId, user?.id],
    queryFn: async () => {
      if (!discussionId) return null;

      const { data: poll, error } = await supabase
        .from('discussion_polls')
        .select('id, discussion_id, question, options')
        .eq('discussion_id', discussionId)
        .maybeSingle();
      if (error) throw error;
      if (!poll) return null;

      const { data: votes } = await supabase
        .from('discussion_poll_votes')
        .select('option_index, user_id')
        .eq('poll_id', poll.id);

      const options: string[] = Array.isArray(poll.options) ? poll.options : JSON.parse(poll.options as any);
      const vote_counts = options.map((_, i) => (votes ?? []).filter((v) => v.option_index === i).length);
      const my_vote = user ? ((votes ?? []).find((v) => v.user_id === user.id)?.option_index ?? null) : null;

      return {
        id: poll.id,
        discussion_id: poll.discussion_id,
        question: poll.question,
        options,
        vote_counts,
        total_votes: (votes ?? []).length,
        my_vote,
      } as DiscussionPoll;
    },
    enabled: !!discussionId,
    staleTime: 30_000,
  });
}

export function useVoteOnPoll() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, optionIndex, discussionId }: { pollId: string; optionIndex: number; discussionId: string }) => {
      const { error } = await supabase
        .from('discussion_poll_votes')
        .insert({ poll_id: pollId, user_id: user!.id, option_index: optionIndex });
      if (error) throw error;
      return { discussionId };
    },
    onSuccess: ({ discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-poll', discussionId] });
    },
  });
}

export function useCreateDiscussionPoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, question, options }: { discussionId: string; question: string; options: string[] }) => {
      const { error } = await supabase
        .from('discussion_polls')
        .insert({ discussion_id: discussionId, question, options });
      if (error) throw error;
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-poll', discussionId] });
    },
  });
}
