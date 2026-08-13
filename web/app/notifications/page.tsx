'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

type Notification = {
  id: string;
  type: 'follow' | 'comment';
  created_at: string;
  actor_id: string;
  actor_username: string | null;
  actor_full_name: string | null;
  actor_avatar: string | null;
  // for comment notifications
  post_id?: string;
  post_title?: string;
  comment_text?: string;
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}

function Avatar({ avatarUrl, fullName, username }: { avatarUrl: string | null; fullName: string | null; username: string | null }) {
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : (username?.[0] ?? '?').toUpperCase();

  if (avatarUrl) {
    return <img src={avatarUrl} alt={username ?? ''} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function NotifIcon({ type }: { type: string }) {
  const icons: Record<string, string> = { follow: '👤', comment: '💬' };
  return (
    <div style={{
      position: 'absolute', bottom: -2, right: -2,
      width: 18, height: 18, borderRadius: '50%',
      background: 'var(--card)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10,
    }}>
      {icons[type] ?? '🔔'}
    </div>
  );
}

export default function NotificationsPage() {
  const { user } = useSession();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['web-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [];

      // Get new followers
      const { data: follows } = await supabase
        .from('follows')
        .select('id, created_at, follower_id')
        .eq('following_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      // Get comments on the user's posts
      const { data: userPosts } = await supabase
        .from('posts')
        .select('id, title')
        .eq('user_id', user.id);

      const postIds = (userPosts ?? []).map((p: any) => p.id);
      const postMap = Object.fromEntries((userPosts ?? []).map((p: any) => [p.id, p.title]));

      const { data: comments } = postIds.length > 0
        ? await supabase
            .from('post_comments')
            .select('id, created_at, user_id, post_id, content')
            .in('post_id', postIds)
            .neq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(30)
        : { data: [] };

      // Gather actor IDs
      const actorIds = [
        ...(follows ?? []).map((f: any) => f.follower_id),
        ...(comments ?? []).map((c: any) => c.user_id),
      ];
      const uniqueActors = [...new Set(actorIds)];

      const { data: profiles } = uniqueActors.length > 0
        ? await supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .in('id', uniqueActors)
        : { data: [] };

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const followNotifs: Notification[] = (follows ?? []).map((f: any) => ({
        id: `follow-${f.id}`,
        type: 'follow' as const,
        created_at: f.created_at,
        actor_id: f.follower_id,
        actor_username: profileMap[f.follower_id]?.username ?? null,
        actor_full_name: profileMap[f.follower_id]?.full_name ?? null,
        actor_avatar: profileMap[f.follower_id]?.avatar_url ?? null,
      }));

      const commentNotifs: Notification[] = (comments ?? []).map((c: any) => ({
        id: `comment-${c.id}`,
        type: 'comment' as const,
        created_at: c.created_at,
        actor_id: c.user_id,
        actor_username: profileMap[c.user_id]?.username ?? null,
        actor_full_name: profileMap[c.user_id]?.full_name ?? null,
        actor_avatar: profileMap[c.user_id]?.avatar_url ?? null,
        post_id: c.post_id,
        post_title: postMap[c.post_id] ?? null,
        comment_text: c.content,
      }));

      return [...followNotifs, ...commentNotifs].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
        <h2 style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 8px' }}>Sign in to see notifications</h2>
        <Link href="/login" style={{
          display: 'inline-block', marginTop: 12,
          background: 'var(--trust)', color: '#fff',
          padding: '10px 24px', borderRadius: 20,
          fontSize: 14, fontWeight: 700,
        }}>Sign in</Link>
      </div>
    );
  }

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 20px', letterSpacing: -0.4 }}>
        Notifications
      </h1>

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 0', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: '60%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
                <div style={{ height: 11, width: '35%', background: 'var(--border)', borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && notifications.length === 0 && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <p style={{ fontSize: 15, color: 'var(--muted)' }}>No notifications yet.</p>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>When people follow you or comment on your posts, you'll see it here.</p>
        </div>
      )}

      {!isLoading && notifications.length > 0 && (
        <div>
          {notifications.map((n) => (
            <div key={n.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              {/* Avatar + icon badge */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <Link href={n.actor_username ? `/${n.actor_username}` : '#'}>
                  <Avatar
                    avatarUrl={n.actor_avatar}
                    fullName={n.actor_full_name}
                    username={n.actor_username}
                  />
                </Link>
                <NotifIcon type={n.type} />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.4 }}>
                  <Link
                    href={n.actor_username ? `/${n.actor_username}` : '#'}
                    style={{ fontWeight: 700 }}
                  >
                    {n.actor_full_name ?? n.actor_username ?? 'Someone'}
                  </Link>
                  {n.type === 'follow' && <span style={{ color: 'var(--muted)' }}> started following you</span>}
                  {n.type === 'comment' && (
                    <>
                      <span style={{ color: 'var(--muted)' }}> commented on </span>
                      <span style={{ fontWeight: 600 }}>{n.post_title ?? 'your post'}</span>
                    </>
                  )}
                </p>
                {n.type === 'comment' && n.comment_text && (
                  <p style={{
                    margin: '4px 0 0', fontSize: 13, color: 'var(--muted)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    "{n.comment_text.slice(0, 80)}{n.comment_text.length > 80 ? '…' : ''}"
                  </p>
                )}
              </div>

              {/* Time */}
              <div style={{ fontSize: 12, color: 'var(--muted)', flexShrink: 0 }}>
                {timeAgo(n.created_at)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
