import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { useProfile } from '@/features/profile/api';
import { buildWatchPartyInvite } from '@/features/dms/watch-party-invite';
import { supabase } from '@/lib/supabase';

export function useSendPremiereMessage() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({
      premiereId,
      content,
      relativeMs,
    }: {
      premiereId: string;
      content: string;
      relativeMs: number | null;
    }) => {
      const { error } = await supabase.from('premiere_messages').insert({
        premiere_id: premiereId,
        user_id: user!.id,
        user_name: profile?.full_name ?? profile?.username ?? 'Someone',
        user_avatar_url: profile?.avatar_url ?? null,
        content,
        relative_ms: relativeMs,
      });
      if (error) throw error;
    },
  });
}

export function useEndPremiere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (premiereId: string) => {
      const { error } = await supabase
        .from('premieres')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', premiereId);
      if (error) throw error;
    },
    onSuccess: (_data, premiereId) => {
      queryClient.invalidateQueries({ queryKey: ['premiere', premiereId] });
      queryClient.invalidateQueries({ queryKey: ['premieres'] });
    },
  });
}

export type PremiereStatus = 'waiting' | 'live' | 'ended' | 'replay';

export interface Premiere {
  id: string;
  host_user_id: string;
  host_name: string;
  host_avatar_url: string | null;
  show_title: string;
  show_poster: string | null;
  external_id: string | null;
  episode_name: string;
  episode_number: number;
  season_number: number;
  air_date: string;
  air_time: string | null;
  tagline: string | null;
  status: PremiereStatus;
  live_started_at: string | null;
  created_at: string;
}

export interface PremiereMessage {
  id: string;
  premiere_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  relative_ms: number | null;
  created_at: string;
}

export function useCreatePremiere() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      showTitle: string;
      showPoster: string | null;
      externalId: string | null;
      episodeName: string;
      episodeNumber: number;
      seasonNumber: number;
      airDate: string;
      airTime: string | null;
      tagline: string | null;
    }) => {
      const hostName = profile?.full_name ?? profile?.username ?? user?.email?.split('@')[0] ?? 'Someone';
      const { data, error } = await supabase
        .from('premieres')
        .insert({
          host_user_id: user!.id,
          host_name: hostName,
          host_avatar_url: profile?.avatar_url ?? null,
          show_title: input.showTitle,
          show_poster: input.showPoster,
          external_id: input.externalId,
          episode_name: input.episodeName,
          episode_number: input.episodeNumber,
          season_number: input.seasonNumber,
          air_date: input.airDate,
          air_time: input.airTime,
          tagline: input.tagline,
          status: 'waiting',
        })
        .select()
        .single();
      if (error) throw error;
      return data as Premiere;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premieres'] });
    },
  });
}

export function usePremiere(id: string | null) {
  return useQuery({
    queryKey: ['premiere', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premieres')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Premiere;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useMyPremieres() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['premieres', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premieres')
        .select('*')
        .eq('host_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Premiere[];
    },
    enabled: !!user,
  });
}

export type RsvpStatus = 'invited' | 'attending' | 'maybe' | 'not_attending';
export type PremiereWithRsvp = Premiere & { rsvp_status: RsvpStatus };

export function useAttendingPremieres() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['premieres-attending', user?.id],
    queryFn: async () => {
      const { data: members, error: membErr } = await supabase
        .from('premiere_members')
        .select('premiere_id, rsvp_status')
        .eq('user_id', user!.id);
      if (membErr) throw membErr;
      const memberMap = new Map<string, RsvpStatus>(
        (members ?? []).map((m: any) => [m.premiere_id, m.rsvp_status ?? 'attending'])
      );
      const ids = [...memberMap.keys()];
      if (ids.length === 0) return [] as PremiereWithRsvp[];
      const { data, error } = await supabase
        .from('premieres')
        .select('*')
        .in('id', ids)
        .neq('host_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data as Premiere[]).map((p) => ({
        ...p,
        rsvp_status: memberMap.get(p.id) ?? 'attending',
      })) as PremiereWithRsvp[];
    },
    enabled: !!user,
  });
}

export function useUpdateRsvp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ premiereId, status }: { premiereId: string; status: RsvpStatus }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase
        .from('premiere_members')
        .update({ rsvp_status: status })
        .eq('premiere_id', premiereId)
        .eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: (_data, { premiereId }) => {
      queryClient.invalidateQueries({ queryKey: ['premieres-attending'] });
      queryClient.invalidateQueries({ queryKey: ['premiere-members', premiereId] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
    },
  });
}

