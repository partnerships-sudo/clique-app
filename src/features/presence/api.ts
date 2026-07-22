import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useProfile } from '@/features/profile/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;
}

export function formatLastSeen(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return '';
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  if (ms < ONLINE_THRESHOLD_MS) return 'Active now';
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `Active ${mins}m ago`;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(ms / 86_400_000);
  if (days === 1) return 'Active yesterday';
  if (days < 7) return `Active ${days}d ago`;
  return '';
}

/** Heartbeat — call once from AppTabs. Respects the user's show_online_status setting. */
export function useMyPresence() {
  const { user } = useSession();
  const { data: profile } = useProfile();

  useEffect(() => {
    if (!user) return;

    // Setting loaded and opted out — clear last_seen_at so others see us as offline immediately.
    if (profile !== undefined && profile?.show_online_status === false) {
      supabase.from('profiles').update({ last_seen_at: null }).eq('id', user.id);
      return;
    }

    // Still loading profile (undefined) or opted in — run the heartbeat.
    async function ping() {
      await supabase
        .from('profiles')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('id', user!.id);
    }

    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  // Re-run when the opt-in/out setting changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, profile?.show_online_status]);
}

/** Upsert a read receipt so the counterpart can show "Read" on their side.
 *  No-ops if the user has show_read_receipts turned off. */
export function useMarkDmReadReceipt() {
  const { user } = useSession();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  return (counterpartId: string) => {
    if (!user) return;
    if (profile?.show_read_receipts === false) return;
    supabase
      .from('dm_read_receipts')
      .upsert(
        { user_id: user.id, counterpart_id: counterpartId, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id,counterpart_id' },
      )
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['dm-read-receipt', counterpartId, user.id] });
      });
  };
}

/** When did `counterpartId` last read my messages? Used to show "Read" on sent messages. */
export function useDmReadReceipt(counterpartId: string | null | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['dm-read-receipt', counterpartId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('dm_read_receipts')
        .select('last_read_at')
        .eq('user_id', counterpartId!)
        .eq('counterpart_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.last_read_at ?? null;
    },
    enabled: !!user && !!counterpartId,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
