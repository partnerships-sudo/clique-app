import { useQuery } from '@tanstack/react-query';
import * as Localization from 'expo-localization';

import type { EntryType } from '@/constants/theme';
import type { StoreLink } from '@/features/where-to-find/links';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const RAWG_KEY = process.env.EXPO_PUBLIC_RAWG_KEY!;
const BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;

// TMDB's watch/providers data is region-specific and sourced from JustWatch.
// Use the device's own region so someone in the UK sees BBC iPlayer/Now TV
// instead of a US-only lineup; fall back to US if the device doesn't report one.
function getWatchProvidersRegion(): string {
  return Localization.getLocales()[0]?.regionCode ?? 'US';
}

// Known styling for the providers we're likely to see often, matched by
// TMDB's provider_name. Anything not in this map still renders fine with a
// generic dark pill and a JustWatch search link.
const PROVIDER_STYLE: Record<string, { color: string; url: (title: string) => string }> = {
  Netflix: { color: '#E50914', url: (t) => `https://www.netflix.com/search?q=${encodeURIComponent(t)}` },
  'Max': { color: '#7C3AED', url: (t) => `https://www.max.com/search?q=${encodeURIComponent(t)}` },
  'Apple TV': { color: '#000000', url: (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}` },
  'Apple TV+': { color: '#000000', url: (t) => `https://tv.apple.com/search?term=${encodeURIComponent(t)}` },
  'Amazon Prime Video': { color: '#FF9900', url: (t) => `https://www.amazon.com/s?k=${encodeURIComponent(t)}&i=instant-video` },
  'Amazon Video': { color: '#FF9900', url: (t) => `https://www.amazon.com/s?k=${encodeURIComponent(t)}&i=instant-video` },
  'Disney Plus': { color: '#113CCF', url: (t) => `https://www.disneyplus.com/search?q=${encodeURIComponent(t)}` },
  Hulu: { color: '#1CE783', url: (t) => `https://www.hulu.com/search?q=${encodeURIComponent(t)}` },
  'Paramount Plus': { color: '#0064FF', url: (t) => `https://www.paramountplus.com/search/?query=${encodeURIComponent(t)}` },
  Peacock: { color: '#000000', url: (t) => `https://www.peacocktv.com/search?q=${encodeURIComponent(t)}` },
  'YouTube': { color: '#FF0000', url: (t) => `https://www.youtube.com/results?search_query=${encodeURIComponent(t)}` },
  'BBC iPlayer': { color: '#000000', url: (t) => `https://www.bbc.co.uk/iplayer/search?q=${encodeURIComponent(t)}` },
  'ITVX': { color: '#DD2FA1', url: (t) => `https://www.itv.com/watch?q=${encodeURIComponent(t)}` },
  'Sky Go': { color: '#0072C9', url: (t) => `https://www.sky.com/watch/search?q=${encodeURIComponent(t)}` },
  'Now TV': { color: '#00D7DB', url: (t) => `https://www.nowtv.com/gb/search?q=${encodeURIComponent(t)}` },
  'Google Play Movies': { color: '#1a1a1a', url: (t) => `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=movies` },
};

function providerLink(name: string, title: string): string {
  return PROVIDER_STYLE[name]?.url(title) ?? `https://www.justwatch.com/us/search?q=${encodeURIComponent(title)}`;
}

// RAWG returns each game's confirmed release platforms — used to build a
// storefront list scoped to what the game actually shipped on, instead of
// always showing every storefront (e.g. a Nintendo eShop link for a game
// that never released on Switch).
const GAME_STORE_BY_PLATFORM: Record<
  string,
  Omit<StoreLink, 'url'> & { url: (title: string) => string }
> = {
  pc: {
    name: 'Steam',
    logo: '🖥',
    price: 'PC / Mac',
    cta: 'Find on Steam',
    color: '#1B2838',
    url: (t) => `https://store.steampowered.com/search/?term=${encodeURIComponent(t)}`,
  },
  playstation: {
    name: 'PlayStation Store',
    logo: '🔵',
    price: 'PS4 / PS5',
    cta: 'Find on PS Store',
    color: '#003791',
    url: (t) => `https://store.playstation.com/search/${encodeURIComponent(t)}`,
  },
  xbox: {
    name: 'Xbox Store',
    logo: '🟢',
    price: 'Xbox / Game Pass',
    cta: 'Find on Xbox',
    color: '#107C10',
    url: (t) => `https://www.xbox.com/search?q=${encodeURIComponent(t)}`,
  },
  'nintendo-switch': {
    name: 'Nintendo eShop',
    logo: '🔴',
    price: 'Switch',
    cta: 'Find on eShop',
    color: '#E4000F',
    url: (t) => `https://www.nintendo.com/search/#q=${encodeURIComponent(t)}`,
  },
  ios: {
    name: 'App Store',
    logo: '📱',
    price: 'iOS',
    cta: 'Find on App Store',
    color: '#007AFF',
    url: (t) => `https://apps.apple.com/search?term=${encodeURIComponent(t)}`,
  },
  android: {
    name: 'Google Play',
    logo: '▶️',
    price: 'Android',
    cta: 'Find on Google Play',
    color: '#01875F',
    url: (t) => `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=apps`,
  },
};

// Collapses RAWG's many specific platform slugs (playstation5, playstation4,
// ps-vita, xbox-series-x, xbox-one, xbox360...) down to the storefront
// buckets above. Older/niche platforms (3DS, Wii U, Dreamcast, etc.) have no
// modern digital storefront to link to, so they're intentionally dropped.
function normalizeRawgPlatformSlug(slug: string): string | null {
  if (slug === 'pc' || slug === 'macos' || slug === 'linux') return 'pc';
  if (slug.startsWith('playstation') || slug === 'ps-vita') return 'playstation';
  if (slug.startsWith('xbox')) return 'xbox';
  if (slug === 'nintendo-switch') return 'nintendo-switch';
  if (slug === 'ios') return 'ios';
  if (slug === 'android') return 'android';
  return null;
}

// RAWG store IDs → platform bucket
const RAWG_STORE_ID_TO_BUCKET: Record<number, string> = {
  1: 'pc',       // Steam
  2: 'xbox',     // Xbox Store
  3: 'playstation',
  4: 'ios',      // App Store
  5: 'pc',       // GOG (PC)
  6: 'nintendo-switch',
  7: 'xbox',     // Xbox 360
  8: 'android',  // Google Play
  11: 'pc',      // Epic Games (PC)
};

function buildGameStores(
  platforms: { platform?: { slug?: string; name?: string } }[] | undefined,
  title: string,
  storeUrls?: Record<string, string>,
): StoreLink[] {
  const buckets = new Set<string>();
  for (const p of platforms ?? []) {
    const bucket = normalizeRawgPlatformSlug(p.platform?.slug ?? '');
    if (bucket) buckets.add(bucket);
  }
  return Array.from(buckets)
    .map((bucket) => GAME_STORE_BY_PLATFORM[bucket])
    .filter((store): store is (typeof GAME_STORE_BY_PLATFORM)[string] => !!store)
    .map((store) => ({ ...store, url: storeUrls?.[store.name] ?? store.url(title) }));
}

export interface ContentDetails {
  overview: string;
  cast: { name: string; character: string; profilePath: string | null }[];
  rating: string | null;
  year: string | null;
  genre: string | null;
  runtime: string | null;
  trailerUrl: string | null;
  trailerThumbnail: string | null;
  watchProviders: StoreLink[];
  mediaType: 'movie' | 'tv' | null;
  // TV only — episode count per season (specials/season 0 excluded), straight
  // from TMDB's own live season data, so it stays correct as new seasons air
  // with no maintenance on our end.
  seasons: { seasonNumber: number; episodeCount: number }[];
}

const EMPTY_DETAILS: ContentDetails = {
  overview: '',
  cast: [],
  rating: null,
  year: null,
  genre: null,
  runtime: null,
  trailerUrl: null,
  trailerThumbnail: null,
  watchProviders: [],
  mediaType: null,
  seasons: [],
};

function pickYouTubeTrailer(videos: any[]): { url: string; thumbnail: string } | null {
  const trailers = videos.filter((v) => v.site === 'YouTube' && v.type === 'Trailer');
  const best = trailers.find((v) => v.official) ?? trailers[0];
  if (!best) return null;
  return {
    url: `https://www.youtube.com/watch?v=${best.key}`,
    thumbnail: `https://img.youtube.com/vi/${best.key}/hqdefault.jpg`,
  };
}

async function fetchWatchProviders(id: number, mediaType: 'movie' | 'tv', title: string): Promise<StoreLink[]> {
  const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}/watch/providers`, {
    headers: { Authorization: `Bearer ${TMDB_KEY}` },
  });
  const data = await res.json();
  const region = data.results?.[getWatchProvidersRegion()] ?? data.results?.US;
  if (!region) return [];
  const justWatchUrl: string | undefined = region.link;

  // Same provider can appear in multiple tiers (e.g. rent + buy) — keep the
  // best one only: subscription beats rent beats buy.
  const seen = new Map<string, { logoPath: string; tier: 'flatrate' | 'rent' | 'buy' }>();
  for (const tier of ['flatrate', 'rent', 'buy'] as const) {
    for (const p of (region[tier] ?? []) as any[]) {
      if (!seen.has(p.provider_name)) {
        seen.set(p.provider_name, { logoPath: p.logo_path, tier });
      }
    }
  }

  const TIER_COPY: Record<string, { price: string; cta: string }> = {
    flatrate: { price: 'Stream with subscription', cta: 'Watch now' },
    rent: { price: 'Available to rent', cta: 'Rent now' },
    buy: { price: 'Available to buy', cta: 'Buy now' },
  };

  return Array.from(seen.entries()).map(([name, { logoPath, tier }]) => ({
    name,
    logo: '📺',
    logoUrl: logoPath ? `https://image.tmdb.org/t/p/w92${logoPath}` : undefined,
    price: TIER_COPY[tier].price,
    cta: TIER_COPY[tier].cta,
    color: PROVIDER_STYLE[name]?.color ?? '#1a1a1a',
    url: name === 'JustWatch' ? (justWatchUrl ?? providerLink(name, title)) : providerLink(name, title),
  }));
}

