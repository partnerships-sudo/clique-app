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
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 300) * 1000 };
  return cachedToken.token;
}

function igdb(token: string, endpoint: string, body: string) {
  return fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': IGDB_CLIENT_ID, Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
    body,
  }).then((r) => r.json());
}

function coverUrl(imageId: string | undefined | null): string | null {
  return imageId ? `https://images.igdb.com/igdb/image/upload/t_cover_big_2x/${imageId}.jpg` : null;
}

// Platform ID → bucket used by the client-side store list
const PLATFORM_BUCKET: Record<number, string> = {
  6: 'pc', 14: 'pc', 3: 'pc',           // Windows, Mac, Linux
  48: 'playstation', 167: 'playstation', // PS4, PS5
  49: 'xbox', 169: 'xbox',              // Xbox One, Xbox Series X/S
  130: 'nintendo-switch',
  39: 'ios', 34: 'android',
};

// IGDB website category → store label (for direct store URL extraction)
const WEBSITE_STORE: Record<number, string> = {
  13: 'Steam',
  15: 'itch.io',
  16: 'Epic Games',
  17: 'GOG',
};

function mapGame(g: any) {
  const releaseTs = g.first_release_date;
  const year = releaseTs ? new Date(releaseTs * 1000).getFullYear().toString() : null;
  const genre = g.genres?.[0]?.name ?? null;
  const platforms = (g.platforms ?? []).map((p: any) => PLATFORM_BUCKET[p.id]).filter(Boolean);
  const storeUrls: Record<string, string> = {};
  for (const w of g.websites ?? []) {
    const store = WEBSITE_STORE[w.category];
    if (store && w.url) storeUrls[store] = w.url;
  }
  return {
    id: g.id,
    title: g.name,
    cover: coverUrl(g.cover?.image_id),
    summary: g.summary ?? null,
    rating: g.rating ? (g.rating / 20).toFixed(1) : null, // IGDB 0-100 → 0-5
    year,
    genre,
    playtime: g.game_modes?.find((m: any) => m.name === 'Single player') ? null : null,
    platforms: [...new Set(platforms)] as string[],
    storeUrls,
    similarIds: (g.similar_games ?? []).map((s: any) => (typeof s === 'number' ? s : s.id)),
  };
}

// --- action: covers (original behaviour, backward-compat) ---
async function handleCovers(titles: string[], token: string) {
  const unique = [...new Set(titles.filter(Boolean))].slice(0, MAX_TITLES);
  async function run(items: string[]): Promise<(string | null)[]> {
    const results: (string | null)[] = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        const t = items[i];
        const escaped = t.replace(/"/g, '\\"');
        try {
          const data = await igdb(token, 'games', `search "${escaped}"; fields cover.image_id; limit 1;`);
          results[i] = coverUrl(data?.[0]?.cover?.image_id);
        } catch { results[i] = null; }
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker));
    return results;
  }
  const urls = await run(unique);
  const covers: Record<string, string | null> = {};
  unique.forEach((t, i) => { covers[t] = urls[i]; });
  return { covers };
}

// --- action: search ---
async function handleSearch(query: string, token: string) {
  const escaped = query.replace(/"/g, '\\"');
  const data = await igdb(token, 'games',
    `search "${escaped}"; fields name, cover.image_id, genres.name, first_release_date, rating, platforms.id; limit 8;`);
  return { results: (data ?? []).map(mapGame) };
}

// --- action: details ---
async function handleDetails(id: number, token: string) {
  // Two independent queries: game details + voice cast (separate endpoint)
  const [gameData, charData] = await Promise.all([
    igdb(token, 'games',
      `fields name, summary, rating, first_release_date, genres.name, platforms.id, websites.url, websites.category, cover.image_id, similar_games, involved_companies.developer, involved_companies.company.name, involved_companies.company.logo.image_id, videos.video_id, videos.name; where id = ${id}; limit 1;`),
    igdb(token, 'characters',
      `fields name, voice_actors.name, voice_actors.mug_shot.image_id; where games = (${id}); limit 10;`)
      .catch(() => []),
  ]);

  const game = gameData?.[0];
  if (!game) return { game: null };

  const dev = (game.involved_companies ?? []).find((c: any) => c.developer);
  const developer = dev ? {
    name: dev.company?.name ?? null,
    logoUrl: dev.company?.logo?.image_id
      ? `https://images.igdb.com/igdb/image/upload/t_logo_med/${dev.company.logo.image_id}.png`
      : null,
  } : null;

  const cast: { name: string; character: string; profilePath: string | null }[] = [];
  for (const ch of (charData ?? []) as any[]) {
    const actor = ch.voice_actors?.[0];
    if (!actor?.name) continue;
    cast.push({
      name: actor.name,
      character: ch.name ?? '',
      profilePath: actor.mug_shot?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_thumb/${actor.mug_shot.image_id}.jpg`
        : null,
    });
  }

  const trailerVideo = (game.videos ?? []).find((v: any) =>
    /trailer/i.test(v.name ?? '')
  ) ?? game.videos?.[0] ?? null;
  const trailerUrl = trailerVideo?.video_id
    ? `https://www.youtube.com/watch?v=${trailerVideo.video_id}`
    : null;
  const trailerThumbnail = trailerVideo?.video_id
    ? `https://img.youtube.com/vi/${trailerVideo.video_id}/hqdefault.jpg`
    : null;

  return { game: { ...mapGame(game), developer, cast, trailerUrl, trailerThumbnail } };
}

// --- action: similar ---
async function handleSimilar(id: number, token: string) {
  // Fetch the game's similar_games IDs first, then get full details for each
  const seed = await igdb(token, 'games',
    `fields similar_games; where id = ${id}; limit 1;`);
  const similarIds: number[] = seed?.[0]?.similar_games ?? [];
  if (similarIds.length === 0) return { results: [] };

  const idList = similarIds.slice(0, 12).join(',');
  const data = await igdb(token, 'games',
    `fields name, cover.image_id, genres.name, first_release_date, rating; where id = (${idList}); limit 12;`);
  return { results: (data ?? []).map(mapGame) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });

  try {
    const body = await req.json();
    const token = await getAccessToken();

    let result: unknown;
    if (body.action === 'search') {
      result = await handleSearch(body.query, token);
    } else if (body.action === 'details') {
      result = await handleDetails(body.id, token);
    } else if (body.action === 'similar') {
      result = await handleSimilar(body.id, token);
    } else {
      // Default: cover-only batch (backward compat)
      const titles: string[] = Array.isArray(body.titles) ? body.titles.filter((t: any) => typeof t === 'string' && t.trim()) : [];
      result = await handleCovers(titles, token);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('igdb-cover error', err);
    return new Response(JSON.stringify({ covers: {}, error: String(err) }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
