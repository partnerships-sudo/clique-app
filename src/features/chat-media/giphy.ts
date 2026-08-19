import { supabase } from '@/lib/supabase';

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

/**
 * Goes through the `giphy-proxy` edge function so the API key stays
 * server-side. An empty query returns trending, which is what the picker shows
 * before the user types.
 */
export async function searchGifs(query: string, limit = 24): Promise<GiphyResult[]> {
  const trimmed = query.trim();
  const { data, error } = await supabase.functions.invoke<{ data?: any[] }>('giphy-proxy', {
    body: trimmed
      ? { action: 'search', query: trimmed, limit }
      : { action: 'trending', limit },
  });

  // The picker is a nice-to-have inside the composer: a failure here should
  // show an empty shelf, not break sending a message.
  if (error || !data) return [];
  return (data.data ?? []).map(mapGif);
}
