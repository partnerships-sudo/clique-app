'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

/** All watchlist titles for the current user — used for O(1) lookup */
export function useWatchlistKeys() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-watchlist-keys', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('library')
        .select('id, title, type')
        .eq('user_id', user!.id)
        .eq('status', 'watchlist');
      // Return a map of "title::type" → row id for fast lookup
      const map = new Map<string, string>();
      for (const row of data ?? []) {
        map.set(`${row.title}::${row.type}`, row.id);
      }
      return map;
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

export interface WatchlistItem {
  type: string;
  title: string;
  sub?: string | null;
  poster?: string | null;
}

export function useToggleWatchlist() {
  const { user } = useSession();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ item, currentId }: { item: WatchlistItem; currentId: string | undefined }) => {
      if (!user) throw new Error('Not logged in');
      if (currentId) {
        // Remove from watchlist
        const { error } = await supabase.from('library').delete().eq('id', currentId);
        if (error) throw error;
        return null;
      } else {
        // Add to watchlist
        const { data, error } = await supabase
          .from('library')
          .insert({
            user_id: user.id,
            type: item.type,
            title: item.title,
            sub: item.sub ?? null,
            poster: item.poster ?? null,
            status: 'watchlist',
            rating: null,
            note: null,
            date: null,
          })
          .select('id')
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onMutate: async ({ item, currentId }) => {
      const key = ['web-watchlist-keys', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Map<string, string>>(key);
      qc.setQueryData<Map<string, string>>(key, (old) => {
        const next = new Map(old ?? []);
        const mapKey = `${item.title}::${item.type}`;
        if (currentId) {
          next.delete(mapKey);
        } else {
          next.set(mapKey, '__optimistic__');
        }
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['web-watchlist-keys', user?.id], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['web-watchlist-keys', user?.id] });
      qc.invalidateQueries({ queryKey: ['web-library', user?.id, 'watchlist'] });
    },
  });
}
