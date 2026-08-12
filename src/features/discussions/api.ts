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
  disagree_count: number;
  // viewer state
  has_voted: boolean;
  has_disagreed: boolean;
  has_poll: boolean;
  is_quiz: boolean;
  format: 'discussion' | 'poll' | 'hot_take';
  image_url: string | null;
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
  is_spoiler: boolean;
}

// ── List ────────────────────────────────────────────────────────────────────

// Helper: fetch a Set of discussion IDs that have at least one poll
async function fetchDiscussionIdsWithPolls(discussionIds: string[]): Promise<{ pollSet: Set<string>; quizSet: Set<string> }> {
  if (discussionIds.length === 0) return { pollSet: new Set(), quizSet: new Set() };
  const { data } = await supabase
    .from('discussion_polls')
    .select('discussion_id, is_quiz')
    .in('discussion_id', discussionIds);
  const pollSet = new Set((data ?? []).map((r: any) => r.discussion_id));
  const quizSet = new Set((data ?? []).filter((r: any) => r.is_quiz).map((r: any) => r.discussion_id));
  return { pollSet, quizSet };
}

export function useDiscussions(type?: DiscussionType | 'all') {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussions', type ?? 'all', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id, vote_type)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) { console.error('[discussions] fetch error:', JSON.stringify(error)); throw error; }

      const rows = data ?? [];

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      // Fetch which discussions have polls (separate query — reliable regardless of FK setup)
      const discussionIds = rows.map((r: any) => r.id);
      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls(discussionIds);

      return rows.map((row: any) => {
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
          has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: pollSet.has(row.id),
          is_quiz: quizSet.has(row.id),
          format: (row.format ?? 'discussion') as Discussion['format'],
          image_url: row.image_url ?? null,
        } as Discussion;
      }).filter((d) => !d.is_quiz && (!type || type === 'all' || d.type === type));
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
        .select('*, discussion_votes(user_id, vote_type)')
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
      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls([data.id]);
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
        has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"),
        disagree_count: data.disagree_count ?? 0,
        has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
        has_poll: pollSet.has(data.id),
        is_quiz: quizSet.has(data.id),
        format: (data.format ?? 'discussion') as Discussion['format'],
        image_url: data.image_url ?? null,
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
          is_spoiler: row.is_spoiler ?? false,
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
  format?: 'discussion' | 'poll' | 'hot_take';
  contentTitle?: string;
  contentPoster?: string;
  contentExternalId?: string;
  contentMediaType?: string;
  imageUrl?: string;
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
          format: input.format ?? 'discussion',
          content_title: input.contentTitle ?? null,
          content_poster: input.contentPoster ?? null,
          content_external_id: input.contentExternalId ?? null,
          content_media_type: input.contentMediaType ?? null,
          image_url: input.imageUrl ?? null,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      queryClient.invalidateQueries({ queryKey: ['trending-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['content-room-discussions'] });
    },
  });
}

// ── Update ────────────────────────────────────────────────────────────────────

export function useUpdateDiscussion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title, body, imageUrl }: { id: string; title: string; body: string | null; imageUrl?: string | null }) => {
      const patch: Record<string, unknown> = { title: title.trim(), body: body?.trim() || null };
      if (imageUrl !== undefined) patch.image_url = imageUrl;
      const { error } = await supabase
        .from('discussions')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.refetchQueries({ queryKey: ['discussion', id] });
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
    },
  });
}

// ── Vote (toggle) ─────────────────────────────────────────────────────────────

async function syncVoteCounts(discussionId: string) {
  const { error } = await supabase.rpc('sync_vote_counts', { p_discussion_id: discussionId });
  if (error) throw error;
}

