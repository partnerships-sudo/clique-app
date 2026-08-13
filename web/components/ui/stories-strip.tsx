'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

interface StoryPost {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  title: string;
  sub: string | null;
  poster: string | null;
  type: string;
  rating: number | null;
  note: string | null;
  created_at: string;
}

interface StoryGroup {
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  posts: StoryPost[];
}

function useStoriesGroups() {
  return useQuery({
    queryKey: ['web-stories'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Close friend IDs
      const { data: cfRows } = await supabase
        .from('close_friends')
        .select('friend_id')
        .eq('user_id', user.id);

      const friendIds = [...(cfRows ?? []).map((r: any) => r.friend_id), user.id];

      // Last 48 hours
      const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
      const { data: posts } = await supabase
        .from('posts')
        .select('*')
        .in('user_id', friendIds)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(80);

      if (!posts?.length) return [];

      const userIds = [...new Set(posts.map((p: any) => p.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      const enriched: StoryPost[] = posts.map((p: any) => ({
        ...p,
        username: profileMap[p.user_id]?.username ?? null,
        full_name: profileMap[p.user_id]?.full_name ?? null,
        avatar_url: profileMap[p.user_id]?.avatar_url ?? null,
      }));

      // Group by user — own stories first
      const groups: Map<string, StoryGroup> = new Map();
      for (const post of enriched) {
        if (!groups.has(post.user_id)) {
          groups.set(post.user_id, {
            user_id: post.user_id,
            username: post.username,
            full_name: post.full_name,
            avatar_url: post.avatar_url,
            posts: [],
          });
        }
        groups.get(post.user_id)!.posts.push(post);
      }

      const sorted = [...groups.values()].sort((a, b) => {
        if (a.user_id === user.id) return -1;
        if (b.user_id === user.id) return 1;
        return 0;
      });
      return sorted;
    },
    staleTime: 60_000,
  });
}

// ── Fullscreen viewer ─────────────────────────────────────────────────────────
function StoryViewer({ groups, startGroupIdx, onClose }: {
  groups: StoryGroup[];
  startGroupIdx: number;
  onClose: () => void;
}) {
  const [groupIdx, setGroupIdx] = useState(startGroupIdx);
  const [postIdx, setPostIdx] = useState(0);

  const group = groups[groupIdx];
  const post = group?.posts[postIdx];
  if (!group || !post) { onClose(); return null; }

  const name = group.full_name || group.username || 'Someone';
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('');

  function next() {
    if (postIdx < group.posts.length - 1) {
      setPostIdx(postIdx + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(groupIdx + 1);
      setPostIdx(0);
    } else {
      onClose();
    }
  }

  function prev() {
    if (postIdx > 0) {
      setPostIdx(postIdx - 1);
    } else if (groupIdx > 0) {
      const prevGroup = groups[groupIdx - 1];
      setGroupIdx(groupIdx - 1);
      setPostIdx(prevGroup.posts.length - 1);
    }
  }

  function timeAgo(d: string) {
    const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 400, maxHeight: '90dvh',
          background: 'var(--card)', borderRadius: 20, overflow: 'hidden',
          display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        {/* Progress bars */}
        <div style={{ display: 'flex', gap: 3, padding: '12px 12px 0', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2 }}>
          {group.posts.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 2.5, borderRadius: 2,
              background: i < postIdx ? 'rgba(255,255,255,0.9)' : i === postIdx ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
            }} />
          ))}
        </div>

        {/* Poster / background */}
        <div style={{
          minHeight: 280, background: post.poster ? 'transparent' : 'var(--tlight)',
          position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {post.poster && (
            <img src={post.poster} alt={post.title} style={{ width: '100%', maxHeight: 340, objectFit: 'cover' }} />
          )}
          {/* Header overlay */}
          <div style={{
            position: 'absolute', top: 20, left: 14, right: 44,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {group.avatar_url ? (
              <img src={group.avatar_url} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid #fff', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--trust)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {initials}
              </div>
            )}
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>{name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{timeAgo(post.created_at)}</div>
            </div>
          </div>
          {/* Close */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 16, right: 12,
            background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: '50%',
            width: 28, height: 28, cursor: 'pointer', color: '#fff', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Content */}
        <div style={{ padding: '16px 18px 20px', display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3 }}>{post.title}</div>
          {post.sub && <div style={{ fontSize: 13, color: 'var(--muted)' }}>{post.sub}</div>}
          {post.rating != null && (
            <div style={{ fontSize: 14, color: 'var(--trust)' }}>
              {'★'.repeat(post.rating)}{'☆'.repeat(5 - post.rating)}
            </div>
          )}
          {post.note && (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.55, opacity: 0.85 }}>{post.note}</p>
          )}
        </div>

        {/* Tap zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 1 }}>
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={prev} />
          <div style={{ flex: 1, cursor: 'pointer' }} onClick={next} />
        </div>
      </div>
    </div>
  );
}

// ── Strip bubble ──────────────────────────────────────────────────────────────
function StoryBubble({ group, onClick }: { group: StoryGroup; onClick: () => void }) {
  const name = group.full_name || group.username || '?';
  const initials = name.split(' ').map((n: string) => n[0]).slice(0, 2).join('');
  const label = name.length > 9 ? name.slice(0, 8) + '…' : name;

  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      padding: 0, flexShrink: 0,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--trust)', padding: 2.5,
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {group.avatar_url ? (
            <img src={group.avatar_url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--trust)' }}>{initials}</span>
          )}
        </div>
      </div>
      <span style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>{label}</span>
    </button>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function StoriesStrip() {
  const { data: groups = [], isLoading } = useStoriesGroups();
  const [viewerGroup, setViewerGroup] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {[1,2,3].map((i) => (
          <div key={i} style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--border)' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: 'var(--border)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (!groups.length) return null;

  return (
    <>
      <div style={{
        display: 'flex', gap: 14, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 4,
        scrollbarWidth: 'none',
      }}>
        {groups.map((g, i) => (
          <StoryBubble key={g.user_id} group={g} onClick={() => setViewerGroup(i)} />
        ))}
      </div>
      {viewerGroup !== null && (
        <StoryViewer
          groups={groups}
          startGroupIdx={viewerGroup}
          onClose={() => setViewerGroup(null)}
        />
      )}
    </>
  );
}
