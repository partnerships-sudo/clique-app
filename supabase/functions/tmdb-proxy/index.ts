// Proxies TMDB so the read token stays server-side instead of shipping in the
// app bundle.
//
// TMDB v4 authenticates with an Authorization: Bearer header (not a query
// param), so the client sends only the path and query string and this function
// attaches the token.
//
// Client sends:  { pathAndQuery: "search/multi?query=dune&include_adult=false" }
//
// Set the secret before deploying:
//   supabase secrets set TMDB_KEY=...
const TMDB_KEY = Deno.env.get('TMDB_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Without this the function is an open relay: a caller could pass "../" or a
// protocol-relative value and try to reach a host other than TMDB.
const SAFE_PATH = /^[a-zA-Z0-9/_-]+$/;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const raw = String(body.pathAndQuery ?? '').replace(/^\/+/, '');
    const [path, query = ''] = raw.split('?');

    if (!path || !SAFE_PATH.test(path) || raw.includes('..')) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://api.themoviedb.org/3/${path}${query ? `?${query}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TMDB_KEY}`, accept: 'application/json' },
    });
    const data = await res.json();

    return new Response(JSON.stringify(data), {
      status: res.ok ? 200 : res.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
