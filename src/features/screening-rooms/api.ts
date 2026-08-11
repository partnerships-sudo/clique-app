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
      const { error } = await supabase
        .from('screening_room_members')
        .upsert({ room_id: roomId, user_id: user!.id }, { ignoreDuplicates: true });
      if (error) throw error;
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
      const [roomRes, membersRes, messagesRes] = await Promise.all([
        supabase.from('screening_rooms').select('*').eq('id', roomId!).single(),
        supabase.from('screening_room_members').select('user_id', { count: 'exact' }).eq('room_id', roomId!),
        supabase.from('screening_room_messages').select('created_at').eq('room_id', roomId!).order('created_at', { ascending: true }),
      ]);
      if (roomRes.error) throw roomRes.error;

      const room = roomRes.data as ScreeningRoom;
      const totalViewers = membersRes.count ?? 0;
      const messages = (messagesRes.data ?? []) as { created_at: string }[];
      const totalMessages = messages.length;

      const start = room.live_started_at ? new Date(room.live_started_at).getTime() : null;
      const end = room.ended_at ? new Date(room.ended_at).getTime() : null;
      const durationMs = start && end ? end - start : null;
      const engagementRate = totalViewers > 0 ? totalMessages / totalViewers : null;

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

      return { room, totalViewers, totalMessages, durationMs, engagementRate, messageBuckets } as ScreeningRoomAnalytics;
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
