'use client';

import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { searchContent, type SearchResult } from '@web/lib/search';
import { useLogModal } from '@web/providers/log-modal-provider';

const supabase = createClient();

type LogType = 'watch' | 'read' | 'listen' | 'podcast';
type Step = 'type' | 'search' | 'details';

const TYPES: { id: LogType; label: string; emoji: string; placeholder: string }[] = [
  { id: 'watch',   label: 'Watch',   emoji: '🎬', placeholder: 'Search movies & TV...' },
  { id: 'read',    label: 'Read',    emoji: '📚', placeholder: 'Search books...' },
  { id: 'listen',  label: 'Listen',  emoji: '🎵', placeholder: 'Search albums...' },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', placeholder: 'Search podcasts...' },
];

export function LogModal() {
  const { isOpen, close } = useLogModal();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<LogType>('watch');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [visibility, setVisibility] = useState<'everyone' | 'close_friends'>('everyone');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep('type'); setType('watch'); setQuery(''); setResults([]);
      setSelected(null); setRating(null); setNote(''); setVisibility('everyone');
      setError(null); setDone(false); setSubmitting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'search') setTimeout(() => inputRef.current?.focus(), 80);
  }, [step]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchContent(query, type)); }
      finally { setSearching(false); }
    }, 350);
  }, [query, type]);

  // Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, close]);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single();

      let priorQ = supabase.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('type', type);
      if (selected.externalId) priorQ = priorQ.eq('external_id', selected.externalId);
      else priorQ = priorQ.eq('title', selected.title);
      const { count: priorCount } = await priorQ;
      const watch_count = (priorCount ?? 0) + 1;

      await supabase.from('library').insert({
        user_id: user.id, type,
        title: selected.title, sub: selected.sub ?? null,
        poster: selected.img ?? null, note: note.trim() || null,
        rating: rating ?? null, ext_rating: selected.rating ?? null,
        external_id: selected.externalId ?? null, media_type: selected.mediaType ?? null,
        status: 'logged', date: new Date().toISOString().slice(0, 10),
      });
      await supabase.from('posts').insert({
        user_id: user.id, user_name: profile?.username ?? '',
        type, title: selected.title, sub: selected.sub ?? null,
        poster: selected.img ?? null, note: note.trim() || null,
        rating: rating ?? null, ext_rating: selected.rating ?? null,
        external_id: selected.externalId ?? null, media_type: selected.mediaType ?? null,
        visibility, watch_count, is_spoiler: false, watched_with: [],
      });

      qc.invalidateQueries({ queryKey: ['web-feed'] });
      qc.invalidateQueries({ queryKey: ['web-library'] });
      setDone(true);
      setTimeout(() => close(), 1200);
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 301,
        transform: 'translate(-50%, -50%)',
        width: '100%', maxWidth: 540,
        background: 'var(--card)',
        borderRadius: 24,
        boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
        border: '1px solid var(--border)',
        maxHeight: '90dvh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px 16px',
          borderBottom: step !== 'type' ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step !== 'type' && (
              <button
                onClick={() => {
                  if (step === 'details') { setStep('search'); setSelected(null); }
                  else { setStep('type'); setQuery(''); setResults([]); }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0, color: 'var(--muted)', lineHeight: 1 }}
              >
                ←
              </button>
            )}
            <h2 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.3 }}>
              {step === 'type' ? 'Log something' : step === 'search' ? `Search ${TYPES.find(t => t.id === type)?.label}` : 'Add details'}
            </h2>
          </div>
          <button
            onClick={close}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--muted)', padding: 4, lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 24px 24px', overflowY: 'auto', flex: 1 }}>

          {/* ── Done state ── */}
          {done && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>Logged!</p>
            </div>
          )}

          {/* ── Step: type ── */}
          {!done && step === 'type' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setType(t.id); setStep('search'); }}
                  style={{
                    background: 'var(--paper)', border: `2px solid var(--border)`,
                    borderRadius: 14, padding: '20px 16px',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'flex-start', gap: 6, transition: 'border-color 0.15s',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--trust)')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >
                  <span style={{ fontSize: 28 }}>{t.emoji}</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{t.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* ── Step: search ── */}
          {!done && step === 'search' && (
            <div>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={TYPES.find(t => t.id === type)?.placeholder}
                  style={{
                    width: '100%', padding: '11px 16px',
                    border: '1px solid var(--border)', borderRadius: 10,
                    fontSize: 15, background: 'var(--paper)', color: 'var(--ink)',
                    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--trust)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
                {searching && (
                  <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)' }}>…</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {results.map((r, i) => (
                  <button
                    key={`${r.externalId}-${i}`}
                    onClick={() => { setSelected(r); setStep('details'); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: 'var(--paper)', border: '1px solid var(--border)',
                      borderRadius: 10, padding: '10px 14px',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--trust)')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {r.img ? (
                      <img src={r.img} alt={r.title} style={{ width: 36, height: 54, objectFit: 'cover', borderRadius: 5, flexShrink: 0 }} />
                    ) : (
                      <div style={{ width: 36, height: 54, borderRadius: 5, background: 'var(--tlight)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
                        {TYPES.find(t => t.id === type)?.emoji}
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{r.title}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.sub}</div>
                      {r.rating && <div style={{ fontSize: 11, color: 'var(--trust)', marginTop: 2 }}>★ {r.rating}</div>}
                    </div>
                  </button>
                ))}
                {!searching && query.trim() && results.length === 0 && (
                  <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '20px 0' }}>No results for "{query}"</p>
                )}
              </div>
            </div>
          )}

          {/* ── Step: details ── */}
          {!done && step === 'details' && selected && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Preview */}
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
                {selected.img && <img src={selected.img} alt={selected.title} style={{ width: 46, borderRadius: 6, aspectRatio: '2/3', objectFit: 'cover', flexShrink: 0 }} />}
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{selected.title}</div>
                  {selected.sub && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>{selected.sub}</div>}
                </div>
              </div>

              {/* Rating */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>Rating</label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(rating === star ? null : star)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 28, padding: 2, lineHeight: 1,
                        color: rating != null && star <= rating ? 'var(--trust)' : 'var(--border)',
                        transition: 'color 0.1s',
                      }}
                    >★</button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you think?"
                  rows={3}
                  maxLength={500}
                  style={{
                    width: '100%', padding: '10px 12px',
                    border: '1px solid var(--border)', borderRadius: 10,
                    fontSize: 14, background: 'var(--paper)', color: 'var(--ink)',
                    fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', lineHeight: 1.5,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--trust)')}
                  onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
                />
              </div>

              {/* Visibility */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--muted)', marginBottom: 6, letterSpacing: 0.5, textTransform: 'uppercase' }}>Visible to</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['everyone', 'close_friends'] as const).map((v) => (
                    <button
                      key={v}
                      onClick={() => setVisibility(v)}
                      style={{
                        padding: '7px 14px', borderRadius: 20,
                        border: `1px solid ${visibility === v ? 'var(--trust)' : 'var(--border)'}`,
                        background: visibility === v ? 'var(--tlight)' : 'transparent',
                        color: visibility === v ? 'var(--trust)' : 'var(--muted)',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.15s',
                      }}
                    >
                      {v === 'everyone' ? '🌍 Everyone' : '⭐ Close friends'}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, padding: '8px 12px', background: 'rgba(232,79,79,0.08)', borderRadius: 8 }}>{error}</p>
              )}

              <button
                onClick={handleSubmit}
                disabled={submitting}
                style={{
                  background: 'var(--trust)', color: '#fff',
                  border: 'none', borderRadius: 12, padding: '13px 0',
                  fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
                  opacity: submitting ? 0.6 : 1, fontFamily: 'inherit', letterSpacing: 0.2,
                }}
              >
                {submitting ? 'Logging...' : 'Log it'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