export function useToggleDiscussionVote() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, hasVoted, hasDisagreed }: { discussionId: string; hasVoted: boolean; hasDisagreed: boolean }) => {
      const { error: delErr } = await supabase.from('discussion_votes').delete()
        .eq('discussion_id', discussionId).eq('user_id', user!.id);
      if (delErr) { console.error('[agree] delete error:', JSON.stringify(delErr)); throw delErr; }
      if (!hasVoted || hasDisagreed) {
        const { error: insErr } = await supabase.from('discussion_votes')
          .insert({ discussion_id: discussionId, user_id: user!.id, vote_type: 'agree' });
        if (insErr) { console.error('[agree] insert error:', JSON.stringify(insErr)); throw insErr; }
      }
      await syncVoteCounts(discussionId);
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['trending-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['saved-discussions'] });
    },
  });
}

export function useToggleDiscussionDisagree() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, hasDisagreed, hasVoted }: { discussionId: string; hasDisagreed: boolean; hasVoted: boolean }) => {
      // Remove existing vote (agree or disagree)
      await supabase.from('discussion_votes').delete()
        .eq('discussion_id', discussionId).eq('user_id', user!.id);
      // If wasn't already disagreed, insert disagree
      if (!hasDisagreed || hasVoted) {
        await supabase.from('discussion_votes')
          .insert({ discussion_id: discussionId, user_id: user!.id, vote_type: 'disagree' });
      }
      await syncVoteCounts(discussionId);
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['trending-discussions'] });
      queryClient.invalidateQueries({ queryKey: ['saved-discussions'] });
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
      isSpoiler,
    }: {
      discussionId: string;
      body: string;
      parentId?: string | null;
      isSpoiler?: boolean;
    }) => {
      const { error } = await supabase.from('discussion_comments').insert({
        discussion_id: discussionId,
        user_id: user!.id,
        body: body.trim(),
        parent_id: parentId ?? null,
        is_spoiler: isSpoiler ?? false,
      });
      if (error) throw error;
      // comment_count is maintained by the sync_discussion_comment_count DB trigger
    },
    onSuccess: (_data, { discussionId }) => {
      // Optimistically bump comment_count in every cached list so cards update instantly
      function bumpCount(old: Discussion[] | undefined): Discussion[] {
        return (old ?? []).map((d) =>
          d.id === discussionId ? { ...d, comment_count: d.comment_count + 1 } : d,
        );
      }
      queryClient.setQueriesData<Discussion[]>({ queryKey: ['discussions'] }, bumpCount);
      queryClient.setQueriesData<Discussion[]>({ queryKey: ['trending-discussions'] }, bumpCount);
      queryClient.setQueriesData<Discussion[]>({ queryKey: ['content-room-discussions'] }, bumpCount);

      queryClient.invalidateQueries({ queryKey: ['discussion-comments', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      // Delay list refetches so the trigger has time to commit before we read back
      setTimeout(() => {
        queryClient.refetchQueries({ queryKey: ['discussions'] });
        queryClient.refetchQueries({ queryKey: ['trending-discussions'] });
        queryClient.refetchQueries({ queryKey: ['content-room-discussions'] });
      }, 500);
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
      queryClient.invalidateQueries({ queryKey: ['trending-discussions'] });
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
      // Keep denormalized comment_count in sync
      const { count } = await supabase
        .from('discussion_comments')
        .select('*', { count: 'exact', head: true })
        .eq('discussion_id', discussionId);
      await supabase
        .from('discussions')
        .update({ comment_count: count ?? 0 })
        .eq('id', discussionId);
      return discussionId;
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-comments', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussion', discussionId] });
      queryClient.invalidateQueries({ queryKey: ['discussions'] });
      queryClient.invalidateQueries({ queryKey: ['trending-discussions'] });
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
        .select('*, discussion_votes(user_id, vote_type)')
        .order('upvote_count', { ascending: false })
        .order('comment_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);

      if (type && type !== 'all') {
        query = query.eq('type', type);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls(rows.map((r: any) => r.id));

      return rows.map((row: any) => {
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
          has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: pollSet.has(row.id), is_quiz: quizSet.has(row.id),
          format: (row.format ?? 'discussion') as Discussion['format'],
          image_url: row.image_url ?? null,
        } as Discussion;
      }).filter((d) => !d.is_quiz);
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
        .select('*, discussion_votes(user_id, vote_type)')
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

      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls(discussionRows.map((r: any) => r.id));

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
          has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: pollSet.has(row.id), is_quiz: quizSet.has(row.id),
          format: (row.format ?? 'discussion') as Discussion['format'],
          image_url: row.image_url ?? null,
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
        .select('*, discussion_votes(user_id, vote_type)')
        .eq('content_external_id', externalId!)
        .eq('content_media_type', mediaType!)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls(rows.map((r: any) => r.id));

      return rows.map((row: any) => {
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
          has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: pollSet.has(row.id), is_quiz: quizSet.has(row.id),
          format: (row.format ?? 'discussion') as Discussion['format'],
          image_url: row.image_url ?? null,
        } as Discussion;
      }).filter((d) => !d.is_quiz);
    },
    enabled: !!externalId && !!mediaType,
    staleTime: 30 * 1000,
  });
}

