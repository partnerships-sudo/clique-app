import { useQuery } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';

export interface Ad {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  headline: string;
  body: string | null;
  image_url: string | null;
  cta_label: string;
  cta_url: string;
}

export function useActiveAd() {
  return useQuery({
    queryKey: ['active-ad'],
    queryFn: async (): Promise<Ad | null> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ads')
        .select('id, brand_name, brand_logo_url, headline, body, image_url, cta_label, cta_url, budget_impressions, impressions_count')
        .eq('status', 'live')
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`);

      if (error || !data || data.length === 0) return null;

      // Filter out ads that have hit their impression budget
      const eligible = data.filter(
        (ad) => ad.budget_impressions == null || ad.impressions_count < ad.budget_impressions
      );
      if (eligible.length === 0) return null;

      // Weight toward ads with fewer impressions relative to their budget.
      // Ads with no budget get a neutral weight of 1.
      const weights = eligible.map((ad) => {
        if (ad.budget_impressions == null) return 1;
        return Math.max(0.1, 1 - ad.impressions_count / ad.budget_impressions);
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let rand = Math.random() * total;
      let picked = eligible[eligible.length - 1];
      for (let i = 0; i < eligible.length; i++) {
        rand -= weights[i];
        if (rand <= 0) { picked = eligible[i]; break; }
      }

      return picked as Ad;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogAdEvent() {
  const { user } = useSession();
  return async (adId: string, eventType: 'impression' | 'tap') => {
    if (!user) return;
    // Fire and forget — don't block UI
    supabase.from('ad_events').insert({ ad_id: adId, user_id: user.id, event_type: eventType }).then(() => {});
    supabase.rpc('increment_ad_counter', { p_ad_id: adId, p_event: eventType }).then(() => {});
  };
}

export async function handleAdTap(ad: Ad, logEvent: (id: string, type: 'impression' | 'tap') => void) {
  logEvent(ad.id, 'tap');
  if (await Linking.canOpenURL(ad.cta_url)) {
    Linking.openURL(ad.cta_url);
  }
}
