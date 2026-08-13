'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';
import { useFriendsWithCompat, compatColor, compatLabel, type FriendEntry } from '@web/lib/follows';

const supabase = createClient();

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬', read: '📚', play: '🎮', listen: '🎵', podcast: '🎙️',
};

function Avatar({ name, avatarUrl, size = 40 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initials = name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
  if (avatarUrl) return (
    <img src={avatarUrl} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  );
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'var(--tlight)', color: 'var(--trust)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function useSendDm() {
  const { user } = useSession();
  return useMutation({
    mutationFn: async ({ friendId, content }: { friendId: string; content: string }) => {
      // Find or create DM thread
      const { data: existing } = await supabase
        .from('direct_messages')
        .select('id')
        .or(`and(user1_id.eq.${user!.id},user2_id.eq.${friendId}),and(user1_id.eq.${friendId},user2_id.eq.${user!.id})`)
        .maybeSingle();

      let threadId = existing?.id;
      if (!threadId) {
        const { data: created, error } = await supabase
          .from('direct_messages')
          .insert({ user1_id: user!.id, user2_id: friendId })
          .select('id')
          .single();
        if (error) throw error;
        threadId = created.id;
      }

      const { error } = await supabase
        .from('dm_messages')
        .insert({ dm_id: threadId, sender_id: user!.id, content });
      if (error) throw error;
    },
  });
}

export interface RecommendProps {
  type: string;
  title: string;
  sub?: string | null;
  poster?: string | null;
  extRating?: string | null;
  mediaType?: string | null;
  onClose: () => void;
}

export function RecommendModal({ type, title, sub, poster, extRating, mediaType, onClose }: RecommendProps) {
  const { user } = useSession();
  const { friends, isLoading } = useFriendsWithCompat();
  const sendDm = useSendDm();

  const [note, setNote] = useState('');
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter((f) =>
      (f.full_name ?? '').toLowerCase().includes(q) ||
      (f.username ?? '').toLowerCase().includes(q)
    );
  }, [friends, query]);

  async function handleSend(friend: FriendEntry) {
    if (sent.has(friend.id) || sending) return;
    setSending(friend.id);
    const payload = JSON.stringify({
      __rec: 1,
      title, type,
      sub: sub ?? undefined,
      poster: poster ?? undefined,
      note: note.trim() || undefined,
      extRating: extRating ?? undefined,
      compatScore: friend.compatibility,
      mediaType: mediaType ?? undefined,
    });
    try {
      await sendDm.mutateAsync({ friendId: friend.id, content: payload });
      setSent((prev) => new Set([...prev, friend.id]));
    } catch {
      // silent — user can retry
    } finally {
      setSending(null);
    }
  }

  const emoji = TYPE_EMOJI[type] ?? '🔗';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.55)', display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: '85dvh', display: 'flex', flexDirection: 'column',
          background: 'var(--card)', borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.25)',
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '12px auto 0', flexShrink: 0 }} />

        {/* Header */}
        <div style={{ padding: '14px 18px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {poster ? (
              <img src={poster} alt={title} style={{ width: 42, height: 63, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border)' }} />
            ) : (
              <div style={{ width: 42, height: 63, borderRadius: 6, background: 'var(--tlight)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {emoji}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 }}>
                Recommend
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)', lineHeight: 1.2, letterSpacing: -0.3 }}>{title}</div>
              {sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>}
            </div>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', padding: '4px 6px', borderRadius: 8, fontFamily: 'inherit', flexShrink: 0 }}
            >
              ✕
            </button>
          </div>

          {/* Note input */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note… (optional)"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px', fontSize: 13,
              border: '1px solid var(--border)', borderRadius: 10,
              background: 'var(--paper)', color: 'var(--ink)',
              fontFamily: 'inherit', resize: 'none', outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Search */}
        <div style={{ padding: '0 18px 10px', flexShrink: 0 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search friends…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 14px', fontSize: 13,
              border: '1px solid var(--border)', borderRadius: 20,
              background: 'var(--card)', color: 'var(--ink)',
              fontFamily: 'inherit', outline: 'none',
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
          />
        </div>

        {/* Friend list */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0 18px 24px' }}>
          {isLoading ? (
            [1,2,3].map((i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ height: 12, width: '50%', background: 'var(--border)', borderRadius: 4, marginBottom: 5 }} />
                  <div style={{ height: 10, width: '30%', background: 'var(--border)', borderRadius: 3 }} />
                </div>
                <div style={{ width: 56, height: 30, borderRadius: 8, background: 'var(--border)' }} />
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)', fontSize: 13 }}>
              {friends.length === 0 ? 'Follow people to recommend to them.' : `No friends match "${query}".`}
            </div>
          ) : (
            filtered.map((friend) => {
              const name = friend.full_name || friend.username || 'Someone';
              const isSent = sent.has(friend.id);
              const isSending = sending === friend.id;
              const color = compatColor(friend.compatibility);
              return (
                <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <Avatar name={name} avatarUrl={friend.avatar_url} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>{name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <div style={{
                        width: 48, height: 4, borderRadius: 2,
                        background: 'var(--border)', overflow: 'hidden',
                      }}>
                        <div style={{ width: `${friend.compatibility}%`, height: '100%', background: color, borderRadius: 2 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color }}>{friend.compatibility}%</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleSend(friend)}
                    disabled={isSent || isSending}
                    style={{
                      padding: '6px 14px', borderRadius: 10,
                      border: isSent ? '1px solid var(--trust)' : '1px solid var(--border)',
                      background: isSent ? 'var(--tlight)' : 'var(--paper)',
                      color: isSent ? 'var(--trust)' : 'var(--ink)',
                      fontSize: 12, fontWeight: 700,
                      cursor: isSent ? 'default' : 'pointer',
                      fontFamily: 'inherit', flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                  >
                    {isSending ? '…' : isSent ? '✓ Sent' : 'Send'}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