async function fetchWatchDetails(title: string): Promise<ContentDetails> {
  // Multi-search picks up both movies and TV shows
  const searchRes = await fetch(
    `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}&language=en-US&page=1`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  if (!searchRes.ok) return EMPTY_DETAILS;
  const searchData = await searchRes.json();
  const hit = (searchData.results ?? []).find(
    (r: any) => r.media_type === 'movie' || r.media_type === 'tv',
  );
  if (!hit) return EMPTY_DETAILS;

  const endpoint = hit.media_type === 'movie' ? 'movie' : 'tv';
  const detailRes = await fetch(
    `https://api.themoviedb.org/3/${endpoint}/${hit.id}?append_to_response=credits,videos&language=en-US`,
    { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
  );
  const detail = await detailRes.json();

  const year = (detail.release_date || detail.first_air_date || '').slice(0, 4) || null;
  const genre = ((detail.genres ?? []) as any[]).map((g) => g.name).slice(0, 2).join(', ') || null;
  const runtime = detail.runtime
    ? `${detail.runtime}min`
    : detail.episode_run_time?.[0]
      ? `${detail.episode_run_time[0]}min/ep`
      : null;

  const trailer = pickYouTubeTrailer(detail.videos?.results ?? []);
  const watchProviders = await fetchWatchProviders(hit.id, endpoint, title).catch(() => []);
  const seasons = ((detail.seasons ?? []) as any[])
    .filter((s) => s.season_number > 0)
    .map((s) => ({ seasonNumber: s.season_number as number, episodeCount: s.episode_count as number }))
    .sort((a, b) => a.seasonNumber - b.seasonNumber);

  return {
    overview: detail.overview ?? '',
    cast: ((detail.credits?.cast ?? []) as any[]).slice(0, 10).map((c: any) => ({
      name: c.name as string,
      character: (c.character ?? c.roles?.[0]?.character ?? '') as string,
      profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    })),
    rating: detail.vote_average ? detail.vote_average.toFixed(1) : null,
    year,
    genre,
    runtime,
    trailerUrl: trailer?.url ?? null,
    trailerThumbnail: trailer?.thumbnail ?? null,
    watchProviders,
    mediaType: hit.media_type as 'movie' | 'tv',
    seasons,
  };
}

async function fetchGameDetails(title: string): Promise<ContentDetails> {
  const searchRes = await fetch(
    `https://api.rawg.io/api/games?key=${RAWG_KEY}&search=${encodeURIComponent(title)}&page_size=1`,
  );
  const searchData = await searchRes.json();
  const game = searchData.results?.[0];
  if (!game) return EMPTY_DETAILS;

  const [detailRes, storesRes] = await Promise.all([
    fetch(`https://api.rawg.io/api/games/${game.id}?key=${RAWG_KEY}`),
    fetch(`https://api.rawg.io/api/games/${game.id}/stores?key=${RAWG_KEY}`),
  ]);
  const detail = await detailRes.json();
  const storesData = await storesRes.json();

  // Build a map from store name → direct URL using RAWG's store IDs
  const storeUrls: Record<string, string> = {};
  for (const entry of (storesData.results ?? []) as { store_id: number; url: string }[]) {
    const bucket = RAWG_STORE_ID_TO_BUCKET[entry.store_id];
    const store = bucket ? GAME_STORE_BY_PLATFORM[bucket] : null;
    if (store && entry.url) storeUrls[store.name] = entry.url;
  }

  return {
    overview: detail.description_raw ?? '',
    cast: [],
    rating: detail.rating ? detail.rating.toFixed(1) : null,
    year: detail.released ? detail.released.slice(0, 4) : null,
    genre: detail.genres?.[0]?.name ?? null,
    runtime: detail.playtime ? `${detail.playtime}h avg playtime` : null,
    trailerUrl: null,
    trailerThumbnail: null,
    watchProviders: buildGameStores(detail.platforms, title, storeUrls),
    mediaType: null,
    seasons: [],
  };
}

async function fetchBookDetails(title: string): Promise<ContentDetails> {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${BOOKS_KEY}`,
  );
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return EMPTY_DETAILS;

  return {
    overview: info.description ?? '',
    cast: [],
    rating: info.averageRating ? info.averageRating.toFixed(1) : null,
    year: info.publishedDate ? info.publishedDate.slice(0, 4) : null,
    genre: info.categories?.[0] ?? null,
    runtime: info.pageCount ? `${info.pageCount} pages` : null,
    trailerUrl: null,
    trailerThumbnail: null,
    watchProviders: [],
    mediaType: null,
    seasons: [],
  };
}

const SUPPORTED_TYPES: EntryType[] = ['watch', 'play', 'read'];

export interface TVEpisode {
  episodeNumber: number;
  name: string;
  airDate: string | null;
}

export interface TVSeason {
  seasonNumber: number;
  episodeCount: number;
  episodes: TVEpisode[];
}

export function useTVSeasons(tmdbId: string | null | undefined) {
  return useQuery({
    queryKey: ['tv-seasons', tmdbId],
    queryFn: async (): Promise<TVSeason[]> => {
      if (!tmdbId) return [];
      const res = await fetch(
        `https://api.themoviedb.org/3/tv/${tmdbId}?language=en-US`,
        { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
      );
      const detail = await res.json();
      const seasons: TVSeason[] = await Promise.all(
        ((detail.seasons ?? []) as any[])
          .filter((s) => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number)
          .map(async (s) => {
            const epRes = await fetch(
              `https://api.themoviedb.org/3/tv/${tmdbId}/season/${s.season_number}?language=en-US`,
              { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
            );
            const epData = await epRes.json();
            return {
              seasonNumber: s.season_number as number,
              episodeCount: s.episode_count as number,
              episodes: ((epData.episodes ?? []) as any[]).map((e) => ({
                episodeNumber: e.episode_number as number,
                name: e.name as string,
                airDate: (e.air_date as string) ?? null,
              })),
            };
          }),
      );
      return seasons;
    },
    enabled: !!tmdbId,
    staleTime: 60 * 60 * 1000,
  });
}

