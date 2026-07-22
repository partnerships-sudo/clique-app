import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { useProfile } from '@/features/profile/api';
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
        .update({ status: 'ended' })
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

export function useJoinPremiere() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async (premiereId: string) => {
      const { error } = await supabase
        .from('premiere_members')
        .upsert({ premiere_id: premiereId, user_id: user!.id }, { ignoreDuplicates: true });
      if (error) throw error;
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
