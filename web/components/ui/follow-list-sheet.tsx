'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useFollowList } from '@web/lib/feed';
import { useToggleFollow, useFollowState } from '@web/lib/feed';
import { useSession } from '@web/providers/session-provider';

type FollowListSheetProps = {
  userId: string;
  type: 'followers' | 'following';
  onClose: () => void;
};

type ProfileRow = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

function UserRow({ p, onClose }: { p: ProfileRow; onClose: () => void }) {
  const { user } = useSession();
  const { data: isFollowing } = useFollowState(p.id);
  const toggleFollow = useToggleFollow();
  const isMe = user?.id === p.id;
  const initials = p.full_name
    ? p.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : p.username[0].toUpperCase();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <Link href={`/${p.username}`} onClick={onClose} style={{ flexShrink: 0 }}>
        {p.avatar_url ? (
          <img src={p.avatar_url} alt={p.username} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            background: 'var(--tlight)', color: 'var(--trust)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700,
          }}>
            {initials}
          </div>
        )}
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/${p.username}`} onClick={onClose} style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', display: 'block' }}>
          {p.full_name ?? p.username}
        </Link>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>@{p.username}</div>
      </div>
      {user && !isMe && (
        <button
          onClick={() => toggleFollow.mutate({ targetId: p.id, isFollowing: !!isFollowing })}
          disabled={toggleFollow.isPending}
          style={{
            padding: '6px 14px', borderRadius: 16, flexShrink: 0,
            border: isFollowing ? '1px solid var(--border)' : 'none',
            background: isFollowing ? 'transparent' : 'var(--trust)',
            color: isFollowing ? 'var(--muted)' : '#fff',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', opacity: toggleFollow.isPending ? 0.6 : 1,
            transition: 'all 0.15s',
          }}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}
    </div>
  );
}

export function FollowListSheet({ userId, type, onClose }: FollowListSheetProps) {
  const { data: users = [], isLoading } = useFollowList(userId, type);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 201,
        background: 'var(--card)',
        borderRadius: '20px 20px 0 0',
        maxHeight: '80dvh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: 0 }}>
            {type === 'followers' ? 'Followers' : 'Following'}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 20, color: 'var(--muted)', padding: 4, lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '4px 20px 32px' }}>
          {isLoading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--border)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 13, width: '45%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
                    <div style={{ height: 11, width: '30%', background: 'var(--border)', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isLoading && users.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--muted)', fontSize: 14 }}>
              {type === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
            </div>
          )}

          {!isLoading && users.map((p: ProfileRow) => (
            <UserRow key={p.id} p={p} onClose={onClose} />
          ))}
        </div>
      </div>
    </>
  );
}
