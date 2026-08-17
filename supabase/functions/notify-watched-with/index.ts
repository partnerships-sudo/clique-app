// Called by the client immediately after a post with watchedWith friends is created.
// Looks up each friend's push tokens and sends an Expo push notification.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function isEnabled(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('notification_settings')
    .select('reactions')   // 'reactions' category covers social tagging
    .eq('user_id', userId)
    .maybeSingle();
  return data ? (data as Record<string, boolean>)['reactions'] !== false : true;
}

Deno.serve(async (req) => {
  try {
    const { friendIds, fromName, title, postType } = await req.json() as {
      friendIds: string[];
      fromName: string;
      title: string;
      postType: string;
    };

    if (!Array.isArray(friendIds) || friendIds.length === 0) {
      return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const typeLabel =
      postType === 'watch' || postType === 'tv' ? 'watched' :
      postType === 'read' ? 'read' :
      postType === 'listen' || postType === 'podcast' ? 'listened to' : 'played';

    const messages: object[] = [];

    for (const friendId of friendIds) {
      if (!(await isEnabled(friendId))) continue;

      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .eq('user_id', friendId);

      if (!tokens || tokens.length === 0) continue;

      for (const { token } of tokens) {
        messages.push({
          to: token,
          title: `${fromName} tagged you`,
          body: `${fromName} ${typeLabel} ${title} with you — log your review!`,
          data: { type: 'watched_with' },
          sound: 'default',
          ttl: 300,
        });
      }
    }

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: messages.length }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('notify-watched-with error', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
