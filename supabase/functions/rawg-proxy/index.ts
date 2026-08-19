// Proxies RAWG so the API key stays server-side instead of shipping in the app
// bundle.
//
// RAWG authenticates with a `key` query parameter. The client sends only the
// search terms or a game id.
//
// Client sends:  { action: "search", query: "hollow knight" }
//                { action: "details", id: 12345 }
//
// Note: RAWG is the fallback path for when `igdb-cover` fails, and it used to
// call RAWG directly precisely so it did not depend on our own backend. Going
// through this proxy narrows that independence — but a Supabase outage already
// takes the whole app down, so the fallback still covers the cases that
// actually occur (IGDB credential problems, IGDB outages, igdb-cover bugs).
//
// Set the secret before deploying:
//   supabase secrets set RAWG_KEY=...
const RAWG_KEY = Deno.env.get('RAWG_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    let url: string;
    if (action === 'search') {
      const query = String(body.query ?? '').trim();
      if (!query) return json({ error: 'Missing query' }, 400);
      const params = new URLSearchParams({
        key: RAWG_KEY,
        search: query,
        page_size: '6',
      });
      url = `https://api.rawg.io/api/games?${params}`;
    } else if (action === 'details') {
      // Numeric only: this id lands in the path, so anything else could be used
      // to reach a different RAWG endpoint.
      const id = Number(body.id);
      if (!Number.isInteger(id) || id <= 0) return json({ error: 'Invalid id' }, 400);
      url = `https://api.rawg.io/api/games/${id}?${new URLSearchParams({ key: RAWG_KEY })}`;
    } else {
      return json({ error: 'Invalid action' }, 400);
    }

    const res = await fetch(url);
    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
