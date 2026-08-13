'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { searchContent, type SearchResult } from '@web/lib/search';

const supabase = createClient();

type LogType = 'watch' | 'read' | 'listen' | 'podcast';
type Step = 'type' | 'search' | 'details';

const TYPES: { id: LogType; label: string; emoji: string; placeholder: string }[] = [
  { id: 'watch', label: 'Watch', emoji: '🎬', placeholder: 'Search movies & TV...' },
  { id: 'read',  label: 'Read',  emoji: '📚', placeholder: 'Search books...' },
  { id: 'listen', label: 'Listen', emoji: '🎵', placeholder: 'Search albums...' },
  { id: 'podcast', label: 'Podcast', emoji: '🎙️', placeholder: 'Search podcasts...' },
];

export default function LogPage() {
  const router = useRouter();
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'search') setTimeout(() => inputRef.current?.focus(), 100);
  }, [step]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchContent(query, type);
        setResults(r);
      } finally {
        setSearching(false);
      }
    }, 350);
  }, [query, type]);

  async function handleSubmit() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();

      // Check prior log count for watch_count
      let priorQ = supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('type', type);
      if (selected.externalId) {
        priorQ = priorQ.eq('external_id', selected.externalId);
      } else {
        priorQ = priorQ.eq('title', selected.title);
      }
      const { count: priorCount } = await priorQ;
      const watch_count = (priorCount ?? 0) + 1;

      // Insert into library
      await supabase.from('library').insert({
        user_id: user.id,
        type,
        title: selected.title,
        sub: selected.sub ?? null,
        poster: selected.img ?? null,
        note: note.trim() || null,
        rating: rating ?? null,
        ext_rating: selected.rating ?? null,
        external_id: selected.externalId ?? null,
        media_type: selected.mediaType ?? null,
        status: 'logged',
        date: new Date().toISOString().slice(0, 10),
      });

      // Insert post
      await supabase.from('posts').insert({
        user_id: user.id,
        user_name: profile?.username ?? user.email?.split('@')[0] ?? '',
        type,
        title: selected.title,
        sub: selected.sub ?? null,
        poster: selected.img ?? null,
        note: note.trim() || null,
        rating: rating ?? null,
        ext_rating: selected.rating ?? null,
        external_id: selected.externalId ?? null,
        media_type: selected.mediaType ?? null,
        visibility,
        watch_count,
        is_spoiler: false,
        watched_with: [],
      });

      qc.invalidateQueries({ queryKey: ['web-feed'] });
      router.push('/feed');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      {/* Back / title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        {step !== 'type' && (
          <button
            onClick={() => {
              if (step === 'details') { setStep('search'); setSelected(null); }
              else { setStep('type'); setQuery(''); setResults([]); }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, padding: 0, color: 'var(--muted)' }}
          >
            ←
          </button>
        )}
        <h1 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0, letterSpacing: -0.4 }}>
          {step === 'type' ? 'Log something' : step === 'search' ? `Search ${TYPES.find(t => t.id === type)?.label}` : 'Add details'}
        </h1>
      </div>

      {/* Step: type picker */}
      {step === 'type' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setType(t.id); setStep('search'); }}
              style={{
                background: 'var(--card)',
                border: `2px solid ${type === t.id ? 'var(--trust)' : 'var(--border)'}`,
                borderRadius: 16,
                padding: '24px 20px',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                transition: 'border-color 0.15s',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: 32 }}>{t.emoji}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{t.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Step: search */}
      {step === 'search' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={TYPES.find(t => t.id === type)?.placeholder}
              style={{
                width: '100%', padding: '12px 16px',
                border: '1px solid var(--border)', borderRadius: 12,
                fontSize: 15, background: 'var(--card)', color: 'var(--ink)',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            {searching && (
              <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--muted)' }}>
                …
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {results.map((r, i) => (
              <button
                key={`${r.externalId}-${i}`}
                onClick={() => { setSelected(r); setStep('details'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: 'var(--card)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: '10px 14px',
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--trust)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                {r.img ? (
                  <img src={r.img} alt={r.title} style={{ width: 40, height: 60, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 60, borderRadius: 6, background: 'var(--tlight)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {TYPES.find(t => t.id === type)?.emoji}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>{r.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{r.sub}</div>
                  {r.rating && <div style={{ fontSize: 11, color: 'var(--trust)', marginTop: 3 }}>★ {r.rating}</div>}
                </div>
              </button>
            ))}
            {!searching && query.trim() && results.length === 0 && (
              <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 14, padding: '24px 0' }}>
                No results for &ldquo;{query}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}

      {/* Step: details */}
      {step === 'details' && selected && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Selected item preview */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 16px' }}>
            {selected.img && (
              <img src={selected.img} alt={selected.title} style={{ width: 52, borderRadius: 8, aspectRatio: '2/3', objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{selected.title}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>{selected.sub}</div>
            </div>
          </div>

          {/* Star rating */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Rating
            </label>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(rating === star ? null : star)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 32, padding: 2, lineHeight: 1,
                    color: rating != null && star <= rating ? 'var(--trust)' : 'var(--border)',
                    transition: 'color 0.1s',
                  }}
                >
                  ★
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Note <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you think?"
              rows={3}
              maxLength={500}
              style={{
                width: '100%', padding: '11px 14px',
                border: '1px solid var(--border)', borderRadius: 10,
                fontSize: 14, background: 'var(--card)', color: 'var(--ink)',
                fontFamily: 'inherit', outline: 'none', resize: 'vertical',
                boxSizing: 'border-box', lineHeight: 1.5,
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--trust)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* Visibility */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Visible to
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['everyone', 'close_friends'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setVisibility(v)}
                  style={{
                    padding: '8px 16px', borderRadius: 20,
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
            <p style={{ fontSize: 13, color: 'var(--danger)', margin: 0, padding: '8px 12px', background: 'rgba(232,79,79,0.08)', borderRadius: 8 }}>
              {error}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              background: 'var(--trust)', color: '#fff',
              border: 'none', borderRadius: 12, padding: '14px 0',
              fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.6 : 1, fontFamily: 'inherit', letterSpacing: 0.2,
            }}
          >
            {submitting ? 'Logging...' : 'Log it'}
          </button>
        </div>
      )}
    </div>
  );
}
