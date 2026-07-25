import { useQuery } from '@tanstack/react-query';
import { Linking } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/hooks/use-session';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;

export function useAdPoster(
  tmdbId: string | null | undefined,
  mediaType: string | null | undefined,
  contentTitle: string | null | undefined,
) {
  return useQuery({
    queryKey: ['ad-poster', tmdbId ?? contentTitle],
    queryFn: async (): Promise<string | null> => {
      let posterPath: string | null = null;

      if (tmdbId) {
        const endpoint = mediaType === 'tv' ? 'tv' : 'movie';
        const res = await fetch(
          `https://api.themoviedb.org/3/${endpoint}/${tmdbId}?language=en-US`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        );
        const data = await res.json();
        posterPath = data.poster_path ?? null;
      } else if (contentTitle) {
        const res = await fetch(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(contentTitle)}&language=en-US&page=1`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        );
        const data = await res.json();
        posterPath = data.results?.[0]?.poster_path ?? null;
      }

      return posterPath ? `https://image.tmdb.org/t/p/w342${posterPath}` : null;
    },
    enabled: !!(tmdbId || contentTitle),
    staleTime: 24 * 60 * 60 * 1000,
  });
}

export interface Ad {
  id: string;
  brand_name: string;
  brand_logo_url: string | null;
  headline: string;
  body: string | null;
  image_url: string | null;
  cta_label: string;
  cta_url: string;
  // Optional: when set, tapping opens the in-app content-detail-modal
  content_title: string | null;
  content_sub: string | null;
  content_type: string | null;   // 'watch' | 'read' | 'play' | 'listen' | 'podcast'
  tmdb_id: string | null;
  media_type: string | null;     // 'movie' | 'tv'
  tmdb_company_id: string | null;
}

export function useActiveAd() {
  return useQuery({
    queryKey: ['active-ad'],
    queryFn: async (): Promise<Ad | null> => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('ads')
        .select('id, brand_name, brand_logo_url, headline, body, image_url, cta_label, cta_url, budget_impressions, impressions_count, content_title, content_sub, content_type, tmdb_id, media_type, tmdb_company_id')
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

export function useStudioFilms(
  brandName: string | null | undefined,
  companyId: string | null | undefined,
) {
  return useQuery({
    queryKey: ['studio-films', companyId ?? brandName],
    queryFn: async () => {
      let resolvedId: number | null = companyId ? Number(companyId) : null;

      if (!resolvedId && brandName) {
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/company?query=${encodeURIComponent(brandName)}`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        );
        const searchData = await searchRes.json();
        resolvedId = searchData.results?.[0]?.id ?? null;
      }

      if (!resolvedId) return [];

      // Fetch 2 pages so we have enough titles to fill the row
      const [p1, p2] = await Promise.all([
        fetch(
          `https://api.themoviedb.org/3/discover/movie?with_companies=${resolvedId}&sort_by=popularity.desc&page=1`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        ).then((r) => r.json()),
        fetch(
          `https://api.themoviedb.org/3/discover/movie?with_companies=${resolvedId}&sort_by=popularity.desc&page=2`,
          { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
        ).then((r) => r.json()),
      ]);

      const all = [...(p1.results ?? []), ...(p2.results ?? [])] as any[];
      return all.slice(0, 20).map((m: any) => ({
        title: m.title as string,
        type: 'watch' as const,
        poster: m.poster_path ? `https://image.tmdb.org/t/p/w185${m.poster_path}` : null,
        sub: m.release_date?.slice(0, 4) ?? null,
        externalId: String(m.id),
        mediaType: 'movie' as const,
        score: m.popularity as number,
        count: 0,
        users: [],
        loggers: [],
      }));
    },
    enabled: !!(companyId || brandName),
    staleTime: 60 * 60 * 1000,
  });
}

export async function handleAdTap(ad: Ad, logEvent: (id: string, type: 'impression' | 'tap') => void) {
  logEvent(ad.id, 'tap');
  if (await Linking.canOpenURL(ad.cta_url)) {
    Linking.openURL(ad.cta_url);
  }
}
