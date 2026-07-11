// Receives Supabase Database Webhook payloads (type/table/record/old_record)
// from triggers on direct_messages, group_chat_messages, messages, reactions,
// and follows, then pushes an Expo notification to the right recipient(s)
// using the service role key — bypassing RLS, since this runs server-side.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('NOTIFY_WEBHOOK_SECRET')!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type Category = 'messages' | 'friend_requests' | 'reactions' | 'recommendations' | 'daily_nudge' | 'rating_reminders';

// Rotated randomly so it doesn't feel like the same canned message every
// night — same title throughout since it's always from the app itself.
const NUDGE_BODIES = [
  'Hey, what you up to?',
  'Hey, what you doing?',
  'What you getting into tonight?',
  'Anything good to log tonight?',
  'What are you watching, reading, or playing?',
];

async function getName(userId: string): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('full_name, username')
    .eq('id', userId)
    .maybeSingle();
  return data?.full_name ?? data?.username ?? 'Someone';
}

async function isEnabled(userId: string, category: Category): Promise<boolean> {
  const { data } = await supabase
    .from('notification_settings')
    .select(category)
    .eq('user_id', userId)
    .maybeSingle();
  return data ? (data as Record<string, boolean>)[category] !== false : true;
}

async function pushTo(
  userId: string,
  category: Category,
  title: string,
  body: string,
  data: Record<string, unknown> = {},
) {
  if (!(await isEnabled(userId, category))) return;

  const { data: tokens } = await supabase.from('push_tokens').select('token').eq('user_id', userId);
  if (!tokens || tokens.length === 0) return;

  const messages = tokens.map((t) => ({ to: t.token, title, body, data, sound: 'default' }));
  await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return new Response('unauthorized', { status: 401 });
  }

  try {
    const payload = await req.json();
    const { type, table, record, old_record } = payload;

    switch (table) {
      case 'direct_messages': {
        const senderName = await getName(record.sender_id);
        let isRec = false;
        let recTitle: string | undefined;
        try {
          const parsed = JSON.parse(record.content);
          if (parsed?.__rec) {
            isRec = true;
            recTitle = parsed.title;
          }
        } catch {
          // plain text message, not a rec payload
        }
        await pushTo(
          record.recipient_id,
          isRec ? 'recommendations' : 'messages',
          isRec ? `${senderName} sent you a rec` : senderName,
          isRec ? (recTitle ?? 'Check it out!') : record.content,
          { type: 'dm', friendId: record.sender_id },
        );
        break;
      }

      case 'group_chat_messages': {
        const senderName = await getName(record.user_id);
        const { data: group } = await supabase
          .from('group_chats')
          .select('name')
          .eq('id', record.chat_id)
          .single();
        const { data: members } = await supabase
          .from('group_chat_members')
          .select('user_id')
          .eq('chat_id', record.chat_id);
        const recipients = (members ?? []).map((m) => m.user_id).filter((id) => id !== record.user_id);
        await Promise.all(
          recipients.map((id) =>
            pushTo(id, 'messages', `${senderName} in ${group?.name ?? 'Group Chat'}`, record.text, {
              type: 'group',
              groupId: record.chat_id,
            }),
          ),
        );
        break;
      }

      case 'messages': {
        const { data: participants } = await supabase
          .from('messages')
          .select('user_id')
          .eq('title', record.title);
        const recipients = [...new Set((participants ?? []).map((p) => p.user_id))].filter(
          (id) => id !== record.user_id,
        );
        await Promise.all(
          recipients.map((id) =>
            pushTo(id, 'messages', `${record.user_name} in "${record.title}"`, record.content, {
              type: 'chat',
              chatTitle: record.title,
            }),
          ),
        );
        break;
      }

      case 'reactions': {
        const { data: post } = await supabase
          .from('posts')
          .select('user_id, title')
          .eq('id', record.post_id)
          .single();
        if (post && post.user_id !== record.user_id) {
          await pushTo(
            post.user_id,
            'reactions',
            'New reaction',
            `${record.user_name} reacted to your post about ${post.title}`,
            { type: 'reaction', postId: record.post_id },
          );
        }
        break;
      }

      case 'daily_nudge': {
        const body = NUDGE_BODIES[Math.floor(Math.random() * NUDGE_BODIES.length)];
        await pushTo(record.user_id, 'daily_nudge', 'Clique', body, { type: 'daily_nudge' });
        break;
      }

      case 'rating_reminder': {
        const titles: Record<string, string[]> = {
          movie: [
            `How was ${record.post_title}? Drop a quick rating!`,
            `Finished ${record.post_title}? Rate it before it slips your mind!`,
          ],
          tv: [
            `How's ${record.post_title} going? Give it a rating!`,
            `Still watching ${record.post_title}? Let everyone know what you think!`,
            `${record.post_title} — rate it so your friends know if it's worth watching!`,
          ],
          play: [
            `How far are you into ${record.post_title}? Drop a rating!`,
            `Made some progress in ${record.post_title}? Log your thoughts!`,
            `${record.post_title} — worth it? Rate it for your friends!`,
          ],
        };
        const pool = titles[record.post_type as string] ?? titles.movie;
        const body = pool[Math.floor(Math.random() * pool.length)];
        await pushTo(record.user_id, 'rating_reminders', 'Rate it ⭐', body, {
          type: 'rating_reminder',
          postId: record.post_id,
        });
        break;
      }

      case 'follows': {
        if (type === 'INSERT' && record.status === 'pending') {
          const name = await getName(record.follower_id);
          await pushTo(record.followed_id, 'friend_requests', 'New follow request', `${name} wants to follow you`, {
            type: 'follow_request',
          });
        } else if (type === 'INSERT' && record.status === 'accepted') {
          const name = await getName(record.follower_id);
          await pushTo(record.followed_id, 'friend_requests', 'New follower', `${name} started following you`, {
            type: 'follow',
          });
        } else if (type === 'UPDATE' && record.status === 'accepted' && old_record?.status !== 'accepted') {
          const name = await getName(record.followed_id);
          await pushTo(
            record.follower_id,
            'friend_requests',
            'Follow request accepted',
            `${name} accepted your follow request`,
            { type: 'follow_accepted' },
          );
        }
        break;
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    // Never surface a 500 to the trigger — just log and move on.
    console.error('send-notification error', err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
