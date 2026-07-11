// Looks up portrait box-art for game titles via IGDB (Twitch's game database).
// RAWG (used elsewhere for game search/metadata) only exposes landscape
// screenshots, so this exists purely to get a 2:3 cover image to match the
// Books/Movies grid. The Twitch client secret must never ship in the app
// bundle, so the client-credentials exchange happens here, server-side.
//
// Accepts a batch of titles and resolves them all from a single client call —
// callers like the For You games feed can need a dozen+ covers at once, and
// IGDB's rate limit (4 req/s per client) makes unbounded fan-out a real risk.
//
// IGDB's `multiquery` endpoint would be the obvious way to batch these into
// one HTTP request, but its `search` operator (the one that does real
// relevance ranking) silently returns nothing inside a multiquery sub-block —
// confirmed empirically, not documented. The `where name ~ *"..."*` fallback
// that does work inside multiquery has no reliable popularity signal to sort
// by (IGDB's `follows`/`hypes` fields are sparse), so it surfaces DLC/mod
// entries ahead of the actual base game. Per-title `search` against the plain
// /games endpoint is the only path that ranks correctly, so batching instead
// happens here as bounded-concurrency fan-out, one search per title.
const IGDB_CLIENT_ID = Deno.env.get('IGDB_CLIENT_ID')!;
const IGDB_CLIENT_SECRET = Deno.env.get('IGDB_CLIENT_SECRET')!;

const MAX_TITLES = 25;
const CONCURRENCY = 4;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;

  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: IGDB_CLIENT_ID,
      client_secret: IGDB_CLIENT_SECRET,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Twitch token exchange failed: ${JSON.stringify(data)}`);

  // Refresh a little early so a request never races an expiring token.
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return cachedToken.token;
}

function coverUrlFromImageId(imageId: string | undefined | null): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg` : null;
}

async function searchCover(title: string, token: string): Promise<string | null> {
  const escaped = title.replace(/"/g, '\\"');
  const res = await fetch('https://api.igdb.com/v4/games', {
    method: 'POST',
    headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body: `search "${escaped}"; fields cover.image_id; limit 1;`,
  });
  const results = await res.json();
  return coverUrlFromImageId(results?.[0]?.cover?.image_id);
}

// Runs `items` through `worker` with at most `limit` in flight at once,
// preserving input order in the returned array.
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const { titles } = await req.json();
    const list: string[] = Array.isArray(titles) ? titles.filter((t) => typeof t === 'string' && t.trim()) : [];

    if (list.length === 0) {
      return new Response(JSON.stringify({ covers: {} }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const capped = list.slice(0, MAX_TITLES);
    const token = await getAccessToken();

    const coverUrls = await mapWithConcurrency(capped, CONCURRENCY, (title) =>
      searchCover(title, token).catch(() => null),
    );

    const covers: Record<string, string | null> = {};
    capped.forEach((title, i) => {
      covers[title] = coverUrls[i];
    });

    return new Response(JSON.stringify({ covers }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Never surface a 500 to the client — just fall back to no covers.
    console.error('igdb-cover error', err);
    return new Response(JSON.stringify({ covers: {}, error: String(err) }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