export function useUpdatePremiere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      airDate,
      airTime,
      tagline,
    }: {
      id: string;
      airDate: string;
      airTime: string | null;
      tagline: string | null;
    }) => {
      const { error } = await supabase
        .from('premieres')
        .update({ air_date: airDate, air_time: airTime, tagline })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['premiere', id] });
      queryClient.invalidateQueries({ queryKey: ['premieres'] });
    },
  });
}

export function useDeletePremiere() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Clear child rows first to avoid FK constraint violations
      const { error: msgError } = await supabase
        .from('premiere_messages')
        .delete()
        .eq('premiere_id', id);
      if (msgError) throw msgError;

      const { error: membersError } = await supabase
        .from('premiere_members')
        .delete()
        .eq('premiere_id', id);
      if (membersError) throw membersError;

      const { error } = await supabase.from('premieres').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['premieres'] });
    },
  });
}

export function useJoinPremiere() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (premiereId: string) => {
      const now = new Date().toISOString();
      // Upsert member row and stamp joined_at (clears left_at for rejoin)
      const { error } = await supabase
        .from('premiere_members')
        .upsert(
          { premiere_id: premiereId, user_id: user!.id, joined_at: now, left_at: null },
          { onConflict: 'premiere_id,user_id' },
        );
      if (error) throw error;

      // Update peak viewer count
      const { count } = await supabase
        .from('premiere_members')
        .select('user_id', { count: 'exact', head: true })
        .eq('premiere_id', premiereId)
        .is('left_at', null);
      if (count != null) {
        await supabase.rpc('update_premiere_peak_viewers', { p_premiere_id: premiereId, p_count: count });
      }
    },
  });
}

export function useTrackReplayView() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (premiereId: string) => {
      await supabase
        .from('premiere_replay_views')
        .upsert({ premiere_id: premiereId, user_id: user!.id }, { ignoreDuplicates: true });
    },
  });
}

export function useLeavePremiere() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (premiereId: string) => {
      await supabase
        .from('premiere_members')
        .update({ left_at: new Date().toISOString() })
        .eq('premiere_id', premiereId)
        .eq('user_id', user!.id);
    },
  });
}

