'use client';

'use client';

import { useState } from 'react';
import { useFeed, useCirclesFeed, useLoungeFeed, useForYouFeed } from '@web/lib/feed';
import { PostCard } from '@web/components/ui/post-card';
import { StoriesStrip } from '@web/components/ui/stories-strip';
import { BecauseYouSection } from '@web/components/ui/because-you-section';
import type { FeedPost } from '@web/lib/feed';

type Tab = 'following' | 'circles' | 'lounge' | 'foryou';

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: 'following', label: 'Following', emoji: '👥' },
  { id: 'circles',   label: 'Circles',   emoji: '🔒' },
  { id: 'lounge',    label: 'Lounge',    emoji: '🌐' },
  { id: 'foryou',    label: 'For You',   emoji: '✨' },
];

export default function FeedPage() {
  const [tab, setTab] = useState<Tab>('following');

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <h1 style={{
        fontSize: 22, fontWeight: 900, color: 'var(--ink)',
        margin: '0 0 16px', letterSpacing: -0.4,
      }}>
        Feed
      </h1>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 6, marginBottom: 20,
        overflowX: 'auto', paddingBottom: 2,
      }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '7px 14px',
              borderRadius: 20,
              border: tab === t.id ? 'none' : '1px solid var(--border)',
              background: tab === t.id ? 'var(--trust)' : 'var(--card)',
              color: tab === t.id ? '#fff' : 'var(--sub)',
              fontSize: 13,
              fontWeight: tab === t.id ? 700 : 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'following' && <StoriesStrip />}
      {tab === 'following' && <FollowingTab />}
      {tab === 'circles'   && <CirclesTab />}
      {tab === 'lounge'    && <LoungeTab />}
      {tab === 'foryou'    && <ForYouTab />}
    </div>
  );
}

// ── Following ─────────────────────────────────────────────────────────────────
function FollowingTab() {
  const { data: posts, isLoading, error } = useFeed();
  return (
    <FeedView
      posts={posts}
      isLoading={isLoading}
      error={!!error}
      emptyIcon="👀"
      emptyTitle="Nothing here yet"
      emptyBody="Follow some friends to see what they're watching, reading, and playing."
    />
  );
}

// ── Circles ───────────────────────────────────────────────────────────────────
function CirclesTab() {
  const { data: posts, isLoading, error } = useCirclesFeed();
  return (
    <FeedView
      posts={posts}
      isLoading={isLoading}
      error={!!error}
      emptyIcon="🔒"
      emptyTitle="Your Circles are quiet"
      emptyBody="Posts shared with Close Friends only appear here. Add close friends and ask them to share their private posts."
    />
  );
}

// ── Lounge ────────────────────────────────────────────────────────────────────
function LoungeTab() {
  const { data: posts, isLoading, error } = useLoungeFeed();
  return (
    <FeedView
      posts={posts}
      isLoading={isLoading}
      error={!!error}
      emptyIcon="🌐"
      emptyTitle="The Lounge is empty"
      emptyBody="Public posts from everyone on Clique appear here. Be the first to share something."
    />
  );
}

// ── For You ───────────────────────────────────────────────────────────────────
function ForYouTab() {
  const { data: posts, isLoading, error } = useForYouFeed();
  return (
    <>
      {/* Because You Watched rows */}
      <BecauseYouSection />

      {/* Divider if there's content above */}
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 14 }}>
        Discover posts
      </div>

      <FeedView
        posts={posts}
        isLoading={isLoading}
        error={!!error}
        emptyIcon="✨"
        emptyTitle="Nothing to suggest yet"
        emptyBody="As more people join and post, personalised picks will show up here."
      />
    </>
  );
}

// ── Shared feed renderer ──────────────────────────────────────────────────────
function FeedView({
  posts,
  isLoading,
  error,
  emptyIcon,
  emptyTitle,
  emptyBody,
}: {
  posts: FeedPost[] | undefined;
  isLoading: boolean;
  error: boolean;
  emptyIcon: string;
  emptyTitle: string;
  emptyBody: string;
}) {
  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px' }}>
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>
          Failed to load. Try refreshing.
        </p>
      </div>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>{emptyIcon}</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>
          {emptyTitle}
        </h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 280, margin: '0 auto', lineHeight: 1.6 }}>
          {emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {posts.map((post) => (
        <PostCard key={post.id} post={post} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--border)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 13, width: '40%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 11, width: '25%', background: 'var(--border)', borderRadius: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 52, height: 78, borderRadius: 8, background: 'var(--border)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '70%', background: 'var(--border)', borderRadius: 6, marginBottom: 6 }} />
          <div style={{ height: 12, width: '45%', background: 'var(--border)', borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}
