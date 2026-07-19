const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_KEY ?? '';
const BASE = 'https://api.giphy.com/v1/gifs';

export interface GiphyResult {
  id: string;
  url: string;
  preview: string;
  width: number;
  height: number;
}

function mapGif(g: any): GiphyResult {
  const orig = g.images.original;
  const preview = g.images.fixed_width_small;
  return {
    id: g.id,
    url: orig.url,
    preview: preview.url,
    width: Number(orig.width),
    height: Number(orig.height),
  };
}

export async function searchGifs(query: string, limit = 24): Promise<GiphyResult[]> {
  const endpoint = query.trim()
    ? `${BASE}/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
    : `${BASE}/trending?api_key=${GIPHY_KEY}&limit=${limit}&rating=pg-13`;
  const res = await fetch(endpoint);
  const json = await res.json();
  return (json.data ?? []).map(mapGif);
}
