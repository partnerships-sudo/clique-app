'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@web/lib/supabase/client';

const supabase = createClient();

type UserResult = {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
};

type PostResult = {
  id: string;
  title: string;
  type: string;
  poster: string | null;
  sub: string | null;
  user_id: string;
  username: string | null;
  full_name: string | null;
};

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', read: '📚', play: '🎮', listen: '🎵', podcast: '🎙️',
};

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (!query.trim()) { setUsers([]); setPosts([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const q = query.trim();
        const [usersRes, postsRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, username, full_name, avatar_url')
            .or(`username.ilike.%${q}%,full_name.ilike.%${q}%`)
            .limit(8),
          supabase
            .from('posts')
            .select('id, title, type, poster, sub, user_id, profiles!posts_user_id_fkey(username, full_name)')
            .ilike('title', `%${q}%`)
            .eq('visibility', 'everyone')
            .order('created_at', { ascending: false })
            .limit(12),
        ]);

        setUsers((usersRes.data ?? []) as UserResult[]);
        setPosts(
          ((postsRes.data ?? []) as any[]).map((p) => ({
            ...p,
            username: p.profiles?.username ?? null,
            full_name: p.profiles?.full_name ?? null,
          }))
        );
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [query]);

  const hasResults = users.length > 0 || posts.length > 0;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: '0 0 20px', letterSpacing: -0.4 }}>
        Discover
      </h1>

      {/* Search input */}
      <div style={{ position: 'relative', marginBottom: 28 }}>
        <span style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          fontSize: 16, pointerEvents: 'none', opacity: 0.4,
        }}>🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or titles..."
          style={{
            width: '100%', padding: '12px 16px 12px 40px',
            border: '1px solid var(--border)', borderRadius: 12,
            fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
            fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
        />
        {loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)' }}>
            …
          </span>
        )}
      </div>

      {/* Empty / no query state */}
      {!query.trim() && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
          Search for people or what they&apos;ve been watching, reading, and listening to.
        </div>
      )}

      {/* No results */}
      {query.trim() && !loading && !hasResults && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--muted)', fontSize: 14 }}>
          No results for &ldquo;{query}&rdquo;
        </div>
      )}

      {/* People */}
      {users.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 0 12px' }}>
            People
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map((u) => (
              <Link
                key={u.id}
                href={`/${u.username}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--trust)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <UserAvatar user={u} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                    {u.full_name ?? u.username}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>@{u.username}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Posts */}
      {posts.length > 0 && (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', margin: '0 0 12px' }}>
            Posts
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {posts.map((p) => (
              <div
                key={p.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '12px 14px',
                }}
              >
                {p.poster ? (
                  <img src={p.poster} alt={p.title} style={{ width: 36, height: 54, borderRadius: 5, objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 36, height: 54, borderRadius: 5, background: 'var(--tlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {TYPE_EMOJI[p.type] ?? '📌'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{p.title}</div>
                  {p.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{p.sub}</div>}
                  {p.username && (
                    <Link href={`/${p.username}`} style={{ fontSize: 12, color: 'var(--trust)', marginTop: 3, display: 'block' }}>
                      @{p.username}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UserAvatar({ user }: { user: UserResult }) {
  const initials = user.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : user.username[0].toUpperCase();

  if (user.avatar_url) {
    return <img src={user.avatar_url} alt={user.username} width={40} height={40} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 14, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}
