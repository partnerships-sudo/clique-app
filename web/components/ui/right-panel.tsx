'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import { useToggleFollow, useFollowState } from '@web/lib/feed';

const supabase = createClient();

type SuggestedUser = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

function Avatar({ user }: { user: SuggestedUser }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : user.username[0].toUpperCase();
  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.username} width={36} height={36} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--tlight)', color: 'var(--trust)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

function SuggestedRow({ user }: { user: SuggestedUser }) {
  const { data: isFollowing } = useFollowState(user.id);
  const toggleFollow = useToggleFollow();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Link href={`/${user.username}`} style={{ flexShrink: 0 }}>
        <Avatar user={user} />
      </Link>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Link href={`/${user.username}`} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {user.full_name ?? user.username}
        </Link>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>@{user.username}</div>
      </div>
      <button
        onClick={() => toggleFollow.mutate({ targetId: user.id, isFollowing: !!isFollowing })}
        disabled={toggleFollow.isPending}
        style={{
          padding: '5px 12px', borderRadius: 16, flexShrink: 0,
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
    </div>
  );
}

export function RightPanel() {
  const { user } = useSession();

  const { data: suggestions = [] } = useQuery({
    queryKey: ['web-suggestions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get who user already follows
      const { data: follows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      const followingIds = new Set((follows ?? []).map((f: any) => f.following_id));
      followingIds.add(user.id);

      // Get recent active users not already followed
      const { data } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .not('id', 'in', `(${[...followingIds].join(',')})`)
        .not('avatar_url', 'is', null)
        .limit(5);
      return (data ?? []) as SuggestedUser[];
    },
    enabled: !!user,
    staleTime: 120_000,
  });

  return (
    <aside style={{
      width: 280,
      flexShrink: 0,
      paddingTop: 24,
    }}>
      {/* Suggested people */}
      {suggestions.length > 0 && (
        <div style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '16px 18px',
          marginBottom: 16,
        }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 0 14px' }}>
            Who to follow
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {suggestions.map((u) => <SuggestedRow key={u.id} user={u} />)}
          </div>
        </div>
      )}

      {/* Footer links */}
      <div style={{ padding: '4px 4px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {['Privacy', 'Terms', 'About'].map((l) => (
          <span key={l} style={{ fontSize: 11, color: 'var(--muted)', cursor: 'default' }}>{l}</span>
        ))}
        <span style={{ fontSize: 11, color: 'var(--muted)' }}>© 2026 Clique</span>
      </div>
    </aside>
  );
}