// ── Search discussions ────────────────────────────────────────────────────────

export interface DiscussionSearchResult {
  id: string;
  title: string;
  type: DiscussionType;
  comment_count: number;
  content_title: string | null;
  content_poster: string | null;
  content_external_id: string | null;
  content_media_type: string | null;
}

export function useDiscussionSearch(query: string) {
  return useQuery({
    queryKey: ['discussion-search', query],
    queryFn: async (): Promise<DiscussionSearchResult[]> => {
      if (!query.trim()) return [];
      // Match on discussion title OR linked content title
      const q = query.trim();
      const { data, error } = await supabase
        .from('discussions')
        .select('id, title, type, comment_count, content_title, content_poster, content_external_id, content_media_type')
        .or(`title.ilike.%${q}%,content_title.ilike.%${q}%`)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as DiscussionSearchResult[];
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

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number | null;
  vote_counts: number[];
  total_votes: number;
  my_vote: number | null;
}

export interface DiscussionPoll {
  id: string;
  discussion_id: string;
  question: string;
  options: string[];
  // aggregated client-side
  vote_counts: number[];   // parallel array to options
  total_votes: number;
  my_vote: number | null;  // option_index the current user voted, or null
  // multi-question quiz support (null = single-question poll)
  questions: QuizQuestion[] | null;
}

export function useDiscussionPoll(discussionId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussion-poll', discussionId, user?.id],
    queryFn: async () => {
      if (!discussionId) return null;

      const { data: poll, error } = await supabase
        .from('discussion_polls')
        .select('id, discussion_id, question, options, questions')
        .eq('discussion_id', discussionId)
        .maybeSingle();
      if (error) throw error;
      if (!poll) return null;

      const { data: votes } = await supabase
        .from('discussion_poll_votes')
        .select('option_index, question_index, user_id')
        .eq('poll_id', poll.id);

      const allVotes = votes ?? [];

      // Multi-question quiz
      if (poll.questions && Array.isArray(poll.questions)) {
        const rawQuestions: { question: string; options: string[]; correct_index?: number | null }[] = poll.questions;
        const questions: QuizQuestion[] = rawQuestions.map((q, qi) => {
          const qVotes = allVotes.filter((v) => v.question_index === qi);
          const vote_counts = q.options.map((_, oi) => qVotes.filter((v) => v.option_index === oi).length);
          const my_vote = user ? (qVotes.find((v) => v.user_id === user.id)?.option_index ?? null) : null;
          return { question: q.question, options: q.options, correct_index: q.correct_index ?? null, vote_counts, total_votes: qVotes.length, my_vote };
        });
        // Use first question as the top-level fields for backwards compat
        const first = questions[0];
        return {
          id: poll.id,
          discussion_id: poll.discussion_id,
          question: first.question,
          options: first.options,
          vote_counts: first.vote_counts,
          total_votes: first.total_votes,
          my_vote: first.my_vote,
          questions,
        } as DiscussionPoll;
      }

      // Single-question poll
      const options: string[] = Array.isArray(poll.options)
        ? poll.options
        : typeof poll.options === 'string'
          ? JSON.parse(poll.options)
          : [];
      const vote_counts = options.map((_, i) => allVotes.filter((v) => v.option_index === i).length);
      const my_vote = user ? (allVotes.find((v) => v.user_id === user.id)?.option_index ?? null) : null;

      return {
        id: poll.id,
        discussion_id: poll.discussion_id,
        question: poll.question,
        options,
        vote_counts,
        total_votes: allVotes.length,
        my_vote,
        questions: null,
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
    mutationFn: async ({ pollId, optionIndex, questionIndex = 0, discussionId }: { pollId: string; optionIndex: number; questionIndex?: number; discussionId: string }) => {
      const { error } = await supabase
        .from('discussion_poll_votes')
        .insert({ poll_id: pollId, user_id: user!.id, option_index: optionIndex, question_index: questionIndex });
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
    mutationFn: async ({ discussionId, question, options, questions }: { discussionId: string; question: string; options: string[]; questions?: { question: string; options: string[]; correct_index?: number | null }[] }) => {
      const { error } = await supabase
        .from('discussion_polls')
        .insert({ discussion_id: discussionId, question, options, questions: questions ?? null, is_quiz: !!questions });
      if (error) throw error;
    },
    onSuccess: (_data, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-poll', discussionId] });
    },
  });
}

// ── Content room follows ───────────────────────────────────────────────────────

export interface RoomFollowState {
  following: boolean;
  muted: boolean;
  rowId: string | null;
}

export function useRoomFollowState(externalId: string | undefined, mediaType: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['room-follow', externalId, mediaType, user?.id],
    queryFn: async (): Promise<RoomFollowState> => {
      if (!externalId || !mediaType || !user) return { following: false, muted: false, rowId: null };
      const { data } = await supabase
        .from('content_room_follows')
        .select('id, muted')
        .eq('user_id', user.id)
        .eq('external_id', externalId)
        .eq('media_type', mediaType)
        .maybeSingle();
      return data
        ? { following: true, muted: (data as any).muted ?? false, rowId: data.id }
        : { following: false, muted: false, rowId: null };
    },
    enabled: !!externalId && !!mediaType && !!user,
    staleTime: 60 * 1000,
  });
}

export function useMuteRoomFollow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ rowId, muted }: { rowId: string; muted: boolean; externalId: string; mediaType: string; userId: string | undefined }) => {
      const { error } = await supabase
        .from('content_room_follows')
        .update({ muted })
        .eq('id', rowId);
      if (error) throw error;
    },
    onMutate: async ({ externalId, mediaType, userId, muted }) => {
      const key = ['room-follow', externalId, mediaType, userId];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<RoomFollowState>(key);
      if (prev) queryClient.setQueryData(key, { ...prev, muted });
      return { prev, key };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, { externalId, mediaType, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['room-follow', externalId, mediaType, userId] });
    },
  });
}

