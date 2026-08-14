import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { useProfile } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

export type ScreeningRoomStatus = 'waiting' | 'live' | 'ended';
export type VideoType = 'youtube' | 'direct';

export interface ScreeningRoom {
  id: string;
  host_user_id: string;
  host_name: string;
  host_avatar_url: string | null;
  title: string;
  description: string | null;
  tagline: string | null;
  video_url: string;
  video_type: VideoType;
  cover_image: string | null;
  status: ScreeningRoomStatus;
  is_playing: boolean;
  playback_position_ms: number;
  air_date: string | null;
  air_time: string | null;
  live_started_at: string | null;
  ended_at: string | null;
  peak_viewer_count: number;
  created_at: string;
}

export interface ScreeningRoomAnalytics {
  room: ScreeningRoom;
  totalViewers: number;
  totalMessages: number;
  durationMs: number | null;
  engagementRate: number | null;
  messageBuckets: { label: string; count: number }[];
}

export interface ScreeningRoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  user_avatar_url: string | null;
  content: string;
  relative_ms: number | null;
  created_at: string;
}

// ─── URL helpers ─────────────────────────────────────────────────────────────

export function detectVideoType(url: string): VideoType {
  return url.includes('youtube.com') || url.includes('youtu.be') ? 'youtube' : 'direct';
}

export function extractYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export function useMyScreeningRooms() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['screening-rooms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_rooms')
        .select('*')
        .eq('host_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ScreeningRoom[];
    },
    enabled: !!user,
  });
}

export function useAttendingScreeningRooms() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['screening-rooms-attending', user?.id],
    queryFn: async () => {
      const { data: members, error: membErr } = await supabase
        .from('screening_room_members')
        .select('room_id')
        .eq('user_id', user!.id);
      if (membErr) throw membErr;
      const ids = (members ?? []).map((m: any) => m.room_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from('screening_rooms')
        .select('*')
        .in('id', ids)
        .neq('host_user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ScreeningRoom[];
    },
    enabled: !!user,
  });
}

export function useScreeningRoom(id: string | null) {
  return useQuery({
    queryKey: ['screening-room', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_rooms')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as ScreeningRoom;
    },
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useScreeningRoomMessages(roomId: string | null) {
  return useQuery({
    queryKey: ['screening-room-messages', roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_room_messages')
        .select('*')
        .eq('room_id', roomId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ScreeningRoomMessage[];
    },
    enabled: !!roomId,
  });
}

export function useScreeningRoomViewerCount(roomId: string | null) {
  return useQuery({
    queryKey: ['screening-room-viewers', roomId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('screening_room_members')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId!);
      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!roomId,
    refetchInterval: 15_000,
  });
}

// ─── Mutations ───────────────────────────────────────────────────────────────

export function useCreateScreeningRoom() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      title: string;
      description?: string;
      tagline?: string;
      video_url: string;
      video_type: VideoType;
      cover_image?: string | null;
      air_date?: string | null;
      air_time?: string | null;
    }) => {
      const hostName = profile?.full_name ?? profile?.username ?? user?.email?.split('@')[0] ?? 'Host';
      const { data, error } = await supabase
        .from('screening_rooms')
        .insert({
          host_user_id: user!.id,
          host_name: hostName,
          host_avatar_url: profile?.avatar_url ?? null,
          title: input.title,
          description: input.description ?? null,
          tagline: input.tagline ?? null,
          video_url: input.video_url,
          video_type: input.video_type,
          cover_image: input.cover_image ?? null,
          air_date: input.air_date ?? null,
          air_time: input.air_time ?? null,
          status: 'waiting',
          is_playing: false,
          playback_position_ms: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ScreeningRoom;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screening-rooms', user?.id] }),
  });
}

export function useDeleteScreeningRoom() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await supabase.from('screening_rooms').delete().eq('id', roomId).eq('host_user_id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['screening-rooms', user?.id] }),
  });
}

export function useInviteToScreeningRoom() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({ roomId, friendId, title }: { roomId: string; friendId: string; title: string }) => {
      // Add them as a member
      const { error } = await supabase
        .from('screening_room_members')
        .upsert({ room_id: roomId, user_id: friendId }, { ignoreDuplicates: true });
      if (error) throw error;
      // Send a DM invite card
      const hostName = profile?.full_name ?? profile?.username ?? 'Someone';
      if (user) {
        await supabase.from('direct_messages').insert({
          sender_id: user.id,
          recipient_id: friendId,
          content: JSON.stringify({ __screening_invite: true, roomId, title, hostName }),
        });
      }
    },
  });
}

export function useJoinScreeningRoom() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('screening_room_members')
        .upsert(
          { room_id: roomId, user_id: user!.id, joined_at: now, left_at: null },
          { onConflict: 'room_id,user_id' },
        );
      if (error) throw error;
    },
  });
}