export function useWatchPartyAnalytics(premiereId: string | null) {
  return useQuery({
    queryKey: ['watch-party-analytics', premiereId],
    queryFn: async () => {
      const [premiereRes, membersRes, messagesRes, replayRes] = await Promise.all([
        supabase.from('premieres').select('*, host_user_id').eq('id', premiereId!).single(),
        supabase.from('premiere_members').select('user_id, joined_at, left_at, watch_ms').eq('premiere_id', premiereId!),
        supabase.from('premiere_messages').select('created_at, content, user_name, user_id').eq('premiere_id', premiereId!).order('created_at', { ascending: true }),
        supabase.from('premiere_replay_views').select('user_id', { count: 'exact', head: true }).eq('premiere_id', premiereId!),
      ]);
      if (premiereRes.error) throw premiereRes.error;

      const premiere = premiereRes.data as any;
      const members = (membersRes.data ?? []) as { user_id: string; joined_at: string | null; left_at: string | null; watch_ms: number | null }[];
      const messages = (messagesRes.data ?? []) as { created_at: string; content: string; user_name: string; user_id: string }[];
      const replayViews = replayRes.count ?? 0;

      const totalViewers = members.length;
      const totalMessages = messages.length;
      const peakViewerCount = premiere.peak_viewer_count ?? totalViewers;

      // Watch time stats
      const watchTimes = members.map((m) => m.watch_ms).filter((ms): ms is number => ms != null);
      const avgWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a, b) => a + b, 0) / watchTimes.length : null;
      const totalWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a, b) => a + b, 0) : null;

      // Duration
      const start = premiere.live_started_at ? new Date(premiere.live_started_at).getTime() : null;
      const end = premiere.ended_at ? new Date(premiere.ended_at).getTime() : null;
      const durationMs = start && end ? end - start : null;

      const engagementRate = totalViewers > 0 ? totalMessages / totalViewers : null;

      // Joined late: arrived more than 2 min after live_started_at
      const lateThresholdMs = 2 * 60 * 1000;
      const joinedLate = start
        ? members.filter((m) => m.joined_at && new Date(m.joined_at).getTime() > start + lateThresholdMs).length
        : 0;
      const joinedLatePct = totalViewers > 0 ? Math.round((joinedLate / totalViewers) * 100) : null;

      // Unique chatters vs. lurkers
      const uniqueChatters = new Set(messages.map((m) => m.user_id)).size;
      const lurkers = totalViewers - uniqueChatters;
      const lurkPct = totalViewers > 0 ? Math.round((lurkers / totalViewers) * 100) : null;

      // Top contributors (top 5 by message count, excluding host)
      const msgByUser = new Map<string, { name: string; count: number }>();
      for (const m of messages) {
        if (m.user_id === premiere.host_user_id) continue;
        const prev = msgByUser.get(m.user_id) ?? { name: m.user_name, count: 0 };
        msgByUser.set(m.user_id, { name: m.user_name, count: prev.count + 1 });
      }
      const topContributors = [...msgByUser.values()]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // First message time (relative to start)
      const firstMsgMs = messages.length > 0 && start
        ? new Date(messages[0].created_at).getTime() - start
        : null;

      // Returning viewers: users who attended a previous premiere by the same host
      let returningViewers = 0;
      if (premiere.host_user_id && totalViewers > 0) {
        const memberIds = members.map((m) => m.user_id);
        const { data: pastAttendance } = await supabase
          .from('premiere_members')
          .select('user_id, premieres!inner(host_user_id, id)')
          .in('user_id', memberIds)
          .neq('premiere_id', premiereId!);
        const prevAttendees = new Set(
          (pastAttendance ?? [])
            .filter((r: any) => r.premieres?.host_user_id === premiere.host_user_id)
            .map((r: any) => r.user_id),
        );
        returningViewers = prevAttendees.size;
      }
      const newViewerPct = totalViewers > 0 ? Math.round(((totalViewers - returningViewers) / totalViewers) * 100) : null;

      // 5-min message buckets for chat activity chart
      const bucketMs = 5 * 60 * 1000;
      const bucketMap = new Map<number, number>();
      for (const m of messages) {
        const ts = new Date(m.created_at).getTime();
        const offset = start ? Math.max(0, ts - start) : 0;
        const bucket = Math.floor(offset / bucketMs);
        bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + 1);
      }
      const maxBucket = bucketMap.size > 0 ? Math.max(...bucketMap.keys()) : 0;
      const messageBuckets = Array.from({ length: maxBucket + 1 }, (_, i) => ({
        label: `${i * 5}m`,
        count: bucketMap.get(i) ?? 0,
      }));

      // Top 3 most active moments
      const topMoments = [...messageBuckets]
        .map((b, i) => ({ ...b, index: i }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3)
        .filter((m) => m.count > 0);

      // Retention curve: % of peak still present at each 5-min bucket
      const retentionCurve = start && totalViewers > 0
        ? Array.from({ length: maxBucket + 1 }, (_, i) => {
            const bucketStart = start + i * bucketMs;
            const bucketEnd = bucketStart + bucketMs;
            const present = members.filter((m) => {
              const joined = m.joined_at ? new Date(m.joined_at).getTime() : null;
              const left = m.left_at ? new Date(m.left_at).getTime() : null;
              if (!joined) return false;
              return joined <= bucketEnd && (left == null || left >= bucketStart);
            }).length;
            return { label: `${i * 5}m`, pct: Math.round((present / totalViewers) * 100) };
          })
        : [];

      return {
        premiere,
        totalViewers,
        peakViewerCount,
        totalMessages,
        avgWatchMs,
        totalWatchMs,
        durationMs,
        engagementRate,
        joinedLate,
        joinedLatePct,
        uniqueChatters,
        lurkers,
        lurkPct,
        topContributors,
        firstMsgMs,
        returningViewers,
        newViewerPct,
        replayViews,
        messageBuckets,
        topMoments,
        retentionCurve,
      };
    },
    enabled: !!premiereId,
  });
}

