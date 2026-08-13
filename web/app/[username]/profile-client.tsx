'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useProfile, useProfilePosts, useFollowState, useToggleFollow, useFollowCounts } from '@web/lib/feed';
import { useSession } from '@web/providers/session-provider';
import { FollowListSheet } from '@web/components/ui/follow-list-sheet';
import { ContentDetailModal } from '@web/components/ui/content-detail-modal';
import { useFriendsWithCompat, compatColor, compatLabel } from '@web/lib/follows';
import { useRatingIcon } from '@web/lib/rating-icon';
import { RatingIcons } from '@web/components/ui/rating-icons';

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', read: '📚', play: '🎮', listen: '🎵', podcast: '🎙️', tv: '📺',
};

const CAT_DEFS = [
  { type: 'all',     emoji: '🗂️', label: 'All'      },
  { type: 'read',    emoji: '📚', label: 'Books'    },
  { type: 'watch',   emoji: '🎬', label: 'Movies'   },
  { type: 'tv',      emoji: '📺', label: 'TV'       },
  { type: 'listen',  emoji: '🎵', label: 'Music'    },
  { type: 'play',    emoji: '🎮', label: 'Games'    },
  { type: 'podcast', emoji: '🎙️', label: 'Podcasts' },
] as const;

type CatType = typeof CAT_DEFS[number]['type'];
type SortType = 'recent' | 'rating' | 'alpha';

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <span style={{ fontSize: size, color: 'var(--trust)', letterSpacing: 0.5 }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span key={i} style={{ opacity: i < rating ? 1 : 0.2 }}>★</span>
      ))}
    </span>
  );
}

// ── Collection poster grid ────────────────────────────────────────────────────

type Post = {
  id: string;
  type: string;
  title: string;
  sub: string | null;
  poster: string | null;
  note: string | null;
  rating: number | null;
  created_at: string;
};

