'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();

type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

function timeAgo(dateString: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function CommentAvatar({ username, fullName, avatarUrl }: { username: string | null; fullName: string | null; avatarUrl: string | null }) {
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : username?.[0]?.toUpperCase() ?? '?';
  if (avatarUrl) return <img src={avatarUrl} alt={username ?? ''} width={32} height={32} style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--tlight)', color: 'var(--trust)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
      {initials}
    </div>
  );
}

export function CommentsSheet({ postId, onClose }: { postId: string; onClose: () => void }) {
  const { user } = useSession();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Focus input
  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 150); }, []);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ['web-comments', postId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('post_comments')
        .select('*, profiles!post_comments_user_id_fkey(username, full_name, avatar_url)')
        .eq('post_id', postId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as any[]).map((c) => ({
        ...c,
        username: c.profiles?.username ?? null,
        full_name: c.profiles?.full_name ?? null,
        avatar_url: c.profiles?.avatar_url ?? null,
      })) as Comment[];
    },
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        content,
        parent_id: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setText('');
      qc.invalidateQueries({ queryKey: ['web-comments', postId] });
      qc.invalidateQueries({ queryKey: ['web-feed'] });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || addComment.isPending) return;
    addComment.mutate(text.trim());
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 640,
        background: 'var(--card)', borderRadius: '20px 20px 0 0',
        zIndex: 201, display: 'flex', flexDirection: 'column',
        maxHeight: '75dvh',
        boxShadow: '0 -4px 40px rgba(0,0,0,0.15)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 12px', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
            Comments {comments.length > 0 && <span style={{ color: 'var(--muted)', fontWeight: 500 }}>({comments.length})</span>}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {isLoading && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>Loading…</div>
          )}
          {!isLoading && comments.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '32px 0' }}>
              No comments yet. Be the first!
            </div>
          )}
          {comments.map((c) => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CommentAvatar username={c.username} fullName={c.full_name} avatarUrl={c.avatar_url} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                    {c.full_name ?? c.username}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{timeAgo(c.created_at)}</span>
                </div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, opacity: 0.9 }}>{c.content}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        {user ? (
          <form
            onSubmit={handleSubmit}
            style={{ padding: '12px 16px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'flex-end' }}
          >
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              rows={1}
              maxLength={500}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
              style={{
                flex: 1, padding: '10px 14px',
                border: '1px solid var(--border)', borderRadius: 20,
                fontSize: 14, background: 'var(--card)', color: 'var(--ink)',
                fontFamily: 'inherit', outline: 'none', resize: 'none',
                lineHeight: 1.4,
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            <button
              type="submit"
              disabled={!text.trim() || addComment.isPending}
              style={{
                background: 'var(--trust)', color: '#fff',
                border: 'none', borderRadius: '50%',
                width: 38, height: 38, flexShrink: 0,
                fontSize: 16, cursor: !text.trim() || addComment.isPending ? 'not-allowed' : 'pointer',
                opacity: !text.trim() || addComment.isPending ? 0.4 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'opacity 0.15s',
              }}
            >
              ↑
            </button>
          </form>
        ) : (
          <div style={{ padding: '14px 20px 20px', textAlign: 'center', fontSize: 13, color: 'var(--muted)', borderTop: '1px solid var(--border)' }}>
            <a href="/login" style={{ color: 'var(--trust)', fontWeight: 600 }}>Sign in</a> to comment
          </div>
        )}
      </div>
    </>
  );
}
