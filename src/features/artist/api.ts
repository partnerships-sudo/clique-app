import { useQuery } from '@tanstack/react-query';

import { getSpotifyToken } from '@/features/search/api';

export interface ArtistInfo {
  id: string;
  name: string;
  image: string | null;
  genres: string[];
  followers: number;
  spotifyUrl: string;
}

export interface ArtistTrack {
  id: string;
  name: string;
  image: string | null;
  spotifyUrl: string;
}

export interface ArtistPanelData {
  artist: ArtistInfo;
  topTracks: ArtistTrack[];
}

async function fetchArtistPanel(name: string): Promise<ArtistPanelData | null> {
  const token = await getSpotifyToken();

  const searchRes = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(name)}&type=artist&limit=1`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const searchData = await searchRes.json();
  const found = searchData.artists?.items?.[0];
  if (!found) return null;

  const artist: ArtistInfo = {
    id: found.id,
    name: found.name,
    image: found.images?.[0]?.url ?? null,
    genres: found.genres ?? [],
    followers: found.followers?.total ?? 0,
    spotifyUrl: found.external_urls?.spotify ?? `https://open.spotify.com/search/${encodeURIComponent(name)}`,
  };

  const tracksRes = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const tracksData = await tracksRes.json();
  const topTracks: ArtistTrack[] = ((tracksData.tracks ?? []) as any[]).slice(0, 8).map((t) => ({
    id: t.id,
    name: t.name,
    image: t.album?.images?.[1]?.url ?? t.album?.images?.[0]?.url ?? null,
    spotifyUrl: t.external_urls?.spotify ?? '',
  }));

  return { artist, topTracks };
}

export function useArtistPanel(artistName: string | null) {
  return useQuery({
    queryKey: ['artist-panel', artistName],
    queryFn: () => fetchArtistPanel(artistName!),
    enabled: !!artistName,
  });
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M followers`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K followers`;
  return `${n} followers`;
}

export { formatFollowers };

export function extractArtistName(sub: string | null): string | null {
  const name = sub?.split('·')[0]?.trim();
  return name || null;
}
