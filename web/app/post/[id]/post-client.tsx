'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import { usePostLikes, useToggleLike } from '@web/lib/feed';

const supabase = createClient();

const TYPE_EMOJI: Record<string, string> = { watch: '🎬', read: '📚', play: '🎮', listen: '🎵', podcast: '🎙️' };
const TYPE_LABEL: Record<string, string> = { watch: 'Watched', read: 'Read', play: 'Played', listen: 'Listened to', podcast: 'Listened to' };

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`;
  const day = Math.floor(h / 24); if (day < 7) return `${day}d`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function Stars({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 18, letterSpacing: 2, color: 'var(--trust)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < rating ? 1 : 0.18 }}>★</span>
      ))}
    </span>
  );
}

export function PostClient({ id }: { id: string }) {
  const { user } = useSession();
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const { data: likes } = usePostLikes(id);
  const toggleLike = useToggleLike();

  function handleShare() {
    const url = `https://clique.app/post/${id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const { data: post, isLoading: loadingPost } = useQuery({
    queryKey: ['web-post', id],
    queryFn: async () => {
      const { data: p, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, full_name, avatar_url, verified_tier')
        .eq('id', p.user_id)
        .single();
      return { ...p, profile };
    },
  });

  const { data: comments = [], isLoading: loadingComments, refetch: refetchComments } = useQuery({
    queryKey: ['web-post-comments', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('id, content, created_at, user_id, profiles!post_comments_user_id_fkey(id, username, full_name, avatar_url)')
        .eq('post_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function submitComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !comment.trim()) return;
    setSubmitting(true);
    await supabase.from('post_comments').insert({ post_id: id, user_id: user.id, content: comment.trim() });
    setComment('');
    setSubmitting(false);
    refetchComments();
  }

  if (loadingPost) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ height: 24, width: '40%', background: 'var(--border)', borderRadius: 8 }} />
        <div style={{ height: 200, background: 'var(--border)', borderRadius: 16 }} />
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <h2 style={{ fontSize: 18, color: 'var(--ink)', margin: 0 }}>Post not found</h2>
      </div>
    );
  }

  const p = post.profile;
  const initials = p?.full_name
    ? p.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    : (p?.username?.[0]?.toUpperCase() ?? '?');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back link */}
      <Link href="/feed" style={{ fontSize: 13, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
        ← Back to feed
      </Link>

      {/* Post card */}
      <article style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, overflow: 'hidden',
      }}>
        {/* Poster banner */}
        {post.poster && (
          <div style={{ position: 'relative', height: 220, overflow: 'hidden', background: 'var(--border)' }}>
            <img
              src={post.poster}
              alt={post.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(32px) brightness(0.5)', transform: 'scale(1.1)' }}
            />
            <img
              src={post.poster}
              alt={post.title}
              style={{
                position: 'absolute', left: '50%', top: '50%',
                transform: 'translate(-50%, -50%)',
                height: 180, width: 'auto', borderRadius: 12,
                boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
                border: '2px solid rgba(255,255,255,0.15)',
              }}
            />
          </div>
        )}

        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Author row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href={p?.username ? `/${p.username}` : '#'}>
              {p?.avatar_url ? (
                <img src={p.avatar_url} alt={p.username} style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--tlight)', color: 'var(--trust)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {initials}
                </div>
              )}
            </Link>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Link href={p?.username ? `/${p.username}` : '#'} style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                  {p?.full_name ?? p?.username ?? 'Unknown'}
                </Link>
                {p?.verified_tier > 0 && <span style={{ fontSize: 12, color: 'var(--trust)' }}>✓</span>}
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>{TYPE_LABEL[post.type] ?? 'logged'}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{timeAgo(post.created_at)}</div>
            </div>
            <span style={{ fontSize: 22 }}>{TYPE_EMOJI[post.type] ?? '📌'}</span>
          </div>

          {/* Title + sub */}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4, lineHeight: 1.2 }}>
              {post.title}
            </h1>
            {post.sub && (
              <div style={{ fontSize: 15, color: 'var(--muted)', marginTop: 4 }}>{post.sub}</div>
            )}
          </div>

          {/* Rating */}
          {post.rating != null && <Stars rating={post.rating} />}

          {/* Note */}
          {post.note && (
            <p style={{
              margin: 0, fontSize: 16, color: 'var(--ink)', lineHeight: 1.65,
              opacity: 0.88, fontStyle: 'italic',
              borderLeft: '3px solid var(--trust)',
              paddingLeft: 14,
            }}>
              {post.note}
            </p>
          )}

          {/* Watch count */}
          {post.watch_count > 1 && (
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              Watched {post.watch_count}×
            </div>
          )}

          {/* Actions row */}
          <div style={{
            display: 'flex', gap: 12, alignItems: 'center',
            paddingTop: 16, borderTop: '1px solid var(--border)',
          }}>
            <button
              onClick={() => user && toggleLike.mutate({ postId: id, isLiked: !!likes?.likedByMe })}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: likes?.likedByMe ? 'rgba(232,79,79,0.08)' : 'var(--tlight)',
                border: 'none', borderRadius: 20,
                padding: '8px 16px', cursor: user ? 'pointer' : 'default',
                fontSize: 14, fontWeight: 700,
                color: likes?.likedByMe ? '#e84f4f' : 'var(--muted)',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{likes?.likedByMe ? '❤️' : '🤍'}</span>
              {likes && likes.count > 0 ? `${likes.count} like${likes.count !== 1 ? 's' : ''}` : 'Like'}
            </button>
            <button
              onClick={handleShare}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: copied ? 'rgba(16,185,129,0.08)' : 'var(--tlight)',
                border: 'none', borderRadius: 20,
                padding: '8px 16px', cursor: 'pointer',
                fontSize: 14, fontWeight: 700,
                color: copied ? '#10B981' : 'var(--muted)',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <span style={{ fontSize: 16 }}>{copied ? '✓' : '🔗'}</span>
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--ink)', margin: '0 0 14px', letterSpacing: -0.2 }}>
          {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'Comments'}
        </h2>

        {/* Comment input */}
        {user ? (
          <form onSubmit={submitComment} style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
            <input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment…"
              style={{
                flex: 1, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 10,
                background: 'var(--card)', color: 'var(--ink)',
                fontSize: 14, fontFamily: 'inherit', outline: 'none',
              }}
              onFocus={(e) => (e.target.style.borderColor = 'var(--trust)')}
              onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
            />
            <button
              type="submit"
              disabled={!comment.trim() || submitting}
              style={{
                padding: '10px 18px', borderRadius: 10,
                background: 'var(--trust)', color: '#fff',
                border: 'none', cursor: 'pointer',
                fontSize: 14, fontWeight: 700, fontFamily: 'inherit',
                opacity: !comment.trim() || submitting ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              Post
            </button>
          </form>
        ) : (
          <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
            <Link href="/login" style={{ color: 'var(--trust)', fontWeight: 700 }}>Sign in</Link> to comment.
          </p>
        )}

        {/* Comment list */}
        {loadingComments ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ display: 'flex', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, width: '30%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
                  <div style={{ height: 12, width: '70%', background: 'var(--border)', borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 14 }}>
            No comments yet. Be the first!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {comments.map((c: any) => {
              const cp = c.profiles;
              const ci = cp?.full_name
                ? cp.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
                : (cp?.username?.[0]?.toUpperCase() ?? '?');
              return (
                <div key={c.id} style={{
                  display: 'flex', gap: 10, padding: '14px 0',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <Link href={cp?.username ? `/${cp.username}` : '#'} style={{ flexShrink: 0 }}>
                    {cp?.avatar_url ? (
                      <img src={cp.avatar_url} alt={cp.username} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--tlight)', color: 'var(--trust)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {ci}
                      </div>
                    )}
                  </Link>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
                      <Link href={cp?.username ? `/${cp.username}` : '#'} style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                        {cp?.full_name ?? cp?.username ?? 'Unknown'}
                      </Link>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(c.created_at)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, opacity: 0.88 }}>
                      {c.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