export function useInviteToPremiere() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({ premiereId, friendId, showTitle }: { premiereId: string; friendId: string; showTitle: string }) => {
      const { error } = await supabase
        .from('premiere_members')
        .upsert({ premiere_id: premiereId, user_id: friendId, rsvp_status: 'invited' }, { onConflict: 'premiere_id,user_id', ignoreDuplicates: true });
      if (error) throw error;

      const hostName = profile?.full_name ?? profile?.username ?? 'Someone';

      // Fetch premiere details to build the DM invite card
      const { data: premiere } = await supabase
        .from('premieres')
        .select('show_title,show_poster,season_number,episode_number,episode_name,air_date,air_time,tagline')
        .eq('id', premiereId)
        .single();

      // Send DM invite card
      if (premiere && user) {
        const episodeLabel = premiere.season_number && premiere.episode_number
          ? `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`
          : premiere.episode_name ?? null;
        const content = buildWatchPartyInvite({
          id: premiereId,
          title: premiere.show_title,
          poster: premiere.show_poster,
          episode: episodeLabel,
          date: premiere.air_date,
          time: premiere.air_time,
          tagline: premiere.tagline,
          hostName,
        });
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          recipient_id: friendId,
          content,
        });
      }

      // Push is handled server-side by the send-notification edge function
      // which fires on the direct_messages INSERT above using the service role
      // key (bypasses RLS). Client-side token queries are blocked by RLS.
    },
  });
}

export function useResendPremiereInvite() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({ premiereId, friendId, showTitle }: { premiereId: string; friendId: string; showTitle: string }) => {
      const hostName = profile?.full_name ?? profile?.username ?? 'Someone';

      const { data: premiere } = await supabase
        .from('premieres')
        .select('show_title,show_poster,season_number,episode_number,episode_name,air_date,air_time,tagline')
        .eq('id', premiereId)
        .single();

      if (premiere && user) {
        const episodeLabel = premiere.season_number && premiere.episode_number
          ? `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`
          : premiere.episode_name ?? null;
        const content = buildWatchPartyInvite({
          id: premiereId,
          title: premiere.show_title,
          poster: premiere.show_poster,
          episode: episodeLabel,
          date: premiere.air_date,
          time: premiere.air_time,
          tagline: premiere.tagline,
          hostName,
        });
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          recipient_id: friendId,
          content,
        });
      }

      // Push handled by send-notification edge function on direct_messages INSERT.
    },
  });
}

export function usePremiereMessages(premiereId: string | null) {
  return useQuery({
    queryKey: ['premiere-messages', premiereId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premiere_messages')
        .select('*')
        .eq('premiere_id', premiereId!)
        .not('relative_ms', 'is', null)
        .order('relative_ms', { ascending: true });
      if (error) throw error;
      return data as PremiereMessage[];
    },
    enabled: !!premiereId,
    refetchInterval: 5_000, // fallback poll — catches messages realtime misses if RLS blocks other users' inserts
  });
}

export function useWaitingRoomMessages(premiereId: string | null) {
  return useQuery({
    queryKey: ['waiting-room-messages', premiereId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premiere_messages')
        .select('*')
        .eq('premiere_id', premiereId!)
        .is('relative_ms', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as PremiereMessage[];
    },
    enabled: !!premiereId,
    refetchInterval: 5_000, // poll every 5s — waiting room has no realtime subscription
  });
}

export interface PremiereMember {
  user_id: string;
  rsvp_status: RsvpStatus;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function usePremiereMembers(premiereId: string | null) {
  return useQuery({
    queryKey: ['premiere-members', premiereId],
    queryFn: async () => {
      // Step 1: get the member rows
      const { data: members, error } = await supabase
        .from('premiere_members')
        .select('user_id, rsvp_status')
        .eq('premiere_id', premiereId!);
      if (error) throw error;
      if (!members || members.length === 0) return [] as PremiereMember[];

      // Step 2: fetch profiles for those user IDs
      const userIds = members.map((m: any) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      return members.map((m: any) => {
        const profile = profileMap.get(m.user_id);
        return {
          user_id: m.user_id,
          rsvp_status: m.rsvp_status as RsvpStatus,
          full_name: profile?.full_name ?? null,
          username: profile?.username ?? null,
          avatar_url: profile?.avatar_url ?? null,
        };
      }) as PremiereMember[];
    },
    enabled: !!premiereId,
    refetchInterval: 10_000, // poll every 10s so RSVP changes show up on the host's screen
  });
}

// ─── Message Reactions ────────────────────────────────────────────────────────

export interface MessageReaction {
  id: string;
  message_id: string;
  premiere_id: string;
  user_id: string;
  emoji: string;
}

export function useMessageReactions(premiereId: string | null) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['premiere-reactions', premiereId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premiere_message_reactions')
        .select('*')
        .eq('premiere_id', premiereId!);
      if (error) throw error;
      // Build map: messageId → emoji → { count, mine }
      const map: Record<string, Record<string, { count: number; mine: boolean }>> = {};
      for (const r of (data as MessageReaction[])) {
        if (!map[r.message_id]) map[r.message_id] = {};
        if (!map[r.message_id][r.emoji]) map[r.message_id][r.emoji] = { count: 0, mine: false };
        map[r.message_id][r.emoji].count += 1;
        if (r.user_id === user?.id) map[r.message_id][r.emoji].mine = true;
      }
      return map;
    },
    enabled: !!premiereId,
  });
}

