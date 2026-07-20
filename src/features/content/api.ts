import { useQuery } from '@tanstack/react-query';
import * as Localization from 'expo-localization';

import type { EntryType } from '@/constants/theme';
import type { StoreLink } from '@/features/where-to-find/links';
import { igdbSearch, igdbDetails } from '@/features/games/igdb';
import { getSpotifyToken } from '@/features/search/api';
import { supabase } from '@/lib/supabase';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY!;
const HARDCOVER_TOKEN = process.env.EXPO_PUBLIC_HARDCOVER_TOKEN!;

async function hardcoverQuery(query: string): Promise<any> {
  const res = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${HARDCOVER_TOKEN}` },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  return json.data;
}

async function podcastIndexSearch(query: string): Promise<any> {
  const { data } = await supabase.functions.invoke('podcast-index', { body: { action: 'search', query } });
  return data;
}

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
    logoUrl: 'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=64',
    price: 'PC / Mac',
    cta: 'Find on Steam',
    color: '#1B2838',
    url: (t) => `https://store.steampowered.com/search/?term=${encodeURIComponent(t)}`,
  },
  playstation: {
    name: 'PlayStation Store',
    logo: '🔵',
    logoUrl: 'https://www.google.com/s2/favicons?domain=store.playstation.com&sz=64',
    price: 'PS4 / PS5',
    cta: 'Find on PS Store',
    color: '#003791',
    url: (t) => `https://store.playstation.com/search/${encodeURIComponent(t)}`,
  },
  xbox: {
    name: 'Xbox Store',
    logo: '🟢',
    logoUrl: 'https://www.google.com/s2/favicons?domain=xbox.com&sz=64',
    price: 'Xbox / Game Pass',
    cta: 'Find on Xbox',
    color: '#107C10',
    url: (t) => `https://www.xbox.com/search?q=${encodeURIComponent(t)}`,
  },
  'nintendo-switch': {
    name: 'Nintendo eShop',
    logo: '🔴',
    logoUrl: 'https://www.google.com/s2/favicons?domain=nintendo.com&sz=64',
    price: 'Switch',
    cta: 'Find on eShop',
    color: '#E4000F',
    url: (t) => `https://www.nintendo.com/search/#q=${encodeURIComponent(t)}`,
  },
  ios: {
    name: 'App Store',
    logo: '📱',
    logoUrl: 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=64',
    price: 'iOS',
    cta: 'Find on App Store',
    color: '#007AFF',
    url: (t) => `https://apps.apple.com/search?term=${encodeURIComponent(t)}`,
  },
  android: {
    name: 'Google Play',
    logo: '▶️',
    logoUrl: 'https://www.google.com/s2/favicons?domain=play.google.com&sz=64',
    price: 'Android',
    cta: 'Find on Google Play',
    color: '#01875F',
    url: (t) => `https://play.google.com/store/search?q=${encodeURIComponent(t)}&c=apps`,
  },
};


export interface ContentDetails {
  overview: string;
  cast: { name: string; character: string; profilePath: string | null; previewUrl?: string | null }[];
  hosts: { name: string; photoUrl: string | null }[];
  author: { name: string; bio: string; photoUrl: string | null } | null;
  developer: { name: string; logoUrl: string | null } | null;
  rating: string | null;
  year: string | null;
  genre: string | null;
  runtime: string | null;
  trailerUrl: string | null;
  trailerThumbnail: string | null;
  watchProviders: StoreLink[];
  mediaType: 'movie' | 'tv' | null;
  seasons: { seasonNumber: number; episodeCount: number }[];
}

