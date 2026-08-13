'use client';

import Link from 'next/link';
import { useSession } from '@web/providers/session-provider';
import { useFollowRequests, useAcceptFollowRequest, useDeclineFollowRequest, type FollowRequest } from '@web/lib/follows';

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function RequestRow({ req }: { req: FollowRequest }) {
  const accept = useAcceptFollowRequest();
  const decline = useDeclineFollowRequest();
  const isPending = accept.isPending || decline.isPending;
  const name = req.profile.full_name || req.profile.username || 'Someone';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0', borderBottom: '1px solid var(--border)',
    }}>
      <Link href={`/${req.profile.username}`} style={{ flexShrink: 0 }}>
        <Avatar name={name} avatarUrl={req.profile.avatar_url} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/${req.profile.username}`} style={{ textDecoration: 'none' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
          {req.profile.username && (
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>@{req.profile.username}</div>
          )}
        </Link>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={() => decline.mutate(req.followId)}
          disabled={isPending}
          style={{
            padding: '7px 14px', borderRadius: 10,
            border: '1px solid var(--border)',
            background: 'var(--paper)', color: 'var(--muted)',
            fontSize: 13, fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: isPending ? 0.5 : 1,
          }}
        >
          Decline
        </button>
        <button
          onClick={() => accept.mutate(req)}
          disabled={isPending}
          style={{
            padding: '7px 16px', borderRadius: 10,
            border: 'none',
            background: 'var(--trust)', color: '#fff',
            fontSize: 13, fontWeight: 700,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', opacity: isPending ? 0.5 : 1,
          }}
        >
          {accept.isPending ? 'Accepting…' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

export default function FollowRequestsPage() {
  const { user } = useSession();
  const { data: requests = [], isLoading } = useFollowRequests();

  if (!user) return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)', fontSize: 14 }}>
      <Link href="/login" style={{ color: 'var(--trust)' }}>Sign in</Link> to see follow requests.
    </div>
  );

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/friends" style={{ fontSize: 13, color: 'var(--trust)', fontWeight: 700, textDecoration: 'none' }}>
          ← Following
        </Link>
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: -0.4 }}>
        Follow Requests
      </h1>
      <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 20px', lineHeight: 1.6 }}>
        These people want to follow your private account. You choose who gets access.
      </p>

      {isLoading ? (
        <div>
          {[1,2,3].map((i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, width: '40%', background: 'var(--border)', borderRadius: 5, marginBottom: 5 }} />
                <div style={{ height: 11, width: '25%', background: 'var(--border)', borderRadius: 4 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ width: 70, height: 36, borderRadius: 10, background: 'var(--border)' }} />
                <div style={{ width: 76, height: 36, borderRadius: 10, background: 'var(--border)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '52px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 6 }}>All caught up</div>
          <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5 }}>No pending follow requests.</p>
        </div>
      ) : (
        <div>
          {requests.map((req) => <RequestRow key={req.followId} req={req} />)}
        </div>
      )}
    </div>
  );
}