export function useContentDetails(
  title: string | undefined,
  type: EntryType | undefined,
  externalId?: string,
  mediaType?: string,
) {
  return useQuery({
    queryKey: ['content-details-v2', type, externalId ?? title],
    queryFn: async (): Promise<ContentDetails | null> => {
      if (!title || !type) return null;
      switch (type) {
        case 'watch':
          if (externalId) {
            const endpoint = mediaType === 'movie' ? 'movie' : 'tv';
            const detailRes = await fetch(
              `https://api.themoviedb.org/3/${endpoint}/${externalId}?append_to_response=credits,videos&language=en-US`,
              { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
            );
            const detail = await detailRes.json();
            const year = (detail.release_date || detail.first_air_date || '').slice(0, 4) || null;
            const genre = ((detail.genres ?? []) as any[]).map((g: any) => g.name).slice(0, 2).join(', ') || null;
            const runtime = detail.runtime
              ? `${detail.runtime}min`
              : detail.episode_run_time?.[0]
                ? `${detail.episode_run_time[0]}min/ep`
                : null;
            const trailer = pickYouTubeTrailer(detail.videos?.results ?? []);
            const watchProviders = await fetchWatchProviders(Number(externalId), endpoint, title).catch(() => []);
            const seasons = ((detail.seasons ?? []) as any[])
              .filter((s) => s.season_number > 0)
              .map((s) => ({ seasonNumber: s.season_number as number, episodeCount: s.episode_count as number }))
              .sort((a, b) => a.seasonNumber - b.seasonNumber);
            return {
              overview: detail.overview ?? '',
              cast: ((detail.credits?.cast ?? []) as any[]).slice(0, 10).map((c: any) => ({
                name: c.name as string,
                character: (c.character ?? c.roles?.[0]?.character ?? '') as string,
                profilePath: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
              })),
              rating: detail.vote_average ? detail.vote_average.toFixed(1) : null,
              year,
              genre,
              runtime,
              trailerUrl: trailer?.url ?? null,
              trailerThumbnail: trailer?.thumbnail ?? null,
              watchProviders,
              mediaType: (endpoint as 'movie' | 'tv'),
              seasons,
            };
          }
          return fetchWatchDetails(title);
        case 'play':
          return fetchGameDetails(title);
        case 'read':
          return fetchBookDetails(title);
        default:
          return null;
      }
    },
    enabled: !!title && !!type && SUPPORTED_TYPES.includes(type as EntryType),
    staleTime: 60 * 60 * 1000,
  });
}
