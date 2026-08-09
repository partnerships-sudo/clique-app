// Runs on a schedule (every 5 min via pg_cron).
// Finds premieres that ended 28–35 minutes ago, checks which members
// haven't logged/rated the episode, and sends them a push nudge.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

Deno.serve(async () => {
  try {
    // Find premieres that ended between 28 and 35 minutes ago
    // (5-min window around the 30-min mark so no cron tick is missed)
    const now = new Date();
    const windowStart = new Date(now.getTime() - 35 * 60 * 1000).toISOString();
    const windowEnd   = new Date(now.getTime() - 28 * 60 * 1000).toISOString();

    const { data: premieres, error: premErr } = await supabase
      .from('premieres')
      .select('id, show_title, season_number, episode_number, episode_name, host_user_id')
      .eq('status', 'ended')
      .gte('ended_at', windowStart)
      .lte('ended_at', windowEnd);

    if (premErr) throw premErr;
    if (!premieres || premieres.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    let totalSent = 0;

    for (const premiere of premieres) {
      // Get all members except the host
      const { data: members } = await supabase
        .from('premiere_members')
        .select('user_id')
        .eq('premiere_id', premiere.id)
        .neq('user_id', premiere.host_user_id);

      if (!members || members.length === 0) continue;
      const memberIds = members.map((m: any) => m.user_id);

      // Check who has already logged this episode
      // Match on title + sub (e.g. "S3E20 · Reunion (2)")
      const episodeSub = `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`;
      const { data: alreadyLogged } = await supabase
        .from('library')
        .select('user_id')
        .eq('title', premiere.show_title)
        .eq('sub', episodeSub)
        .in('user_id', memberIds);

      const loggedIds = new Set((alreadyLogged ?? []).map((l: any) => l.user_id));
      const unratedIds = memberIds.filter((id: string) => !loggedIds.has(id));

      if (unratedIds.length === 0) continue;

      // Fetch push tokens for unrated members
      const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token')
        .in('user_id', unratedIds);

      if (!tokens || tokens.length === 0) continue;

      // Send push notifications
      const body = premiere.episode_name
        ? `${premiere.episode_name} — how was it?`
        : `S${premiere.season_number}E${premiere.episode_number} — how was it?`;

      const messages = tokens.map((t: any) => ({
        to: t.token,
        title: `Rate ${premiere.show_title} 🎬`,
        body,
        data: { type: 'watch_party_ended', premiereId: premiere.id },
        sound: 'default',
      }));

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      });

      totalSent += messages.length;
    }

    return new Response(JSON.stringify({ sent: totalSent }), { status: 200 });
  } catch (err) {
    console.error('notify-party-ended error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
