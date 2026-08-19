// Proxies Giphy so the API key stays server-side instead of shipping in the
// app bundle.
//
// Giphy authenticates with an `api_key` query parameter, so the client sends
// only the search terms and this function attaches the key.
//
// Client sends:  { action: "search", query: "popcorn", limit: 24 }
//                { action: "trending", limit: 24 }
//
// Set the secret before deploying:
//   supabase secrets set GIPHY_KEY=...
const GIPHY_KEY = Deno.env.get('GIPHY_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// An allowlist rather than a passthrough path: this proxy only ever needs two
// endpoints, so there is no reason to let a caller reach anything else.
const ACTIONS = new Set(['search', 'trending']);

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
    const action = String(body.action ?? '');
    if (!ACTIONS.has(action)) return json({ error: 'Invalid action' }, 400);

    // Clamp so a caller cannot use us to pull huge pages on the key's quota.
    const limit = Math.min(Math.max(Number(body.limit) || 24, 1), 50);
    const rating = 'pg-13';

    const params = new URLSearchParams({
      api_key: GIPHY_KEY,
      limit: String(limit),
      rating,
    });
    if (action === 'search') {
      const query = String(body.query ?? '').trim();
      if (!query) return json({ error: 'Missing query' }, 400);
      params.set('q', query);
    }

    const res = await fetch(`https://api.giphy.com/v1/gifs/${action}?${params}`);
    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
