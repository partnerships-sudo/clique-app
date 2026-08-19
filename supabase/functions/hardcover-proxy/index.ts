// Proxies Hardcover's GraphQL API so the token stays server-side instead of
// shipping in the app bundle.
//
// Client sends:  { query: "query { ... }", variables: { ... } }
//
// Unlike tmdb-proxy, this is a passthrough: the app builds a dozen different
// GraphQL queries and allowlisting them would mean redeploying this function
// every time one changes. Two guards compensate:
//
//   1. JWT verification stays ON (the default), so only signed-in users can
//      spend the token's quota.
//   2. Mutations are rejected — this proxy is read-only by construction, so a
//      caller cannot write to the Hardcover account behind the token.
//
// Set the secret before deploying:
//   supabase secrets set HARDCOVER_TOKEN=...
const HARDCOVER_TOKEN = Deno.env.get('HARDCOVER_TOKEN')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Deliberately blunt: any GraphQL operation keyword other than `query` is
// refused, including subscriptions.
const FORBIDDEN = /\b(mutation|subscription)\b/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const query = String(body.query ?? '');

    if (!query.trim()) return json({ error: 'Missing query' }, 400);
    if (query.length > 8000) return json({ error: 'Query too large' }, 400);
    if (FORBIDDEN.test(query)) return json({ error: 'Read-only proxy' }, 403);

    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HARDCOVER_TOKEN}`,
      },
      body: JSON.stringify({ query, variables: body.variables ?? undefined }),
    });
    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
