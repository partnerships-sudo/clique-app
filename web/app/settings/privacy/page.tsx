'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

function usePrivacyProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-privacy-profile', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('is_private, show_online_status, show_read_receipts, verified_tier')
        .eq('id', user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });
}

function useUpdatePrivacy() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<{ is_private: boolean; show_online_status: boolean; show_read_receipts: boolean }>) => {
      const { error } = await supabase.from('profiles').update(patch).eq('id', user!.id);
      if (error) throw error;
    },
    onMutate: async (patch) => {
      const key = ['web-privacy-profile', user?.id];
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData(key);
      qc.setQueryData(key, (old: any) => ({ ...old, ...patch }));
      return { prev };
    },
    onError: (_e, _v, ctx: any) => {
      if (ctx?.prev) qc.setQueryData(['web-privacy-profile', user?.id], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['web-privacy-profile', user?.id] }),
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

export default function PrivacySettingsPage() {
  const { user } = useSession();
  const { data: profile, isLoading } = usePrivacyProfile();
  const update = useUpdatePrivacy();
  const tier = profile?.verified_tier ?? 0;

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to manage privacy settings.
    </div>
  );

  const rows = [
    {
      key: 'is_private' as const,
      icon: '🔒',
      label: 'Private account',
      sub: profile?.is_private
        ? 'Only approved followers can see your posts'
        : 'Anyone can see your posts and follow you instantly',
      value: profile?.is_private ?? false,
      locked: false,
    },
    {
      key: 'show_online_status' as const,
      icon: '👁',
      label: 'Online status',
      sub: "Let others see when you're active in the app",
      value: profile?.show_online_status ?? true,
      locked: false,
    },
    {
      key: 'show_read_receipts' as const,
      icon: '✓✓',
      label: 'Read receipts',
      sub: tier >= 2
        ? "Let others see when you've read their messages"
        : 'Power membership required',
      value: profile?.show_read_receipts ?? true,
      locked: tier < 2,
    },
  ];

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: -0.4 }}>Privacy</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 24px', lineHeight: 1.6 }}>
        Control who can see your content and how others interact with you.
      </p>

      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {isLoading
          ? [1, 2, 3].map((i) => (
              <div key={i} style={{ padding: '16px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 13, width: '40%', background: 'var(--border)', borderRadius: 5, marginBottom: 5 }} />
                  <div style={{ height: 11, width: '70%', background: 'var(--border)', borderRadius: 4 }} />
                </div>
                <div style={{ width: 46, height: 26, borderRadius: 13, background: 'var(--border)', flexShrink: 0 }} />
              </div>
            ))
          : rows.map((row, i) => (
              <div key={row.key} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '15px 18px',
                borderTop: i > 0 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: 'var(--tlight)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: row.icon === '✓✓' ? 11 : 16, fontWeight: 900,
                  color: 'var(--trust)',
                }}>
                  {row.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.45 }}>{row.sub}</div>
                </div>
                {row.locked ? (
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px',
                    borderRadius: 10, background: '#8B5CF620', color: '#8B5CF6',
                    flexShrink: 0,
                  }}>
                    Upgrade
                  </span>
                ) : (
                  <Toggle
                    value={row.value}
                    onChange={(v) => update.mutate({ [row.key]: v })}
                    disabled={update.isPending}
                  />
                )}
              </div>
            ))}
      </div>
    </div>
  );
}