export function useLeaveScreeningRoom() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (roomId: string) => {
      await supabase
        .from('screening_room_members')
        .update({ left_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', user!.id);
    },
  });
}

export function useSendScreeningRoomMessage() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  return useMutation({
    mutationFn: async ({ roomId, content, relativeMs }: { roomId: string; content: string; relativeMs: number | null }) => {
      const { error } = await supabase.from('screening_room_messages').insert({
        room_id: roomId,
        user_id: user!.id,
        user_name: profile?.full_name ?? profile?.username ?? 'Viewer',
        user_avatar_url: profile?.avatar_url ?? null,
        content,
        relative_ms: relativeMs,
      });
      if (error) throw error;
    },
  });
}

export function useGoLiveScreeningRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await supabase
        .from('screening_rooms')
        .update({ status: 'live', live_started_at: new Date().toISOString(), is_playing: false, playback_position_ms: 0 })
        .eq('id', roomId);
      if (error) throw error;
    },
    onSuccess: (_d, roomId) => qc.invalidateQueries({ queryKey: ['screening-room', roomId] }),
  });
}

export function useScreeningRoomAnalytics(roomId: string | null) {
  return useQuery({
    queryKey: ['screening-room-analytics', roomId],
    queryFn: async () => {
      const [roomRes, membersRes, messagesRes, sharesRes] = await Promise.all([
        supabase.from('screening_rooms').select('*').eq('id', roomId!).single(),
        supabase.from('screening_room_members').select('user_id, joined_at, left_at, watch_ms').eq('room_id', roomId!),
        supabase.from('screening_room_messages').select('created_at, content, user_name, user_id').eq('room_id', roomId!).order('created_at', { ascending: true }),
        supabase.from('screening_room_shares').select('user_id', { count: 'exact', head: true }).eq('room_id', roomId!),
      ]);
      if (roomRes.error) throw roomRes.error;

      const room = roomRes.data as ScreeningRoom;
      const members = (membersRes.data ?? []) as { user_id: string; joined_at: string | null; left_at: string | null; watch_ms: number | null }[];
      const messages = (messagesRes.data ?? []) as { created_at: string; content: string; user_name: string; user_id: string }[];
      const totalShares = sharesRes.count ?? 0;

      const totalViewers = members.length;
      const totalMessages = messages.length;
      const peakViewerCount = room.peak_viewer_count ?? totalViewers;

      const start = room.live_started_at ? new Date(room.live_started_at).getTime() : null;
      const end = room.ended_at ? new Date(room.ended_at).getTime() : null;
      const durationMs = start && end ? end - start : null;
      const engagementRate = totalViewers > 0 ? totalMessages / totalViewers : null;

      // Watch time stats from stored watch_ms column
      const watchTimes = members.map((m) => m.watch_ms).filter((ms): ms is number => ms != null);
      const avgWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a, b) => a + b, 0) / watchTimes.length : null;
      const totalWatchMs = watchTimes.length > 0 ? watchTimes.reduce((a, b) => a + b, 0) : null;

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
        if (m.user_id === room.host_user_id) continue;
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

      // Returning viewers: users who attended a previous screening room by the same host
      let returningViewers = 0;
      if (room.host_user_id && totalViewers > 0) {
        const memberIds = members.map((m) => m.user_id);
        const { data: pastAttendance } = await supabase
          .from('screening_room_members')
          .select('user_id, screening_rooms!inner(host_user_id, id)')
          .in('user_id', memberIds)
          .neq('room_id', roomId!);
        const prevAttendees = new Set(
          (pastAttendance ?? [])
            .filter((r: any) => r.screening_rooms?.host_user_id === room.host_user_id)
            .map((r: any) => r.user_id),
        );
        returningViewers = prevAttendees.size;
      }
      const newViewerPct = totalViewers > 0 ? Math.round(((totalViewers - returningViewers) / totalViewers) * 100) : null;

      // Follows gained during event window
      let followsGained = 0;
      if (room.host_user_id && start) {
        const windowEnd = end ? end + 24 * 60 * 60 * 1000 : start + 48 * 60 * 60 * 1000;
        const { count: followCount } = await supabase
          .from('follows')
          .select('id', { count: 'exact', head: true })
          .eq('followed_id', room.host_user_id)
          .gte('created_at', new Date(start).toISOString())
          .lte('created_at', new Date(windowEnd).toISOString());
        followsGained = followCount ?? 0;
      }

      // Host screening room history: peak viewers per past room
      let hostEventHistory: { title: string; viewers: number; date: string }[] = [];
      if (room.host_user_id) {
        const { data: pastRooms } = await supabase
          .from('screening_rooms')
          .select('id, title, live_started_at, peak_viewer_count')
          .eq('host_user_id', room.host_user_id)
          .eq('status', 'ended')
          .order('live_started_at', { ascending: false })
          .limit(6);
        hostEventHistory = (pastRooms ?? []).map((r: any) => ({
          title: r.title,
          viewers: r.peak_viewer_count ?? 0,
          date: r.live_started_at
            ? new Date(r.live_started_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '—',
        }));
      }

      // Time of day
      const startHour = start ? new Date(start).getUTCHours() : null;
      const timeOfDay = startHour != null
        ? startHour < 6 ? 'Late Night' : startHour < 12 ? 'Morning' : startHour < 17 ? 'Afternoon' : startHour < 21 ? 'Evening' : 'Night'
        : null;

      // Group messages into 5-minute buckets relative to stream start
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

      // Top 3 most active chat moments
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
        : [] as { label: string; pct: number }[];

      return {
        room,
        totalViewers,
        peakViewerCount,
        totalMessages,
        avgWatchMs,
        totalWatchMs,
        durationMs,
        engagementRate,
        // Audience
        joinedLate,
        joinedLatePct,
        returningViewers,
        newViewerPct,
        // Chat
        uniqueChatters,
        lurkers,
        lurkPct,
        topContributors,
        firstMsgMs,
        // Growth
        totalShares,
        followsGained,
        hostEventHistory,
        timeOfDay,
        // Charts
        messageBuckets,
        topMoments,
        retentionCurve,
      };
    },
    enabled: !!roomId,
  });
}

