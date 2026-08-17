import { supabase } from './supabase';

/**
 * Calls TMDB through the `tmdb-proxy` edge function so the read token stays
 * server-side instead of shipping in the app bundle.
 *
 * Pass the path and query only — no leading slash, no host:
 *
 *   const data = await tmdbFetch<SearchResponse>('search/multi?query=dune');
 *
 * Throws on transport errors and on non-2xx responses from TMDB, so callers
 * can rely on a resolved promise meaning a usable body. React Query call sites
 * surface that as a normal query error.
 */
export async function tmdbFetch<T = any>(pathAndQuery: string): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('tmdb-proxy', {
    body: { pathAndQuery },
  });

  if (error) throw new Error(`TMDB proxy error: ${error.message}`);
  if (data == null) throw new Error('TMDB proxy returned no data');

  // The proxy forwards TMDB's own error shape rather than throwing, so a
  // status_message in the body means the upstream call failed.
  const maybeError = data as { status_message?: string };
  if (maybeError.status_message) {
    throw new Error(`TMDB error: ${maybeError.status_message}`);
  }

  return data;
}
