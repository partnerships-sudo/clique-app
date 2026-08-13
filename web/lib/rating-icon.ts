'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import type { RatingIconStyle } from '@web/components/ui/rating-icons';

const supabase = createClient();

/** Returns the signed-in user's preferred rating icon style, defaulting to 'stars'. */
export function useRatingIcon(): RatingIconStyle {
  const { user } = useSession();
  const { data } = useQuery({
    queryKey: ['web-rating-icon', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('rating_icon')
        .eq('id', user!.id)
        .single();
      return (data?.rating_icon as RatingIconStyle | null) ?? 'stars';
    },
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  return data ?? 'stars';
}
