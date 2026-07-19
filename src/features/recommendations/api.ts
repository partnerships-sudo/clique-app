import type { EntryType } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';

export type ShakeReco = {
  title: string;
  type: EntryType;
  poster: string | null;
  sub: string | null;
  avg_rating: number | null;
};

export async function fetchShakeReco(userId: string): Promise<ShakeReco | null> {
  const { data, error } = await supabase.rpc('get_shake_recommendation', {
    p_user_id: userId,
  });
  if (error) throw error;
  if (!data || (Array.isArray(data) && data.length === 0)) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row as ShakeReco;
}

export function useShakeReco() {
  const { session } = useSession();
  return {
    fetch: () => {
      if (!session?.user?.id) return Promise.resolve(null);
      return fetchShakeReco(session.user.id);
    },
  };
}
