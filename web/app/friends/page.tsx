'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from '@web/providers/session-provider';
import { useFriendsWithCompat, useFollowRequests, compatColor, compatLabel, type FriendEntry } from '@web/lib/follows';

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 17, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function CompatBar({ score }: { score: number }) {
  const color = compatColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%', borderRadius: 3,
          background: color,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color, minWidth: 32, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
        {score}%
      </span>
      <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        {compatLabel(score)}
      </span>
    </div>
  );
}

function FriendCard({ friend }: { friend: FriendEntry }) {
  const name = friend.full_name || friend.username || 'Someone';
  return (
    <Link
      href={`/${friend.username}`}
      style={{ textDecoration: 'none', color: 'inherit' }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 0',
        borderBottom: '1px solid var(--border)',
        transition: 'opacity 0.12s',
      }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.75')}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
      >
        <Avatar name={name} avatarUrl={friend.avatar_url} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>{name}</div>
          {friend.username && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>@{friend.username}</div>
          )}
          <CompatBar score={friend.compatibility} />
        </div>
      </div>
    </Link>
  );
}

export default function FriendsPage() {
  const { user } = useSession();
  const { friends, isLoading } = useFriendsWithCompat();
  const { data: requests = [] } = useFollowRequests();
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? friends.filter((f) =>
        (f.full_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
        (f.username ?? '').toLowerCase().includes(query.toLowerCase())
      )
    : friends;

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to see your friends.
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>Following</h1>
          {!isLoading && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0' }}>
              {friends.length} {friends.length === 1 ? 'person' : 'people'} · sorted by taste match
            </p>
          )}
        </div>
        {requests.length > 0 && (
          <Link
            href="/friends/requests"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 20,
              background: 'var(--tlight)', color: 'var(--trust)',
              fontSize: 13, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Requests
            <span style={{
              background: 'var(--trust)', color: '#fff',
              borderRadius: '50%', width: 20, height: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {requests.length}
            </span>
          </Link>
        )}
      </div>

      {/* Search */}
      {(friends.length > 6 || query) && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', fontSize: 15, pointerEvents: 'none' }}>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
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
      )}

      {/* Compat legend */}
      {!isLoading && friends.length > 0 && (
        <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { color: '#E84F4F', label: '🔥 Soulmate  90+' },
            { color: '#5B4FE8', label: '✨ TV Twin  75+' },
            { color: '#4F9CE8', label: '👍 Curious  60+' },
            { color: '#9E9E9E', label: 'Fun Seeker' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              {label}
            </div>
          ))}
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, width: '40%', background: 'var(--border)', borderRadius: 5, marginBottom: 6 }} />
                <div style={{ height: 6, width: '70%', background: 'var(--border)', borderRadius: 3 }} />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 6, color: 'var(--ink)' }}>
            {friends.length === 0 ? 'Not following anyone yet' : `No results for "${query}"`}
          </div>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>
            {friends.length === 0
              ? 'Find people to follow in Search.'
              : 'Try a different name or username.'}
          </p>
        </div>
      ) : (
        <div>
          {filtered.map((friend) => <FriendCard key={friend.id} friend={friend} />)}
        </div>
      )}
    </div>
  );
}
