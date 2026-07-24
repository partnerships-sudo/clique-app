import { createClient } from 'jsr:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@16';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return new Response('Unauthorized', { status: 401 });

  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', ''),
  );
  if (error || !user) return new Response('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('verified_tier')
    .eq('id', user.id)
    .single();

  if ((profile?.verified_tier ?? 0) >= 1) {
    return new Response(JSON.stringify({ error: 'Already verified' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const session = await stripe.identity.verificationSessions.create({
    type: 'document',
    metadata: { supabase_user_id: user.id },
    options: { document: { allowed_types: ['passport', 'driving_license', 'id_card'] } },
  });

  return new Response(JSON.stringify({ clientSecret: session.client_secret }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
