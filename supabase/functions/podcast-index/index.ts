const PODCAST_INDEX_KEY = Deno.env.get('PODCAST_INDEX_KEY')!;
const PODCAST_INDEX_SECRET = Deno.env.get('PODCAST_INDEX_SECRET')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function sha1Hex(msg: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(msg);
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function piHeaders() {
  const ts = Math.floor(Date.now() / 1000).toString();
  const hash = await sha1Hex(PODCAST_INDEX_KEY + PODCAST_INDEX_SECRET + ts);
  return {
    'X-Auth-Key': PODCAST_INDEX_KEY,
    'X-Auth-Date': ts,
    Authorization: hash,
    'User-Agent': 'Clique/1.0',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { action, query, id } = await req.json();
    const headers = await piHeaders();

    let url: string;
    if (action === 'byId') {
      url = `https://api.podcastindex.org/api/1.0/podcasts/byfeedid?id=${encodeURIComponent(id)}`;
    } else {
      // default: search by term
      url = `https://api.podcastindex.org/api/1.0/search/byterm?q=${encodeURIComponent(query)}&max=1`;
    }

    const res = await fetch(url, { headers });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