export function useToggleRoomFollow() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ externalId, mediaType, following }: { externalId: string; mediaType: string; following: boolean }) => {
      if (!user) throw new Error('Not signed in');
      if (following) {
        const { error } = await supabase
          .from('content_room_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('external_id', externalId)
          .eq('media_type', mediaType);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('content_room_follows')
          .insert({ user_id: user.id, external_id: externalId, media_type: mediaType });
        if (error) throw error;
      }
    },
    onMutate: async ({ externalId, mediaType, following }) => {
      const key = ['room-follow', externalId, mediaType, user?.id];
      await queryClient.cancelQueries({ queryKey: key });
      const prev = queryClient.getQueryData<RoomFollowState>(key);
      queryClient.setQueryData(key, following
        ? { following: false, muted: false, rowId: null }
        : { following: true, muted: false, rowId: 'optimistic' });
      return { prev, key };
    },
    onError: (_err, _vars, ctx: any) => {
      if (ctx?.key) queryClient.setQueryData(ctx.key, ctx.prev);
    },
    onSettled: (_data, _err, { externalId, mediaType }) => {
      queryClient.invalidateQueries({ queryKey: ['room-follow', externalId, mediaType, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['followed-rooms-feed'] });
    },
  });
}

export interface FollowedRoomDiscussion {
  id: string;
  title: string;
  body: string | null;
  type: DiscussionType;
  upvote_count: number;
  comment_count: number;
  created_at: string;
  author_name: string;
  author_avatar: string | null;
  content_title: string | null;
  content_poster: string | null;
  content_external_id: string | null;
  content_media_type: string | null;
  has_voted: boolean;
}