export function useEndScreeningRoom() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (roomId: string) => {
      const { error } = await supabase
        .from('screening_rooms')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', roomId);
      if (error) throw error;
    },
    onSuccess: (_d, roomId) => {
      qc.invalidateQueries({ queryKey: ['screening-room', roomId] });
      qc.invalidateQueries({ queryKey: ['screening-rooms'] });
    },
  });
}

// Called by host to persist playback state so late joiners can sync
export function usePushPlaybackState() {
  return useMutation({
    mutationFn: async ({ roomId, isPlaying, positionMs }: { roomId: string; isPlaying: boolean; positionMs: number }) => {
      await supabase
        .from('screening_rooms')
        .update({ is_playing: isPlaying, playback_position_ms: positionMs })
        .eq('id', roomId);
    },
  });
}

// ── Trivia & Polls ────────────────────────────────────────────────────────────

export type ScreeningRoomTriviaOption = {
  label: string;
  is_correct?: boolean;
};

export type ScreeningRoomTriviaItem = {
  id: string;
  screening_room_id: string;
  type: 'trivia' | 'poll' | 'message';
  question: string;
  options: ScreeningRoomTriviaOption[];
  trigger_ms: number;
  fired_at: string | null;
  created_at: string;
};

export function useScreeningRoomTriviaItems(roomId: string | null) {
  return useQuery({
    queryKey: ['screening-room-trivia', roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_room_trivia')
        .select('*')
        .eq('screening_room_id', roomId!)
        .order('trigger_ms', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ScreeningRoomTriviaItem[];
    },
    enabled: !!roomId,
    refetchInterval: 30_000,
  });
}

export function useAddScreeningRoomTriviaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<ScreeningRoomTriviaItem, 'id' | 'fired_at' | 'created_at'>) => {
      const { error } = await supabase.from('screening_room_trivia').insert({
        screening_room_id: item.screening_room_id,
        type: item.type,
        question: item.question,
        options: item.options,
        trigger_ms: item.trigger_ms,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['screening-room-trivia', vars.screening_room_id] });
    },
  });
}

export function useDeleteScreeningRoomTriviaItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, roomId }: { id: string; roomId: string }) => {
      const { error } = await supabase.from('screening_room_trivia').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['screening-room-trivia', vars.roomId] });
    },
  });
}

export function useMarkScreeningRoomTriviaFired() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, roomId }: { id: string; roomId: string }) => {
      const { error } = await supabase
        .from('screening_room_trivia')
        .update({ fired_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['screening-room-trivia', vars.roomId] });
    },
  });
}

export function useSubmitScreeningRoomTriviaResponse() {
  return useMutation({
    mutationFn: async ({ triviaId, userId, optionIdx }: { triviaId: string; userId: string; optionIdx: number }) => {
      const { error } = await supabase.from('screening_room_trivia_responses').upsert(
        { trivia_id: triviaId, user_id: userId, option_idx: optionIdx },
        { onConflict: 'trivia_id,user_id' }
      );
      if (error) throw error;
    },
  });
}

export function useScreeningRoomTriviaResponseCounts(triviaId: string | null) {
  return useQuery({
    queryKey: ['screening-room-trivia-responses', triviaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('screening_room_trivia_responses')
        .select('option_idx')
        .eq('trivia_id', triviaId!);
      if (error) throw error;
      const counts: Record<number, number> = {};
      for (const r of data ?? []) {
        counts[r.option_idx] = (counts[r.option_idx] ?? 0) + 1;
      }
      return counts;
    },
    enabled: !!triviaId,
    refetchInterval: 3_000,
  });
}
