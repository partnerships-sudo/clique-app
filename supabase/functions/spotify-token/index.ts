const SPOTIFY_CLIENT_ID = Deno.env.get('SPOTIFY_CLIENT_ID')!;
const SPOTIFY_CLIENT_SECRET = Deno.env.get('SPOTIFY_CLIENT_SECRET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  const basic = btoa(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`);
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${basic}` },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Spotify token exchange failed: ${JSON.stringify(data)}`);
  cachedToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.token;
}

async function fetchUpcomingAlbums(): Promise<unknown[]> {
  const token = await getToken();
  // tag:new returns albums Spotify has flagged as new releases (last 2 weeks + pre-releases)
  const res = await fetch(
    'https://api.spotify.com/v1/search?q=tag:new&type=album&market=US&limit=25',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = await res.json();
  const today = new Date().toISOString().slice(0, 10);
  return (data.albums?.items ?? [])
    .filter((a: any) => a.name && a.artists?.length && a.release_date >= today)
    .map((a: any) => ({
      id: a.id,
      title: a.name,
      artist: a.artists.map((ar: any) => ar.name).join(', '),
      cover: a.images?.[0]?.url ?? null,
      releaseDate: a.release_date,
      albumType: a.album_type ?? null,
    }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json().catch(() => ({}));

    if (body.action === 'upcoming-albums') {
      const albums = await fetchUpcomingAlbums();
      return new Response(JSON.stringify({ albums }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    // Default: return token (backward compat)
    const token = await getToken();
    return new Response(JSON.stringify({ token }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
