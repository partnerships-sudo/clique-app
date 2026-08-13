'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

interface BlockableUser {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  isBlocked: boolean;
  isMuted: boolean;
}

function useBlockableUsers(query: string) {
  const { user } = useSession();
  const q = query.trim();
  return useQuery({
    queryKey: ['web-blockable-users', user?.id, q],
    queryFn: async (): Promise<BlockableUser[]> => {
      let dbq = supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .neq('id', user!.id)
        .limit(60);
      if (q) dbq = dbq.or(`username.ilike.%${q}%,full_name.ilike.%${q}%`);
      else dbq = dbq.order('created_at', { ascending: false });
      const { data: profiles } = await dbq;

      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('target_id, is_blocked, is_muted')
        .eq('blocker_id', user!.id);
      const blockMap = new Map((blocks ?? []).map((b: any) => [b.target_id, b]));

      return (profiles ?? []).map((p: any) => {
        const b = blockMap.get(p.id);
        return { ...p, isBlocked: b?.is_blocked ?? false, isMuted: b?.is_muted ?? false };
      });
    },
    enabled: !!user,
    staleTime: 30_000,
  });
}

function useSetBlockMute() {
  const { user } = useSession();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ targetId, isBlocked, isMuted }: { targetId: string; isBlocked: boolean; isMuted: boolean }) => {
      if (!isBlocked && !isMuted) {
        await supabase.from('user_blocks').delete().eq('blocker_id', user!.id).eq('target_id', targetId);
      } else {
        await supabase.from('user_blocks').upsert(
          { blocker_id: user!.id, target_id: targetId, is_blocked: isBlocked, is_muted: isMuted },
          { onConflict: 'blocker_id,target_id' },
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['web-blockable-users', user?.id] }),
  });
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return <img src={avatarUrl} alt={name} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, background: 'var(--tlight)', color: 'var(--trust)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 }}>
      {initials}
    </div>
  );
}

function UserRow({ user: u, onAction }: { user: BlockableUser; onAction: (u: BlockableUser) => void }) {
  const name = u.full_name || u.username || 'Someone';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <Avatar name={name} avatarUrl={u.avatar_url} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
        {u.username && <div style={{ fontSize: 12, color: 'var(--muted)' }}>@{u.username}</div>}
        <div style={{ display: 'flex', gap: 6, marginTop: 3 }}>
          {u.isBlocked && <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#dc2626', borderRadius: 6, padding: '1px 6px' }}>Blocked</span>}
          {u.isMuted && <span style={{ fontSize: 10, fontWeight: 700, background: 'var(--tlight)', color: 'var(--trust)', borderRadius: 6, padding: '1px 6px' }}>Muted</span>}
        </div>
      </div>
      <button
        onClick={() => onAction(u)}
        style={{
          padding: '6px 14px', borderRadius: 10, border: '1px solid var(--border)',
          background: 'var(--paper)', color: 'var(--ink)', fontSize: 12, fontWeight: 700,
          cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
        }}
      >
        {u.isBlocked || u.isMuted ? 'Manage' : 'Block / Mute'}
      </button>
    </div>
  );
}

function ActionSheet({ user: u, onClose }: { user: BlockableUser; onClose: () => void }) {
  const setBlockMute = useSetBlockMute();
  const name = u.full_name || u.username || 'Someone';

  async function handle(isBlocked: boolean, isMuted: boolean) {
    await setBlockMute.mutateAsync({ targetId: u.id, isBlocked, isMuted });
    onClose();
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 460, background: 'var(--card)', borderRadius: '20px 20px 0 0', padding: '20px 20px 36px', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>{name}</div>
        {u.username && <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>@{u.username}</div>}
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          This is private — they won't be notified either way.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => handle(!u.isBlocked, u.isMuted)} style={sheetBtnStyle(u.isBlocked ? '#dc2626' : undefined)}>
            {u.isBlocked ? '✓ Unblock' : '🚫 Block'} {name}
          </button>
          <button onClick={() => handle(u.isBlocked, !u.isMuted)} style={sheetBtnStyle(u.isMuted ? 'var(--trust)' : undefined)}>
            {u.isMuted ? '✓ Unmute' : '🔇 Mute'} {name}
          </button>
          {(u.isBlocked || u.isMuted) && (
            <button onClick={() => handle(false, false)} style={sheetBtnStyle()}>Remove all restrictions</button>
          )}
          <button onClick={onClose} style={{ ...sheetBtnStyle(), color: 'var(--muted)', background: 'transparent', border: '1px solid var(--border)', marginTop: 4 }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function sheetBtnStyle(color?: string): React.CSSProperties {
  return {
    padding: '13px 16px', borderRadius: 12, border: 'none',
    background: color ? `${color}15` : 'var(--paper)',
    color: color ?? 'var(--ink)', fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
    border: `1px solid ${color ? `${color}30` : 'var(--border)'}` as any,
  };
}

export default function BlockedMutedPage() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<BlockableUser | null>(null);
  const { data: users = [], isLoading } = useBlockableUsers(query);

  // Show blocked/muted at top when no search
  const sorted = query.trim()
    ? users
    : [...users].sort((a, b) => Number(b.isBlocked || b.isMuted) - Number(a.isBlocked || a.isMuted));

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to manage blocked accounts.
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: -0.4 }}>Blocked & Muted</h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        Search for anyone to block or mute them. This is private — they won't be notified.
      </p>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all users…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '11px 14px 11px 38px',
            border: '1px solid var(--border)', borderRadius: 24,
            background: 'var(--card)', color: 'var(--ink)',
            fontSize: 14, fontFamily: 'inherit', outline: 'none',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: '45%', background: 'var(--border)', borderRadius: 5, marginBottom: 5 }} />
                <div style={{ height: 11, width: '30%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
          {query.trim() ? `No users found for "${query.trim()}".` : 'No other users yet.'}
        </div>
      ) : (
        <div>
          {sorted.map((u) => <UserRow key={u.id} user={u} onAction={setSelected} />)}
        </div>
      )}

      {selected && <ActionSheet user={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
