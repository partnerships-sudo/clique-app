const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const { q, pageSize, sortBy } = await req.json();

    const params = new URLSearchParams({
      apiKey: NEWSAPI_KEY,
      q,
      language: 'en',
      pageSize: String(pageSize ?? 20),
      sortBy: sortBy ?? 'publishedAt',
    });

    const res = await fetch(`https://newsapi.org/v2/everything?${params.toString()}`);
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
