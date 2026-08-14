const GUARDIAN_KEY = Deno.env.get('GUARDIAN_API_KEY')!;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  try {
    const body = await req.json();
    const params = new URLSearchParams({
      'api-key': GUARDIAN_KEY,
      'show-fields': 'thumbnail,trailText,byline',
      'page-size': String(body.pageSize ?? 20),
      'order-by': 'newest',
    });

    if (body.q)       params.set('q', body.q);
    if (body.section) params.set('section', body.section);
    if (body.tag)     params.set('tag', body.tag);

    const res = await fetch(`https://content.guardianapis.com/search?${params.toString()}`);
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
