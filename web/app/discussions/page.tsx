'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

interface Discussion {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  format: string;
  upvote_count: number;
  comment_count: number;
  image_url: string | null;
  content_title: string | null;
  content_poster: string | null;
  created_at: string;
  author_name: string;
  author_handle: string;
  author_avatar: string | null;
  has_voted: boolean;
}

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', tv: '📺', read: '📚', play: '🎮',
  listen: '🎵', podcast: '🎙️', general: '💬',
};

const FORMAT_LABEL: Record<string, string> = {
  discussion: 'Discussion', poll: 'Poll', hot_take: '🔥 Hot take',
};

function timeAgo(d: string) {
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function useDiscussions() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['web-discussions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('discussions')
        .select('*, discussion_votes(user_id, vote_type)')
        .order('created_at', { ascending: false })
        .limit(60);

      if (error) throw error;
      const rows = data ?? [];

      const userIds = [...new Set(rows.map((r: any) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profileMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

      return rows.map((row: any): Discussion => {
        const profile = profileMap[row.user_id];
        const votes: any[] = row.discussion_votes ?? [];
        const myVote = user ? votes.find((v: any) => v.user_id === user.id) : null;
        return {
          id: row.id,
          user_id: row.user_id,
          title: row.title,
          body: row.body,
          type: row.type ?? 'general',
          format: row.format ?? 'discussion',
          upvote_count: row.upvote_count ?? 0,
          comment_count: row.comment_count ?? 0,
          image_url: row.image_url,
          content_title: row.content_title,
          content_poster: row.content_poster,
          created_at: row.created_at,
          author_name: profile?.full_name || profile?.username || 'Someone',
          author_handle: profile?.username || '',
          author_avatar: profile?.avatar_url ?? null,
          has_voted: !!myVote && myVote.vote_type === 'upvote',
        };
      });
    },
    staleTime: 30_000,
  });
}

function useVote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ discussionId, hasVoted }: { discussionId: string; hasVoted: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (hasVoted) {
        await supabase.from('discussion_votes').delete()
          .eq('discussion_id', discussionId).eq('user_id', user.id);
        await supabase.from('discussions').update({ upvote_count: supabase.rpc as any })
          .eq('id', discussionId);
        // simpler: just invalidate
      } else {
        await supabase.from('discussion_votes').upsert(
          { discussion_id: discussionId, user_id: user.id, vote_type: 'upvote' },
          { onConflict: 'discussion_id,user_id' }
        );
      }
    },
    onMutate: async ({ discussionId, hasVoted }) => {
      await qc.cancelQueries({ queryKey: ['web-discussions'] });
      qc.setQueriesData<Discussion[]>({ queryKey: ['web-discussions'] }, (old) =>
        old?.map((d) =>
          d.id === discussionId
            ? { ...d, has_voted: !hasVoted, upvote_count: d.upvote_count + (hasVoted ? -1 : 1) }
            : d
        )
      );
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['web-discussions'] }),
  });
}

// ── Create discussion form ────────────────────────────────────────────────────
function CreateDiscussionForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [format, setFormat] = useState('discussion');
  const [type, setType] = useState('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !title.trim()) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('discussions').insert({
      user_id: user.id,
      title: title.trim(),
      body: body.trim() || null,
      format,
      type,
      upvote_count: 0,
      comment_count: 0,
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    qc.invalidateQueries({ queryKey: ['web-discussions'] });
    setTitle(''); setBody('');
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20,
    }}>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Start a discussion</div>

      <div style={{ display: 'flex', gap: 8 }}>
        <select value={format} onChange={(e) => setFormat(e.target.value)} style={selectStyle}>
          <option value="discussion">💬 Discussion</option>
          <option value="hot_take">🔥 Hot take</option>
          <option value="poll">📊 Poll</option>
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
          <option value="general">General</option>
          <option value="watch">Movies</option>
          <option value="tv">TV</option>
          <option value="read">Books</option>
          <option value="play">Games</option>
          <option value="listen">Music</option>
          <option value="podcast">Podcasts</option>
        </select>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's the question or topic?"
        required
        maxLength={200}
        style={{ ...inputStyle, fontSize: 15, fontWeight: 600 }}
        onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add more context (optional)"
        rows={2}
        maxLength={1000}
        style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
        onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
        onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
      />

      {error && <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0 }}>{error}</p>}

      <button type="submit" disabled={saving || !title.trim()} style={{
        alignSelf: 'flex-end', background: 'var(--trust)', color: '#fff',
        border: 'none', borderRadius: 10, padding: '9px 20px',
        fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
        opacity: saving || !title.trim() ? 0.5 : 1, fontFamily: 'inherit',
      }}>
        {saving ? 'Posting…' : 'Post'}
      </button>
    </form>
  );
}