function CollectionGrid({ posts, iconStyle }: { posts: Post[]; iconStyle: import('@web/components/ui/rating-icons').RatingIconStyle }) {
  const [detail, setDetail] = useState<Post | null>(null);

  return (
    <>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 8,
      }}>
        {posts.map((post) => (
          <button
            key={post.id}
            onClick={() => setDetail(post)}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', borderRadius: 10, overflow: 'hidden',
              position: 'relative', aspectRatio: '2/3',
              display: 'block', width: '100%',
            }}
            title={post.title}
          >
            {post.poster ? (
              <img
                src={post.poster}
                alt={post.title}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  borderRadius: 10, display: 'block',
                  border: '1px solid var(--border)',
                }}
              />
            ) : (
              <div style={{
                width: '100%', height: '100%', borderRadius: 10,
                background: 'var(--tlight)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 6, padding: 6, boxSizing: 'border-box',
              }}>
                <span style={{ fontSize: 22 }}>{TYPE_EMOJI[post.type] ?? '📌'}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2, textAlign: 'center', overflow: 'hidden' }}>
                  {post.title.length > 30 ? post.title.slice(0, 30) + '…' : post.title}
                </span>
              </div>
            )}
            {/* Rating overlay */}
            {post.rating != null && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'linear-gradient(transparent, rgba(0,0,0,0.72))',
                borderRadius: '0 0 10px 10px',
                padding: '14px 4px 5px',
                display: 'flex', justifyContent: 'center',
              }}>
                <RatingIcons rating={post.rating} iconStyle={iconStyle} size={9} color="#FFD700" />
              </div>
            )}
          </button>
        ))}
      </div>

      {detail && (
        <ContentDetailModal
          type={detail.type === 'tv' ? 'watch' : detail.type}
          title={detail.title}
          posterFallback={detail.poster}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

// ── Collection tab ────────────────────────────────────────────────────────────

function CollectionTab({ posts, isLoading, iconStyle }: { posts: Post[]; isLoading: boolean; iconStyle: import('@web/components/ui/rating-icons').RatingIconStyle }) {
  const [cat, setCat] = useState<CatType>('all');
  const [sort, setSort] = useState<SortType>('recent');
  const autoSelected = useRef(false);

  // Auto-select first non-empty category on load
  useEffect(() => {
    if (isLoading || autoSelected.current || posts.length === 0) return;
    autoSelected.current = true;
    const hasCurrent = posts.some((p) => p.type === cat || cat === 'all');
    if (!hasCurrent) {
      const first = CAT_DEFS.slice(1).find((c) => posts.some((p) => p.type === c.type));
      if (first) setCat(first.type);
    }
  }, [isLoading, posts]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: posts.length };
    for (const p of posts) { map[p.type] = (map[p.type] ?? 0) + 1; }
    return map;
  }, [posts]);

  const filtered = useMemo(() => {
    let items = cat === 'all' ? posts : posts.filter((p) => p.type === cat);
    items = [...items];
    if (sort === 'rating') items.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    else if (sort === 'alpha') items.sort((a, b) => a.title.localeCompare(b.title));
    else items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return items;
  }, [posts, cat, sort]);

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <div key={i} style={{ aspectRatio: '2/3', borderRadius: 10, background: 'var(--border)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Category chips */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {CAT_DEFS.filter((c) => c.type === 'all' || (counts[c.type] ?? 0) > 0).map((c) => {
          const active = cat === c.type;
          return (
            <button
              key={c.type}
              onClick={() => setCat(c.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 20,
                border: active ? 'none' : '1px solid var(--border)',
                background: active ? 'var(--trust)' : 'var(--card)',
                color: active ? '#fff' : 'var(--ink)',
                fontSize: 12, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
              <span style={{ opacity: active ? 0.8 : 0.5, fontSize: 11 }}>
                {c.type === 'all' ? counts.all : counts[c.type] ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sort row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600 }}>Sort</span>
        {(['recent', 'rating', 'alpha'] as SortType[]).map((s) => (
          <button
            key={s}
            onClick={() => setSort(s)}
            style={{
              padding: '4px 10px', borderRadius: 12,
              border: sort === s ? 'none' : '1px solid var(--border)',
              background: sort === s ? 'var(--tlight)' : 'transparent',
              color: sort === s ? 'var(--trust)' : 'var(--muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {s === 'recent' ? 'Recent' : s === 'rating' ? 'Rating' : 'A–Z'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: 13 }}>
          Nothing here yet.
        </div>
      ) : (
        <CollectionGrid posts={filtered} iconStyle={iconStyle} />
      )}
    </div>
  );
}

// ── Compatibility badge ───────────────────────────────────────────────────────

function CompatBadge({ profileId }: { profileId: string }) {
  const { friends } = useFriendsWithCompat();
  const entry = friends.find((f) => f.id === profileId);
  if (!entry) return null;
  const color = compatColor(entry.compatibility);
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      marginTop: 10, padding: '7px 14px', borderRadius: 20,
      background: `${color}15`, border: `1px solid ${color}30`,
    }}>
      <div style={{ width: 72, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${entry.compatibility}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 800, color }}>{entry.compatibility}%</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>taste match</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ProfileClient({ username }: { username: string }) {
  const { user } = useSession();
  const [tab, setTab] = useState<'posts' | 'collection'>('posts');
  const [followSheet, setFollowSheet] = useState<'followers' | 'following' | null>(null);
  const ratingIconStyle = useRatingIcon();

  const { data: profile, isLoading: loadingProfile, error } = useProfile(username);
  const { data: posts = [], isLoading: loadingPosts } = useProfilePosts(profile?.id);
  const { data: isFollowing } = useFollowState(profile?.id);
  const { data: counts } = useFollowCounts(profile?.id);
  const toggleFollow = useToggleFollow();

  const isOwnProfile = user?.id === profile?.id;

  if (loadingProfile) return <ProfileSkeleton />;

  if (error || !profile) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <h2 style={{ fontSize: 18, color: 'var(--ink)', margin: '0 0 8px' }}>User not found</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)' }}>@{username} doesn&apos;t exist.</p>
      </div>
    );
  }

  const initials = profile.full_name
    ? profile.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')
    : profile.username[0].toUpperCase();

  return (
    <div>
      {/* Profile header */}
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '28px 24px', marginBottom: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0 }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} width={72} height={72}
                style={{ borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--tlight)', color: 'var(--trust)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 700,
              }}>
                {initials}
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.3 }}>
                {profile.full_name ?? profile.username}
              </h1>
              {profile.verified_tier > 0 && <span style={{ fontSize: 14, color: 'var(--trust)' }}>✓</span>}
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginTop: 2 }}>@{profile.username}</div>

            {profile.bio && (
              <p style={{ fontSize: 14, color: 'var(--ink)', margin: '10px 0 0', lineHeight: 1.5, opacity: 0.85 }}>
                {profile.bio}
              </p>
            )}

            {/* Compatibility badge (friend-only) */}
            {user && !isOwnProfile && profile.id && (
              <CompatBadge profileId={profile.id} />
            )}

            {/* Actions */}
            {user && isOwnProfile && (
              <Link href="/settings" style={{
                display: 'inline-block', marginTop: 14,
                padding: '8px 22px', borderRadius: 20,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--ink)', fontSize: 14, fontWeight: 700, textDecoration: 'none',
              }}>
                Edit profile
              </Link>
            )}
            {user && !isOwnProfile && (
              <button
                onClick={() => toggleFollow.mutate({ targetId: profile.id, isFollowing: !!isFollowing })}
                disabled={toggleFollow.isPending}
                style={{
                  marginTop: 14, padding: '8px 22px', borderRadius: 20,
                  border: isFollowing ? '1px solid var(--border)' : 'none',
                  background: isFollowing ? 'transparent' : 'var(--trust)',
                  color: isFollowing ? 'var(--ink)' : '#fff',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'inherit', opacity: toggleFollow.isPending ? 0.6 : 1,
                }}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 24, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <Stat label="Posts" value={posts.length} loading={loadingPosts} />
          <StatButton label="Followers" value={counts?.followers ?? 0} onClick={() => setFollowSheet('followers')} />
          <StatButton label="Following" value={counts?.following ?? 0} onClick={() => setFollowSheet('following')} />
        </div>
      </div>

      {followSheet && profile && (
        <FollowListSheet userId={profile.id} type={followSheet} onClose={() => setFollowSheet(null)} />
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: 4 }}>
        {(['posts', 'collection'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '9px 0', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 13, fontWeight: 700,
              background: tab === t ? 'var(--trust)' : 'transparent',
              color: tab === t ? '#fff' : 'var(--muted)',
              transition: 'all 0.15s',
            }}
          >
            {t === 'posts' ? '📋 Posts' : '🗂️ Collection'}
          </button>
        ))}
      </div>

      {/* Posts tab */}
      {tab === 'posts' && (
        loadingPosts ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => <PostRowSkeleton key={i} />)}
          </div>
        ) : posts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--muted)', fontSize: 14 }}>
            No posts yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {posts.map((post: Post) => (
              <div key={post.id} style={{
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                {post.poster ? (
                  <img src={post.poster} alt={post.title} style={{ width: 42, height: 63, borderRadius: 6, objectFit: 'cover', border: '1px solid var(--border)', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 42, height: 63, borderRadius: 6, background: 'var(--tlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {TYPE_EMOJI[post.type] ?? '📌'}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{post.title}</div>
                  {post.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{post.sub}</div>}
                  {post.rating != null && <div style={{ marginTop: 4 }}><RatingIcons rating={post.rating} iconStyle={ratingIconStyle} size={11} /></div>}
                  {post.note && (
                    <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink)', opacity: 0.75, lineHeight: 1.4 }}>
                      {post.note.length > 120 ? post.note.slice(0, 120) + '…' : post.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Collection tab */}
      {tab === 'collection' && (
        <CollectionTab posts={posts} isLoading={loadingPosts} iconStyle={ratingIconStyle} />
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function Stat({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
        {loading ? '—' : value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 1 }}>{label}</div>
    </div>
  );
}

function StatButton({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: 'inherit' }}>
      <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 600, marginTop: 1 }}>{label}</div>
    </button>
  );
}

function ProfileSkeleton() {
  return (
    <div>
      <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 20, padding: '28px 24px', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--border)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 18, width: '45%', background: 'var(--border)', borderRadius: 8, marginBottom: 8 }} />
            <div style={{ height: 13, width: '30%', background: 'var(--border)', borderRadius: 6 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PostRowSkeleton() {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px', display: 'flex', gap: 12 }}>
      <div style={{ width: 42, height: 63, borderRadius: 6, background: 'var(--border)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 14, width: '60%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
        <div style={{ height: 12, width: '40%', background: 'var(--border)', borderRadius: 6 }} />
      </div>
    </div>
  );
}
