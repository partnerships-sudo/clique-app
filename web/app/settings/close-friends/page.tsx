'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from '@web/providers/session-provider';
import {
  useCloseFriendCandidates, useToggleCloseFriend,
  type CloseFriendCandidate,
} from '@web/lib/follows';

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function CloseFriendRow({ candidate, onToggle, disabled }: {
  candidate: CloseFriendCandidate;
  onToggle: () => void;
  disabled: boolean;
}) {
  const name = candidate.full_name || candidate.username || 'Someone';
  const active = candidate.isCloseFriend;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 13,
      padding: '11px 0', borderBottom: '1px solid var(--border)',
    }}>
      <Avatar name={name} avatarUrl={candidate.avatar_url} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
        {candidate.username && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>@{candidate.username}</div>
        )}
      </div>

      {/* iOS-style circle toggle */}
      <button
        onClick={onToggle}
        disabled={disabled}
        aria-label={active ? 'Remove from close friends' : 'Add to close friends'}
        style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          border: active ? 'none' : '2px solid var(--border)',
          background: active ? '#4CAF50' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s', opacity: disabled ? 0.5 : 1,
        }}
      >
        {active && (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7L5.5 10L11.5 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
    </div>
  );
}

export default function CloseFriendsPage() {
  const { user } = useSession();
  const [query, setQuery] = useState('');
  const { data: candidates, isLoading } = useCloseFriendCandidates(query);
  const toggle = useToggleCloseFriend();

  const closeFriendCount = candidates.filter((c) => c.isCloseFriend).length;

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to manage close friends.
    </div>
  );

  return (
    <div style={{ maxWidth: 520 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/settings" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Settings
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: -0.4 }}>
        Close Friends
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 6px', lineHeight: 1.6 }}>
        Tap the circle next to a mutual friend to add them. Posts set to <strong style={{ color: 'var(--ink)' }}>Close friends</strong> are only visible to this list.
      </p>
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 20px' }}>
        🔒 This is private — they won't be notified.
      </p>

      {/* Count badge */}
      {closeFriendCount > 0 && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', borderRadius: 20, marginBottom: 16,
          background: 'rgba(76,175,80,0.12)', border: '1px solid rgba(76,175,80,0.3)',
          fontSize: 12, fontWeight: 700, color: '#4CAF50',
        }}>
          ✓ {closeFriendCount} close friend{closeFriendCount !== 1 ? 's' : ''}
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your mutual friends…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 14px 10px 38px',
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
        <div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: '40%', background: 'var(--border)', borderRadius: 5, marginBottom: 5 }} />
                <div style={{ height: 11, width: '28%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--border)' }} />
            </div>
          ))}
        </div>
      ) : candidates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>
            {query.trim() ? `No results for "${query.trim()}"` : 'No mutual friends yet'}
          </div>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {query.trim()
              ? 'Try a different name.'
              : 'Follow someone back to add them here — close friends are mutual follows only.'}
          </p>
        </div>
      ) : (
        <div>
          {candidates.map((c) => (
            <CloseFriendRow
              key={c.id}
              candidate={c}
              disabled={toggle.isPending && (toggle.variables as any)?.friendId === c.id}
              onToggle={() => toggle.mutate({ friendId: c.id, isCloseFriend: c.isCloseFriend })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