// ── Discussion card ───────────────────────────────────────────────────────────
function DiscussionCard({ d }: { d: Discussion }) {
  const { user } = useSession();
  const vote = useVote();
  const initials = d.author_name.split(' ').map((n) => n[0]).slice(0, 2).join('');

  return (
    <article style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '14px 16px',
      display: 'flex', gap: 12,
    }}>
      {/* Vote column */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <button
          onClick={() => user && vote.mutate({ discussionId: d.id, hasVoted: d.has_voted })}
          disabled={!user}
          style={{
            background: 'none', border: 'none', cursor: user ? 'pointer' : 'default', padding: '4px 6px',
            fontSize: 18, lineHeight: 1,
            color: d.has_voted ? 'var(--trust)' : 'var(--muted)',
            transition: 'color 0.15s, transform 0.1s',
          }}
          aria-label="Upvote"
        >
          ▲
        </button>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
          {d.upvote_count}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Author */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {d.author_avatar ? (
            <img src={d.author_avatar} alt={d.author_name} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--tlight)', color: 'var(--trust)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
              {initials}
            </div>
          )}
          <Link href={`/${d.author_handle}`} style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            {d.author_name}
          </Link>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>·</span>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(d.created_at)}</span>
          <span style={{ fontSize: 12, marginLeft: 'auto', flexShrink: 0 }}>{TYPE_EMOJI[d.type] ?? '💬'}</span>
          {d.format !== 'discussion' && (
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
              background: d.format === 'hot_take' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
              color: d.format === 'hot_take' ? '#ef4444' : '#6366f1',
            }}>
              {FORMAT_LABEL[d.format]}
            </span>
          )}
        </div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.35, marginBottom: d.body ? 6 : 0 }}>
          {d.title}
        </div>

        {/* Body */}
        {d.body && (
          <p style={{ margin: '0 0 8px', fontSize: 13.5, color: 'var(--ink)', opacity: 0.8, lineHeight: 1.55 }}>
            {d.body}
          </p>
        )}

        {/* Content link */}
        {d.content_title && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            re: <em>{d.content_title}</em>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            💬 <span style={{ fontVariantNumeric: 'tabular-nums' }}>{d.comment_count}</span> comment{d.comment_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DiscussionsPage() {
  const { user } = useSession();
  const { data: discussions, isLoading, error } = useDiscussions();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div style={{ width: '100%', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>
          Discussions
        </h1>
        {user && (
          <button
            onClick={() => setShowCreate((v) => !v)}
            style={{
              background: 'var(--trust)', color: '#fff',
              border: 'none', borderRadius: 10, padding: '8px 14px',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {showCreate ? 'Cancel' : '+ New'}
          </button>
        )}
      </div>

      {showCreate && user && (
        <CreateDiscussionForm onCreated={() => setShowCreate(false)} />
      )}

      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1,2,3,4].map((i) => (
            <div key={i} style={{ height: 100, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14 }} />
          ))}
        </div>
      )}

      {error && (
        <p style={{ color: 'var(--danger)', fontSize: 14 }}>Failed to load discussions.</p>
      )}

      {!isLoading && !error && (!discussions || discussions.length === 0) && (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', margin: '0 0 8px' }}>No discussions yet</h2>
          <p style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 260, margin: '0 auto' }}>
            Be the first to start a conversation.
          </p>
        </div>
      )}

      {discussions && discussions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {discussions.map((d) => <DiscussionCard key={d.id} d={d} />)}
        </div>
      )}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid var(--border)', borderRadius: 8,
  fontSize: 14, background: 'var(--card)', color: 'var(--ink)',
  fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--card)', color: 'var(--ink)', fontSize: 13,
  fontFamily: 'inherit', outline: 'none', cursor: 'pointer',
};