export interface FollowedRoom {
  externalId: string;
  mediaType: string;
  contentTitle: string;
  contentPoster: string | null;
  followerCount: number;
}

export function useFollowedRooms() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['followed-rooms', user?.id],
    queryFn: async (): Promise<FollowedRoom[]> => {
      if (!user) return [];
      // Get rooms this user follows
      const { data: follows } = await supabase
        .from('content_room_follows')
        .select('external_id, media_type')
        .eq('user_id', user.id);
      if (!follows || follows.length === 0) return [];

      // For each room, get metadata from a recent discussion + follower count
      const rooms: FollowedRoom[] = [];
      for (const f of follows) {
        // Get content info from discussions table
        const { data: disc } = await supabase
          .from('discussions')
          .select('content_title, content_poster')
          .eq('content_external_id', f.external_id)
          .eq('content_media_type', f.media_type)
          .not('content_poster', 'is', null)
          .limit(1)
          .maybeSingle();
        // Get follower count
        const { count } = await supabase
          .from('content_room_follows')
          .select('id', { count: 'exact', head: true })
          .eq('external_id', f.external_id)
          .eq('media_type', f.media_type);
        if (disc?.content_title) {
          rooms.push({
            externalId: f.external_id,
            mediaType: f.media_type,
            contentTitle: disc.content_title,
            contentPoster: disc.content_poster ?? null,
            followerCount: count ?? 0,
          });
        }
      }
      return rooms;
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

export function useFollowedRoomsFeed() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['followed-rooms-feed', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get rooms this user follows
      const { data: follows } = await supabase
        .from('content_room_follows')
        .select('external_id, media_type')
        .eq('user_id', user.id);
      if (!follows || follows.length === 0) return [];

      // Fetch recent discussions for those rooms
      const results: any[] = [];
      for (const f of follows) {
        const { data } = await supabase
          .from('discussions')
          .select('*, discussion_votes(user_id, vote_type)')
          .eq('content_external_id', f.external_id)
          .eq('content_media_type', f.media_type)
          .order('created_at', { ascending: false })
          .limit(5);
        if (data) results.push(...data as any[]);
      }

      // Sort by activity: most comments + votes first, then most recent
      results.sort((a, b) => {
        const scoreA = (a.comment_count ?? 0) + (a.upvote_count ?? 0);
        const scoreB = (b.comment_count ?? 0) + (b.upvote_count ?? 0);
        if (scoreB !== scoreA) return scoreB - scoreA;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      // Hydrate author profiles
      const userIds = [...new Set(results.map((r) => r.user_id))];
      const profileMap = new Map<string, { full_name: string; username: string; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, username, avatar_url')
          .in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }

      const { pollSet: followedPollSet, quizSet: followedQuizSet } = await fetchDiscussionIdsWithPolls(results.map((r: any) => r.id));

      return results.filter((row: any) => !followedQuizSet.has(row.id)).map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id,
          title: row.title,
          body: row.body,
          type: row.type,
          upvote_count: row.upvote_count ?? 0,
          comment_count: row.comment_count ?? 0,
          created_at: row.created_at,
          author_name: profile?.full_name ?? profile?.username ?? 'Someone',
          author_avatar: profile?.avatar_url ?? null,
          content_title: row.content_title,
          content_poster: row.content_poster,
          content_external_id: row.content_external_id,
          content_media_type: row.content_media_type,
          has_voted: votes.some((v) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: followedPollSet.has(row.id),
        } as FollowedRoomDiscussion;
      });
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });
}

