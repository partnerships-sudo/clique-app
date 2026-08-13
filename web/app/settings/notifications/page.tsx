'use client';

import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

interface NotificationSettings {
  messages: boolean;
  friend_requests: boolean;
  reactions: boolean;
  recommendations: boolean;
  daily_nudge: boolean;
  rating_reminders: boolean;
  discussions: boolean;
}

const DEFAULTS: NotificationSettings = {
  messages: true, friend_requests: true, reactions: true,
  recommendations: true, daily_nudge: true, rating_reminders: true, discussions: true,
};

const ROWS: { key: keyof NotificationSettings; emoji: string; label: string; sub: string }[] = [
  { key: 'messages',         emoji: '💬', label: 'Messages',         sub: 'Direct messages, group chats, and content chats' },
  { key: 'friend_requests',  emoji: '👤', label: 'Followers',        sub: 'New followers and follow requests' },
  { key: 'reactions',        emoji: '❤️', label: 'Reactions',        sub: 'When someone reacts to your posts' },
  { key: 'recommendations',  emoji: '🎬', label: 'Recommendations',  sub: 'When a friend sends you a rec' },
  { key: 'discussions',      emoji: '🗣️', label: 'Discussions',      sub: 'Replies to your comments and new activity on discussions you joined' },
  { key: 'rating_reminders', emoji: '⭐', label: 'Rating reminders', sub: 'Nudges to rate movies, shows, and books after you log them' },
  { key: 'daily_nudge',      emoji: '🌙', label: 'Daily reminder',   sub: 'An evening nudge to log something' },
];

function useNotifSettings() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-notif-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_settings')
        .select('messages, friend_requests, reactions, recommendations, daily_nudge, rating_reminders, discussions')
        .eq('user_id', user!.id)
        .maybeSingle();
      return (data as NotificationSettings | null) ?? DEFAULTS;
    },
    enabled: !!user,
  });
}

function useUpdateNotif() {
  const { user } = useSession();
  const qc = useQueryClient();
  const key = ['web-notif-settings', user?.id];
  return useMutation({
    mutationFn: async (patch: Partial<NotificationSettings>) => {
      const current = qc.getQueryData<NotificationSettings>(key) ?? DEFAULTS;
      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: user!.id, ...current, ...patch });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => ({ ...old, ...patch }));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => !disabled && onChange(!value)}
      style={{
        width: 46, height: 26, borderRadius: 13, flexShrink: 0,
        background: value ? 'var(--trust)' : 'var(--border)',
        border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        position: 'relative', transition: 'background 0.2s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: value ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s',
      }} />
    </button>
  );
}

export default function NotificationsSettingsPage() {
  const { user } = useSession();
  const { data: settings, isLoading } = useNotifSettings();
  const update = useUpdateNotif();

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to manage notification settings.
    </div>
  );

  const current = settings ?? DEFAULTS;

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: -0.4 }}>Push Notifications</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Choose which activity sends you a notification. Changes save instantly.
      </p>

      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        {ROWS.map((row, i) => (
          <div key={row.key} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '15px 18px',
            borderTop: i > 0 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: 'var(--tlight)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
            }}>
              {row.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{row.label}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>{row.sub}</div>
            </div>
            {isLoading ? (
              <div style={{ width: 46, height: 26, borderRadius: 13, background: 'var(--border)', flexShrink: 0 }} />
            ) : (
              <Toggle
                value={current[row.key]}
                onChange={(v) => update.mutate({ [row.key]: v })}
                disabled={update.isPending}
              />
            )}
          </div>
        ))}
      </div>

      <p style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 14, lineHeight: 1.5 }}>
        Push notifications are delivered to devices where you're signed in to the Clique app.
        Web browser notifications are not yet supported.
      </p>
    </div>
  );
}
