'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { FeedPost } from '@web/lib/feed';
import { usePostLikes, useToggleLike } from '@web/lib/feed';
import { useSession } from '@web/providers/session-provider';
import { CommentsSheet } from './comments-sheet';
import { ContentDetailModal } from './content-detail-modal';
import { createClient } from '@web/lib/supabase/client';
import { useWatchlistKeys, useToggleWatchlist } from '@web/lib/watchlist';
import { useRatingIcon } from '@web/lib/rating-icon';
import { RatingIcons } from './rating-icons';
import { RecommendModal } from './recommend-modal';

const supabase = createClient();

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬',
  read: '📚',
  play: '🎮',
  listen: '🎵',
  podcast: '🎙️',
};

const TYPE_LABEL: Record<string, string> = {
  watch: 'Watched',
  read: 'Read',
  play: 'Played',
  listen: 'Listened to',
  podcast: 'Listened to',
};

function StarRating({ rating }: { rating: number }) {
  return (
    <span style={{ fontSize: 12, letterSpacing: 1, color: 'var(--trust)' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < rating ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

function Avatar({ username, fullName, avatarUrl }: {
  username: string | null;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : (username?.[0]?.toUpperCase() ?? '?');

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={username ?? ''}
        width={36}
        height={36}
        style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }

  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%',
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700, flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

const menuItemStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '10px 14px',
  background: 'none', border: 'none', textAlign: 'left',
  fontSize: 13, fontWeight: 600, cursor: 'pointer',
  color: 'var(--ink)', fontFamily: 'inherit',
};

const editLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4,
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PostCard({ post, onDeleted }: { post: FeedPost; onDeleted?: (id: string) => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [showComments, setShowComments] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [showRecommend, setShowRecommend] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editNote, setEditNote] = useState(post.note ?? '');
  const [editRating, setEditRating] = useState<number | null>(post.rating);
  const [editVisibility, setEditVisibility] = useState(post.visibility ?? 'everyone');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwn = user?.id === post.user_id;

  const { data: likes } = usePostLikes(post.id, { count: post.likes_count, likedByMe: post.liked_by_me });
  const toggleLike = useToggleLike();
  const { data: watchlistKeys } = useWatchlistKeys();
  const ratingIconStyle = useRatingIcon();
  const toggleWatchlist = useToggleWatchlist();
  const watchlistKey = `${post.title}::${post.type}`;
  const watchlistId = watchlistKeys?.get(watchlistKey);

  // Close menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowMenu(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  function handleLike() {
    if (!user) return;
    toggleLike.mutate({ postId: post.id, isLiked: !!likes?.likedByMe });
  }

  async function handleSaveEdit() {
    setSaving(true);
    await supabase.from('posts').update({
      note: editNote.trim() || null,
      rating: editRating,
      visibility: editVisibility,
    }).eq('id', post.id);
    setSaving(false);
    setEditing(false);
    qc.invalidateQueries({ queryKey: ['web-feed'] });
    qc.invalidateQueries({ queryKey: ['web-circles-feed'] });
    qc.invalidateQueries({ queryKey: ['web-lounge-feed'] });
  }

  async function handleDelete() {
    if (!confirm('Delete this post?')) return;
    setDeleting(true);
    await supabase.from('posts').delete().eq('id', post.id);
    qc.invalidateQueries({ queryKey: ['web-feed'] });
    qc.invalidateQueries({ queryKey: ['web-circles-feed'] });
    qc.invalidateQueries({ queryKey: ['web-lounge-feed'] });
    onDeleted?.(post.id);
    setDeleting(false);
  }

  if (deleting) return null;

  return (
    <article style={{
      background: 'var(--card)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <Link href={`/${post.username}`} style={{ flexShrink: 0 }}>
          <Avatar username={post.username} fullName={post.full_name} avatarUrl={post.avatar_url} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <Link
              href={`/${post.username}`}
              style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}
            >
              {post.full_name ?? post.username}
            </Link>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>
              {TYPE_LABEL[post.type] ?? 'Logged'}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>
            {timeAgo(post.created_at)}
          </div>
        </div>
        {isOwn ? (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMenu((v) => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 18, color: 'var(--muted)', padding: '2px 6px',
                borderRadius: 6, fontFamily: 'inherit',
              }}
              aria-label="Post options"
            >
              ···
            </button>
            {showMenu && (
              <div style={{
                position: 'absolute', right: 0, top: '110%', zIndex: 50,
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                minWidth: 130, overflow: 'hidden',
              }}>
                <button onClick={() => { setEditing(true); setShowMenu(false); }} style={menuItemStyle}>
                  ✏️ Edit
                </button>
                <button onClick={() => { setShowMenu(false); handleDelete(); }} style={{ ...menuItemStyle, color: 'var(--danger, #e84f4f)' }}>
                  🗑 Delete
                </button>
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 20 }}>{TYPE_EMOJI[post.type] ?? '📌'}</span>
        )}
      </div>

      {/* Content row: poster + info */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Poster — click opens detail modal */}
        <button
          onClick={() => setShowDetail(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
          title={`View details for ${post.title}`}
        >
          {post.poster ? (
            <img
              src={post.poster}
              alt={post.title}
              style={{
                width: 52, borderRadius: 8,
                aspectRatio: '2/3', objectFit: 'cover',
                flexShrink: 0, border: '1px solid var(--border)',
                display: 'block',
              }}
            />
          ) : (
            <div style={{
              width: 52, aspectRatio: '2/3', borderRadius: 8,
              background: 'var(--tlight)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22,
            }}>
              {TYPE_EMOJI[post.type] ?? '📌'}
            </div>
          )}
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <button
            onClick={() => setShowDetail(true)}
            style={{
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              textAlign: 'left', fontFamily: 'inherit', width: '100%',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
              {post.title}
            </div>
            {post.sub && (
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2 }}>{post.sub}</div>
            )}
          </button>
          {post.rating != null && (
            <div style={{ marginTop: 6 }}>
              <RatingIcons rating={post.rating} iconStyle={ratingIconStyle} size={12} />
            </div>
          )}
          {/* Link to full post */}
          <Link href={`/post/${post.id}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 11, color: 'var(--muted)', textDecoration: 'none' }}>
            View post ↗
          </Link>
        </div>
      </div>

      {/* Edit form (inline) */}
      {editing && (
        <div style={{
          background: 'var(--paper)', borderRadius: 10, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
          border: '1px solid var(--border)',
        }}>
          <div>
            <label style={editLabelStyle}>Note</label>
            <textarea
              value={editNote}
              onChange={(e) => setEditNote(e.target.value)}
              rows={3}
              placeholder="What did you think?"
              style={{
                width: '100%', padding: '9px 12px', fontSize: 14,
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--card)', color: 'var(--ink)',
                fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={editLabelStyle}>Rating</label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                {[1,2,3,4,5].map((n) => (
                  <button key={n} onClick={() => setEditRating(editRating === n ? null : n)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    fontSize: 20, opacity: editRating != null && n <= editRating ? 1 : 0.25,
                    transition: 'opacity 0.1s',
                  }}>★</button>
                ))}
              </div>
            </div>
            <div>
              <label style={editLabelStyle}>Visibility</label>
              <select
                value={editVisibility}
                onChange={(e) => setEditVisibility(e.target.value)}
                style={{
                  display: 'block', marginTop: 4, padding: '6px 10px',
                  border: '1px solid var(--border)', borderRadius: 8,
                  background: 'var(--card)', color: 'var(--ink)',
                  fontSize: 13, fontFamily: 'inherit', outline: 'none',
                }}
              >
                <option value="everyone">🌐 Everyone</option>
                <option value="close_friends">🔒 Close friends</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSaveEdit} disabled={saving} style={{
              background: 'var(--trust)', color: '#fff', border: 'none',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setEditing(false)} style={{
              background: 'none', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              cursor: 'pointer', fontFamily: 'inherit', color: 'var(--muted)',
            }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Note */}
      {!editing && post.note && (
        <p style={{
          margin: 0, fontSize: 14, color: 'var(--ink)',
          lineHeight: 1.55, opacity: 0.85,
        }}>
          {post.note}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingTop: 4, borderTop: '1px solid var(--border)' }}>
        <button
          onClick={handleLike}
          disabled={!user || toggleLike.isPending}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: user ? 'pointer' : 'default',
            fontSize: 13, fontWeight: 600, padding: 0,
            color: likes?.likedByMe ? 'var(--danger, #e84f4f)' : 'var(--muted)',
            transition: 'color 0.15s, transform 0.15s',
            transform: toggleLike.isPending ? 'scale(1.15)' : 'scale(1)',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 16 }}>{likes?.likedByMe ? '❤️' : '🤍'}</span>
          {likes && likes.count > 0 && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{likes.count}</span>
          )}
        </button>
        <button
          onClick={() => setShowComments(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, padding: 0,
            color: 'var(--muted)',
            fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 16 }}>💬</span>
          {post.comments_count > 0 && (
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{post.comments_count}</span>
          )}
        </button>
        {user && (
          <button
            onClick={() => setShowRecommend(true)}
            title="Recommend to a friend"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, padding: 0,
              color: 'var(--muted)', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: 16 }}>📨</span>
          </button>
        )}
        {user && !isOwn && (
          <button
            onClick={() => toggleWatchlist.mutate({
              item: { type: post.type, title: post.title, sub: post.sub, poster: post.poster },
              currentId: watchlistId,
            })}
            disabled={toggleWatchlist.isPending}
            title={watchlistId ? 'Remove from watchlist' : 'Save to watchlist'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: 600, padding: 0,
              color: watchlistId ? 'var(--trust)' : 'var(--muted)',
              fontFamily: 'inherit', marginLeft: 'auto',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 16 }}>{watchlistId ? '🔖' : '🏷️'}</span>
          </button>
        )}
      </div>

      {showComments && (
        <CommentsSheet postId={post.id} onClose={() => setShowComments(false)} />
      )}

      {showRecommend && (
        <RecommendModal
          type={post.type}
          title={post.title}
          sub={post.sub}
          poster={post.poster}
          mediaType={(post as any).media_type ?? null}
          onClose={() => setShowRecommend(false)}
        />
      )}
      {showDetail && (
        <ContentDetailModal
          type={post.type}
          title={post.title}
          externalId={(post as any).external_id ?? null}
          mediaType={(post as any).media_type ?? null}
          posterFallback={post.poster}
          onClose={() => setShowDetail(false)}
        />
      )}
    </article>
  );
}
