// Proxies Google Books so the API key stays server-side instead of shipping in
// the app bundle.
//
// Used as the fallback when Hardcover has no record of a book, to fill in
// description, rating, page count and categories.
//
// Client sends:  { title: "Demon Copperhead" }
//
// Set the secret before deploying:
//   supabase secrets set GOOGLE_BOOKS_KEY=...
const GOOGLE_BOOKS_KEY = Deno.env.get('GOOGLE_BOOKS_KEY')!;

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
    const title = String(body.title ?? '').trim();
    if (!title) return json({ error: 'Missing title' }, 400);

    const params = new URLSearchParams({
      q: title,
      maxResults: '1',
      key: GOOGLE_BOOKS_KEY,
    });

    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
    const data = await res.json();
    return json(data, res.ok ? 200 : res.status);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