// ── Discussion emoji reactions ─────────────────────────────────────────────────

export const DISCUSSION_EMOJI_OPTIONS = ['🔥', '❤️', '👍', '😂', '😮', '🎉', '✨', '💯'];

export function useDiscussionReactions(discussionId: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussion-reactions', discussionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussion_reactions')
        .select('id, emoji, user_id')
        .eq('discussion_id', discussionId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      const mine = new Set<string>();
      for (const r of data ?? []) {
        counts[r.emoji] = (counts[r.emoji] ?? 0) + 1;
        if (r.user_id === user?.id) mine.add(r.emoji);
      }
      return { counts, mine };
    },
    enabled: !!discussionId,
  });
}

export function useToggleDiscussionReaction() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, emoji, reacted }: { discussionId: string; emoji: string; reacted: boolean }) => {
      if (reacted) {
        await supabase.from('discussion_reactions').delete()
          .eq('discussion_id', discussionId).eq('user_id', user!.id).eq('emoji', emoji);
      } else {
        await supabase.from('discussion_reactions').insert({ discussion_id: discussionId, user_id: user!.id, emoji });
      }
    },
    onSuccess: (_d, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-reactions', discussionId] });
    },
  });
}

// ── Discussion saves (bookmarks) ───────────────────────────────────────────────

export function useDiscussionSaved(discussionId: string) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['discussion-saved', discussionId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('discussion_saves')
        .select('id')
        .eq('discussion_id', discussionId)
        .eq('user_id', user!.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!discussionId,
  });
}

export function useSavedDiscussions(limit?: number) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['saved-discussions', user?.id, limit],
    queryFn: async () => {
      const q = supabase
        .from('discussion_saves')
        .select('discussion_id, created_at, discussions(*, discussion_votes(user_id, vote_type))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (limit) q.limit(limit);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []).map((r: any) => r.discussions).filter(Boolean);
      const ids = rows.map((r: any) => r.id);
      const { pollSet, quizSet } = await fetchDiscussionIdsWithPolls(ids);
      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', userIds);
        for (const p of profiles ?? []) profileMap.set(p.id, p);
      }
      return rows.map((row: any) => {
        const profile = profileMap.get(row.user_id);
        const votes: any[] = row.discussion_votes ?? [];
        return {
          id: row.id, user_id: row.user_id, title: row.title, body: row.body,
          type: row.type as DiscussionType, content_title: row.content_title,
          content_poster: row.content_poster, content_external_id: row.content_external_id,
          content_media_type: row.content_media_type, upvote_count: row.upvote_count,
          comment_count: row.comment_count, created_at: row.created_at,
          author_name: profile?.username || profile?.full_name || 'Someone',
          author_handle: profile?.username ?? '', author_avatar: profile?.avatar_url ?? null,
          has_voted: votes.some((v: any) => v.user_id === user?.id && v.vote_type === "agree"), disagree_count: row.disagree_count ?? 0, has_disagreed: votes.some((v: any) => v.user_id === user?.id && v.vote_type === "disagree"),
          has_poll: pollSet.has(row.id), is_quiz: quizSet.has(row.id),
          format: (row.format ?? 'discussion') as Discussion['format'],
          image_url: row.image_url ?? null,
        } as Discussion;
      }).filter((d) => !d.is_quiz);
    },
    enabled: !!user,
  });
}

export function useToggleDiscussionSave() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, saved }: { discussionId: string; saved: boolean }) => {
      if (saved) {
        await supabase.from('discussion_saves').delete()
          .eq('discussion_id', discussionId).eq('user_id', user!.id);
      } else {
        await supabase.from('discussion_saves').insert({ discussion_id: discussionId, user_id: user!.id });
      }
    },
    onSuccess: (_d, { discussionId }) => {
      queryClient.invalidateQueries({ queryKey: ['discussion-saved', discussionId] });
    },
  });
}
