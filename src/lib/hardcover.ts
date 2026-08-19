import { supabase } from './supabase';

/**
 * Runs a Hardcover GraphQL query through the `hardcover-proxy` edge function so
 * the token stays server-side.
 *
 * Replaces five near-identical copies of this helper that each held the token
 * directly. Returns the `data` object, or null when the request fails — every
 * call site already treats a missing result as "no books found".
 */
export async function hardcoverQuery(
  query: string,
  variables?: Record<string, unknown>,
): Promise<any> {
  const { data, error } = await supabase.functions.invoke<{ data?: any; errors?: any[] }>(
    'hardcover-proxy',
    { body: variables ? { query, variables } : { query } },
  );

  if (error) {
    console.warn('[Hardcover]', error.message, '\nQuery:', query.slice(0, 120));
    return null;
  }
  if (data?.errors?.length) {
    console.warn('[Hardcover]', data.errors[0]?.message, '\nQuery:', query.slice(0, 120));
  }
  return data?.data ?? null;
}