export function useToggleReaction() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, premiereId, emoji, isCurrentlyMine }: {
      messageId: string;
      premiereId: string;
      emoji: string;
      isCurrentlyMine: boolean;
    }) => {
      if (isCurrentlyMine) {
        const { error } = await supabase
          .from('premiere_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user!.id)
          .eq('emoji', emoji);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('premiere_message_reactions')
          .insert({ message_id: messageId, premiere_id: premiereId, user_id: user!.id, emoji });
        if (error) throw error;
      }
    },
    onSuccess: (_data, { premiereId }) => {
      queryClient.invalidateQueries({ queryKey: ['premiere-reactions', premiereId] });
    },
  });
}

// ─── Co-hosts ─────────────────────────────────────────────────────────────────

export type CoHostStatus = 'pending' | 'accepted' | 'declined';

export interface PremiereCoHost {
  id: string;
  premiere_id: string;
  user_id: string;
  invited_by: string;
  status: CoHostStatus;
  // joined from profiles
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

export function usePremiereCoHosts(premiereId: string | null) {
  return useQuery({
    queryKey: ['premiere-cohosts', premiereId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('premiere_cohosts')
        .select('*')
        .eq('premiere_id', premiereId!);
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length === 0) return [] as PremiereCoHost[];
      const userIds = rows.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => {
        const p = profileMap.get(r.user_id);
        return { ...r, full_name: p?.full_name ?? null, username: p?.username ?? null, avatar_url: p?.avatar_url ?? null };
      }) as PremiereCoHost[];
    },
    enabled: !!premiereId,
    refetchInterval: 10_000,
  });
}

export function useIsCoHost(premiereId: string | null) {
  const { user } = useSession();
  const { data: cohosts = [] } = usePremiereCoHosts(premiereId);
  return cohosts.some((c) => c.user_id === user?.id && c.status === 'accepted');
}

export function useMyCoHostInvite(premiereId: string | null) {
  const { user } = useSession();
  const { data: cohosts = [] } = usePremiereCoHosts(premiereId);
  return cohosts.find((c) => c.user_id === user?.id) ?? null;
}

export function useInviteCoHost() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ premiereId, friendId }: { premiereId: string; friendId: string }) => {
      const { error } = await supabase
        .from('premiere_cohosts')
        .upsert({ premiere_id: premiereId, user_id: friendId, invited_by: user!.id, status: 'pending' }, { onConflict: 'premiere_id,user_id', ignoreDuplicates: true });
      if (error) throw error;
      // DM notification
      const hostName = profile?.full_name ?? profile?.username ?? 'Someone';
      const { data: premiere } = await supabase
        .from('premieres')
        .select('show_title')
        .eq('id', premiereId)
        .single();
      if (premiere && user) {
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          recipient_id: friendId,
          content: JSON.stringify({
            __cohost_invite: true,
            premiereId,
            title: premiere.show_title,
            hostName,
          }),
        });
      }
    },
    onSuccess: (_data, { premiereId }) => {
      queryClient.invalidateQueries({ queryKey: ['premiere-cohosts', premiereId] });
    },
  });
}

export function useRespondToCoHostInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ inviteId, premiereId, accept }: { inviteId: string; premiereId: string; accept: boolean }) => {
      const { error } = await supabase
        .from('premiere_cohosts')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('id', inviteId);
      if (error) throw error;
    },
    onSuccess: (_data, { premiereId }) => {
      queryClient.invalidateQueries({ queryKey: ['premiere-cohosts', premiereId] });
    },
  });
}

export function useRemoveCoHost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, premiereId }: { id: string; premiereId: string }) => {
      const { error } = await supabase.from('premiere_cohosts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_data, { premiereId }) => {
      queryClient.invalidateQueries({ queryKey: ['premiere-cohosts', premiereId] });
    },
  });
}

export function usePremiereViewerCount(premiereId: string | null) {
  return useQuery({
    queryKey: ['premiere-viewers', premiereId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('premiere_members')
        .select('*', { count: 'exact', head: true })
        .eq('premiere_id', premiereId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!premiereId,
    refetchInterval: 10_000,
  });
}