const EMPTY_DETAILS: ContentDetails = {
  overview: '',
  cast: [],
  hosts: [],
  author: null,
  developer: null,
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
    hosts: [],
    author: null,
    developer: null,
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

async function fetchWikipediaGameSummary(title: string): Promise<string> {
  try {
    // Try the "(video game)" disambiguation page first, then fall back to plain title
    const candidates = [
      `${title.replace(/ /g, '_')}_(video_game)`,
      title.replace(/ /g, '_'),
    ];
    for (const slug of candidates) {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`);
      if (!res.ok) continue;
      const data = await res.json();
      // Skip disambiguation pages and clearly wrong articles
      if (data.type === 'disambiguation') continue;
      const extract: string = data.extract ?? '';
      if (extract && (/(game|developed|published|gameplay|players?)/i).test(extract)) return extract;
    }
    return '';
  } catch {
    return '';
  }
}

async function fetchGameDetails(title: string, externalId?: string): Promise<ContentDetails> {
  const igdbId = externalId ? Number(externalId) : null;
  const detail = igdbId
    ? await igdbDetails(igdbId)
    : await igdbSearch(title).then((r) => r[0] ? igdbDetails(r[0].id) : null);

  const igdbSummary = detail?.summary ?? '';
  const overview = igdbSummary || await fetchWikipediaGameSummary(detail?.title || title);

  if (!detail) {
    return { ...EMPTY_DETAILS, overview };
  }

  const stores = detail.platforms
    .map((bucket) => GAME_STORE_BY_PLATFORM[bucket])
    .filter((store): store is (typeof GAME_STORE_BY_PLATFORM)[string] => !!store)
    .map((store) => ({ ...store, url: detail.storeUrls[store.name] ?? store.url(title) }));

  return {
    ...EMPTY_DETAILS,
    overview,
    cast: detail.cast ?? [],
    rating: detail.rating ?? null,
    year: detail.year ?? null,
    genre: detail.genre ?? null,
    developer: detail.developer ?? null,
    trailerUrl: detail.trailerUrl ?? null,
    trailerThumbnail: detail.trailerThumbnail ?? null,
    watchProviders: stores,
  };
}

async function fetchHardcoverBookById(id: number): Promise<ContentDetails | null> {
  const query = `query { books(where: { id: { _eq: ${id} } }, limit: 1) { title rating description release_year contributions { author { name bio image { url } } } default_physical_edition { pages } } }`;
  const data = await hardcoverQuery(query);
  const book = data?.books?.[0];
  if (!book) return null;
  const contrib = book.contributions?.[0]?.author;
  const author = contrib
    ? { name: contrib.name ?? '', bio: (contrib.bio ?? '').replace(/<[^>]*>/g, '').trim(), photoUrl: contrib.image?.url ?? null }
    : null;
  return {
    ...EMPTY_DETAILS,
    overview: (book.description ?? '').replace(/<[^>]*>/g, '').trim(),
    author,
    rating: book.rating ? Number(book.rating).toFixed(1) : null,
    year: book.release_year ? String(book.release_year) : null,
    runtime: book.default_physical_edition?.pages ? `${book.default_physical_edition.pages} pages` : null,
  };
}

async function fetchBookDetails(title: string, externalId?: string): Promise<ContentDetails> {
  // Prefer Hardcover (richer data, better descriptions) — fall back to Google Books.
  try {
    // If we have the Hardcover book ID, fetch directly; otherwise search by title first.
    let bookId = externalId ? Number(externalId) : null;
    if (!bookId) {
      const searchQ = `query { search(query: ${JSON.stringify(title)}, query_type: "Book", per_page: 1, page: 1) { results } }`;
      const searchData = await hardcoverQuery(searchQ);
      bookId = searchData?.search?.results?.hits?.[0]?.document?.id ?? null;
    }
    if (bookId) {
      const result = await fetchHardcoverBookById(bookId);
      if (result) return result;
    }
  } catch { /* fall through to Google Books */ }

  // Google Books fallback
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(title)}&maxResults=1&key=${BOOKS_KEY}`,
  );
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  if (!info) return EMPTY_DETAILS;
  return {
    ...EMPTY_DETAILS,
    overview: info.description ?? '',
    rating: info.averageRating ? info.averageRating.toFixed(1) : null,
    year: info.publishedDate ? info.publishedDate.slice(0, 4) : null,
    genre: info.categories?.[0] ?? null,
    runtime: info.pageCount ? `${info.pageCount} pages` : null,
  };
}

const SUPPORTED_TYPES: EntryType[] = ['watch', 'play', 'read', 'podcast', 'listen'];

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


function parseHostNamesFromDescription(desc: string): string[] {
  const hostedBy = desc.match(/hosted by\s+([A-Z][^.!?]+)/i);
  if (hostedBy) {
    const names = hostedBy[1].split(/\s*[,&]\s*|\s+and\s+/i)
      .map(s => s.trim()).filter(s => /^[A-Z][a-z]/.test(s) && s.split(' ').length <= 4);
    if (names.length > 0) return names;
  }
  const presentedBy = desc.match(/presented by\s+([A-Z][^.!?]+)/i);
  if (presentedBy) {
    const names = presentedBy[1].split(/\s*[,&]\s*|\s+and\s+/i)
      .map(s => s.trim()).filter(s => /^[A-Z][a-z]/.test(s) && s.split(' ').length <= 4);
    if (names.length > 0) return names;
  }
  const withMatch = desc.match(/\bwith\s+((?:[A-Z][a-z]+ [A-Z][a-z]+)(?:\s*[&,]\s*(?:[A-Z][a-z]+ [A-Z][a-z]+))*)/);
  if (withMatch) {
    return withMatch[1].split(/\s*[,&]\s*/).map(s => s.trim()).filter(Boolean);
  }
  return [];
}

async function fetchWikipediaPhoto(name: string): Promise<string | null> {
  try {
    const slug = name.trim().replace(/ /g, '_');
    const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(slug)}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Sanity-check: make sure it's a person page, not a disambig or unrelated article
    if (data.type === 'disambiguation') return null;
    return data.thumbnail?.source ?? null;
  } catch {
    return null;
  }
}

async function enrichHostsWithPhotos(names: string[]): Promise<{ name: string; photoUrl: string | null }[]> {
  return Promise.all(names.map(async (name) => ({ name, photoUrl: await fetchWikipediaPhoto(name) })));
}


async function fetchMusicDetails(title: string, externalId?: string): Promise<ContentDetails> {
  try {
    const token = await getSpotifyToken();
    let album: any = null;

    if (externalId) {
      const res = await fetch(`https://api.spotify.com/v1/albums/${externalId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) album = await res.json();
    }

    if (!album) {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(title)}&type=album&limit=1`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const data = await res.json();
      const hit = data.albums?.items?.[0];
      if (hit) {
        const detailRes = await fetch(`https://api.spotify.com/v1/albums/${hit.id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (detailRes.ok) album = await detailRes.json();
      }
    }

    if (!album) return EMPTY_DETAILS;

    const artistId = album.artists?.[0]?.id;
    const artistName = album.artists?.[0]?.name ?? '';
    const genre = (album.genres?.length ? album.genres : null)?.slice(0, 2).join(', ') ?? null;
    const year = (album.release_date ?? '').slice(0, 4) || null;
    const trackCount = album.total_tracks ?? null;
    const label = album.label ?? null;

    // Fetch artist details for bio + genre fallback
    let artistBio = '';
    let artistGenre = genre;
    let artistPhotoUrl: string | null = null;
    if (artistId) {
      try {
        const artistRes = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (artistRes.ok) {
          const artist = await artistRes.json();
          if (!artistGenre && artist.genres?.length) {
            artistGenre = artist.genres.slice(0, 2).join(', ');
          }
          artistPhotoUrl = artist.images?.[0]?.url ?? null;
        }
      } catch { /* ignore */ }
    }

    // Wikipedia artist bio as overview
    if (artistName) {
      try {
        const slug = encodeURIComponent(artistName.replace(/ /g, '_'));
        const wikiRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${slug}`);
        if (wikiRes.ok) {
          const wikiData = await wikiRes.json();
          if (wikiData.type !== 'disambiguation' && wikiData.extract) {
            artistBio = wikiData.extract;
          }
        }
      } catch { /* ignore */ }
    }

    // Artist's top tracks across all albums via search
    let topTracks: ContentDetails['cast'] = [];
    if (artistName) {
      try {
        const tracksRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=track&limit=5&market=US`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (tracksRes.ok) {
          const tracksData = await tracksRes.json();
          const spotifyTracks = (tracksData.tracks?.items ?? []) as any[];
          topTracks = await Promise.all(spotifyTracks.map(async (t: any) => {
            let previewUrl: string | null = null;
            try {
              const itunesRes = await fetch(
                `https://itunes.apple.com/search?term=${encodeURIComponent(`${t.name} ${artistName}`)}&entity=song&limit=1`
              );
              if (itunesRes.ok) {
                const itunesData = await itunesRes.json();
                previewUrl = itunesData.results?.[0]?.previewUrl ?? null;
              }
            } catch { /* ignore */ }
            return {
              name: t.name,
              character: t.album?.name ?? '',
              profilePath: t.album?.images?.[0]?.url ?? null,
              previewUrl,
            };
          }));
        }
      } catch { /* ignore */ }
    }

    const metaParts = [
      trackCount ? `${trackCount} tracks` : null,
      label,
    ].filter(Boolean);

    return {
      ...EMPTY_DETAILS,
      overview: artistBio,
      cast: topTracks,
      rating: null,
      year,
      genre: artistGenre,
      runtime: metaParts.join(' · ') || null,
      watchProviders: [
        { name: 'Spotify', logo: '🟢', logoUrl: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64', price: 'Stream free or premium', cta: 'Listen on Spotify', color: '#1DB954', url: album.external_urls?.spotify ?? `https://open.spotify.com/search/${encodeURIComponent(title)}` },
        { name: 'Apple Music', logo: '🎵', logoUrl: 'https://www.google.com/s2/favicons?domain=music.apple.com&sz=64', price: 'Stream', cta: 'Listen on Apple Music', color: '#FC3C44', url: `https://music.apple.com/search?term=${encodeURIComponent(title)}` },
        { name: 'Amazon Music', logo: '🎶', logoUrl: 'https://www.google.com/s2/favicons?domain=music.amazon.com&sz=64', price: 'Stream or buy', cta: 'Find on Amazon', color: '#FF9900', url: `https://music.amazon.com/search/${encodeURIComponent(title)}` },
        { name: 'Tidal', logo: '💧', logoUrl: 'https://www.google.com/s2/favicons?domain=tidal.com&sz=64', price: 'Hi-fi streaming', cta: 'Listen on Tidal', color: '#000000', url: `https://tidal.com/search?q=${encodeURIComponent(title)}` },
      ],
    };
  } catch {
    return EMPTY_DETAILS;
  }
}

async function fetchPodcastDetails(externalIdOrTitle: string, byTitle = false, titleForItunes?: string): Promise<ContentDetails> {
  try {
    const cleanTitle = (titleForItunes ?? (byTitle ? externalIdOrTitle : '')).replace(/\.{2,}$/, '').trim();
    let hostNames: string[] = [];
    let genre: string | null = null;
    if (cleanTitle) {
      try {
        const piData = await podcastIndexSearch(cleanTitle);
        const piHit = piData?.feeds?.[0];
        const piAuthor = piHit?.author || piHit?.ownerName;
        if (piAuthor) hostNames = [piAuthor];
        genre = piHit?.categories ? Object.values(piHit.categories as Record<string, string>)[0] ?? null : null;
      } catch {
        const itunesRes = await fetch(
          `https://itunes.apple.com/search?term=${encodeURIComponent(cleanTitle)}&entity=podcast&limit=1`,
        );
        const itunesData = await itunesRes.json();
        const itunesHit = itunesData.results?.[0];
        if (itunesHit?.artistName) hostNames = [itunesHit.artistName];
        genre = itunesHit?.primaryGenreName ?? null;
      }
    }

    let show: any = null;
    try {
      const token = await getSpotifyToken();
      if (byTitle) {
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${encodeURIComponent(cleanTitle)}&type=show&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const searchData = await searchRes.json();
        show = searchData.shows?.items?.[0];
      } else {
        const res = await fetch(`https://api.spotify.com/v1/shows/${externalIdOrTitle}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        show = await res.json();
      }
    } catch { /* proceed without Spotify show data */ }
    const description = show
      ? (show.description ?? show.html_description ?? '').replace(/<[^>]*>/g, '').trim()
      : '';

    if (description && (hostNames.length === 0 || !hostNames[0]?.includes(' '))) {
      const parsed = parseHostNamesFromDescription(description);
      if (parsed.length > 0) hostNames = parsed;
    }

    const hosts = await enrichHostsWithPhotos(hostNames);

    return {
      ...EMPTY_DETAILS,
      overview: description,
      hosts,
      genre,
    };
  } catch {
    return { ...EMPTY_DETAILS };
  }
}

export function useContentDetails(
  title: string | undefined,
  type: EntryType | undefined,
  externalId?: string,
  mediaType?: string,
) {
  return useQuery({
    queryKey: ['content-details-v17', type, externalId ?? title],
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
              hosts: [],
              author: null,
              developer: null,
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
        case 'listen':
          return fetchMusicDetails(title, externalId);
        case 'play':
          return fetchGameDetails(title, externalId);
        case 'read':
          return fetchBookDetails(title, externalId);
        case 'podcast':
          if (externalId) return fetchPodcastDetails(externalId, false, title);
          return fetchPodcastDetails(title, true);
        default:
          return null;
      }
    },
    enabled: !!title && !!type && SUPPORTED_TYPES.includes(type as EntryType),
    staleTime: 60 * 60 * 1000,
  });
}
