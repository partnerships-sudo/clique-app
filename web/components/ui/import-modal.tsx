'use client';

import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@web/lib/supabase/client';
import { useSession } from '@web/providers/session-provider';

const supabase = createClient();
const TMDB_KEY = process.env.NEXT_PUBLIC_TMDB_KEY!;

// ── CSV parser (ported from mobile) ──────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { fields.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}

function parseCSV(text: string) {
  const clean = text.startsWith('﻿') ? text.slice(1) : text;
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, '').trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function col(headers: string[], row: string[], ...names: string[]): string {
  for (const name of names) {
    const idx = headers.findIndex((h) => h.replace(/\s+/g, '') === name.replace(/\s+/g, ''));
    if (idx >= 0) return (row[idx] ?? '').replace(/^"|"$/g, '').trim();
  }
  return '';
}

interface ParsedRow {
  title: string; year: string; author: string;
  rating: number | null; note: string | null;
  watchedDate: string | null; status: 'finished' | 'reading' | 'watchlist';
}

function parseLetterboxd(text: string, filename: string): ParsedRow[] {
  if (text.startsWith('PK')) throw new Error('zip');
  const { headers, rows } = parseCSV(text);
  const titleCol = headers.includes('name') ? 'name' : 'title';
  const lowerName = filename.toLowerCase();
  const hasRating = headers.includes('rating') || headers.includes('rating10');
  const defaultStatus: ParsedRow['status'] = !hasRating && lowerName.includes('watchlist') ? 'watchlist' : 'finished';

  return rows.filter((r) => r.length > 1).map((row) => {
    const rRaw = col(headers, row, 'rating', 'rating10');
    const rNum = rRaw ? parseFloat(rRaw) : null;
    const rating = rNum === null ? null : Math.min(5, Math.max(0.5, rNum > 5 ? rNum / 2 : rNum));
    const watchedDate = col(headers, row, 'watched date', 'watcheddate', 'date') || null;
    const review = col(headers, row, 'review', 'text', 'body');
    const hasSpoilers = col(headers, row, 'contains spoilers', 'containsspoilers').toLowerCase() === 'yes';
    const note = review ? (hasSpoilers ? `[spoilers] ${review}` : review) : null;
    return {
      title: col(headers, row, titleCol), year: col(headers, row, 'year'),
      author: '', rating, note, watchedDate, status: defaultStatus,
    };
  }).filter((r) => r.title);
}

function parseGoodreads(text: string): ParsedRow[] {
  const { headers, rows } = parseCSV(text);
  return rows.filter((r) => r.length > 1).map((row) => {
    const rRaw = col(headers, row, 'my rating');
    const rating = rRaw && rRaw !== '0' ? Math.min(5, parseInt(rRaw, 10)) : null;
    const shelf = col(headers, row, 'exclusive shelf');
    const dateRead = col(headers, row, 'date read').replace(/\//g, '-') || null;
    const status: ParsedRow['status'] = shelf === 'read' ? 'finished' : shelf === 'currently-reading' ? 'reading' : 'watchlist';
    const review = col(headers, row, 'my review');
    return {
      title: col(headers, row, 'title'), year: col(headers, row, 'original publication year', 'year published'),
      author: col(headers, row, 'author'), rating, note: review || null,
      watchedDate: shelf === 'read' ? dateRead : null, status,
    };
  }).filter((r) => r.title);
}

// ── TMDB lookup (for Letterboxd) ──────────────────────────────────────────────

async function lookupTMDB(title: string, year: string): Promise<{ externalId: string; poster: string | null; sub: string; mediaType: string } | null> {
  try {
    const yearParam = year ? `&year=${year}` : '';
    const res = await fetch(
      `https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(title)}${yearParam}&include_adult=false`,
      { headers: { Authorization: `Bearer ${TMDB_KEY}` } },
    );
    const data = await res.json();
    const hit = (data.results ?? []).find((r: any) => r.media_type === 'movie' || r.media_type === 'tv');
    if (!hit) return null;
    const isTV = hit.media_type === 'tv';
    const hitYear = (hit.release_date || hit.first_air_date || '').slice(0, 4);
    const sub = isTV ? `TV Series${hitYear ? ` · ${hitYear}` : ''}` : `Film${hitYear ? ` · ${hitYear}` : ''}`;
    return { externalId: String(hit.id), poster: hit.poster_path ? `https://image.tmdb.org/t/p/w185${hit.poster_path}` : null, sub, mediaType: hit.media_type };
  } catch { return null; }
}

async function lookupBooks(title: string, author: string): Promise<{ externalId: string; poster: string | null; sub: string } | null> {
  try {
    const q = author ? `intitle:${encodeURIComponent(title)}+inauthor:${encodeURIComponent(author)}` : `intitle:${encodeURIComponent(title)}`;
    const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
    const data = await res.json();
    const item = data.items?.[0];
    if (!item) return null;
    const vi = item.volumeInfo;
    const authorStr = (vi.authors ?? []).slice(0, 2).join(', ');
    const year = vi.publishedDate?.slice(0, 4) ?? '';
    return {
      externalId: item.id,
      poster: vi.imageLinks?.thumbnail?.replace('http:', 'https:') ?? null,
      sub: [authorStr, year].filter(Boolean).join(' · '),
    };
  } catch { return null; }
}

// ── Component ─────────────────────────────────────────────────────────────────

type Source = 'letterboxd' | 'goodreads';
type Step = 'source' | 'file' | 'preview' | 'importing' | 'done';

interface ImportResult { imported: number; skipped: number; unmatched: number; }

interface Props { onClose: () => void; }

export function ImportModal({ onClose }: Props) {
  const { user } = useSession();
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>('source');
  const [source, setSource] = useState<Source | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleSourcePick(src: Source) {
    setSource(src);
    setStep('file');
    setTimeout(() => fileRef.current?.click(), 50);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.name.toLowerCase().endsWith('.zip')) {
      setError('Letterboxd exports a ZIP file. Unzip it first and pick one of the CSVs inside (diary.csv or ratings.csv works best).');
      return;
    }

    try {
      const text = await file.text();
      let rows: ParsedRow[] = [];
      if (source === 'letterboxd') rows = parseLetterboxd(text, file.name);
      else rows = parseGoodreads(text);

      if (!rows.length) {
        setError('No rows found. Make sure you\'re uploading the right CSV from your export.');
        return;
      }
      setFileName(file.name);
      setParsed(rows);
      setStep('preview');
    } catch (err: any) {
      if (err?.message === 'zip') {
        setError('This looks like a ZIP file. Unzip it and pick one of the CSVs inside.');
      } else {
        setError(`Could not read file: ${err?.message ?? 'Unknown error'}`);
      }
    }
    // Reset file input so same file can be picked again
    e.target.value = '';
  }

  async function runImport() {
    if (!user) return;
    cancelRef.current = false;
    setStep('importing');
    setProgress(0);

    let imported = 0; let skipped = 0; let unmatched = 0;
    const inserts: object[] = [];
    const isLetterboxd = source === 'letterboxd';
    const type = isLetterboxd ? 'watch' : 'read';

    // Fetch existing titles to skip dupes
    const { data: existing } = await supabase
      .from('library')
      .select('title')
      .eq('user_id', user.id)
      .eq('type', type);
    const existingTitles = new Set((existing ?? []).map((r: any) => r.title.toLowerCase()));

    for (let i = 0; i < parsed.length; i++) {
      if (cancelRef.current) break;
      setProgress(i / parsed.length);

      const row = parsed[i];
      if (existingTitles.has(row.title.toLowerCase())) { skipped++; continue; }

      let meta: { externalId?: string; poster?: string | null; sub?: string; mediaType?: string } = {};
      if (isLetterboxd) {
        const t = await lookupTMDB(row.title, row.year);
        if (t) meta = { externalId: t.externalId, poster: t.poster, sub: t.sub, mediaType: t.mediaType };
        else unmatched++;
      } else {
        const b = await lookupBooks(row.title, row.author);
        if (b) meta = { externalId: b.externalId, poster: b.poster, sub: b.sub };
        else {
          // Still import without match
          meta = { sub: row.author || undefined };
          unmatched++;
        }
      }

      inserts.push({
        user_id: user.id,
        type,
        title: row.title,
        sub: meta.sub ?? (row.author || null),
        poster: meta.poster ?? null,
        rating: row.rating,
        note: row.note,
        status: row.status === 'finished' ? 'logged' : 'watchlist',
        date: row.watchedDate,
        external_id: meta.externalId ?? null,
        media_type: (meta as any).mediaType ?? null,
      });
      imported++;

      // Batch insert every 25
      if (inserts.length >= 25) {
        await supabase.from('library').insert(inserts.splice(0, 25));
      }
    }

    // Insert remainder
    if (inserts.length > 0) await supabase.from('library').insert(inserts);

    qc.invalidateQueries({ queryKey: ['web-library'] });
    setResult({ imported, skipped, unmatched });
    setStep('done');
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 460,
        background: 'var(--card)', borderRadius: '20px 20px 0 0',
        padding: '20px 20px 36px',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 18px' }} />

        {/* Hidden file input */}
        <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={handleFile} />

        {/* ── Source picker ── */}
        {step === 'source' && (
          <>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginBottom: 6, letterSpacing: -0.3 }}>Import library</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Choose where to import from</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'letterboxd' as Source, emoji: '🎬', label: 'Letterboxd', sub: 'Import your diary, ratings, or watchlist CSV' },
                { id: 'goodreads' as Source, emoji: '📚', label: 'Goodreads', sub: 'Import your library export CSV' },
              ].map((s) => (
                <button key={s.id} onClick={() => handleSourcePick(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
                  borderRadius: 12, border: '1px solid var(--border)', background: 'var(--paper)',
                  cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, background: 'var(--tlight)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0,
                  }}>{s.emoji}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{s.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{s.sub}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--muted)' }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* ── File pick (transitional) ── */}
        {step === 'file' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Choose your CSV file</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 18 }}>
              {source === 'letterboxd'
                ? 'Export your data at letterboxd.com → Settings → Import & Export. Unzip the file and pick diary.csv or ratings.csv.'
                : 'Export your library at goodreads.com → My Books → Import and Export → Export Library.'}
            </div>
            {error && (
              <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#c0392b', marginBottom: 14, textAlign: 'left' }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <button onClick={() => fileRef.current?.click()} style={{
                background: 'var(--trust)', color: '#fff', border: 'none',
                borderRadius: 12, padding: '10px 22px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Choose CSV
              </button>
              <button onClick={() => setStep('source')} style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 12,
                padding: '10px 18px', fontSize: 14, color: 'var(--muted)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Back
              </button>
            </div>
          </div>
        )}

        {/* ── Preview ── */}
        {step === 'preview' && (
          <>
            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>Preview</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
              Found {parsed.length} items in <strong>{fileName}</strong>
            </div>

            {/* Sample rows */}
            <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 18 }}>
              {parsed.slice(0, 8).map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  borderBottom: i < 7 ? '1px solid var(--border)' : 'none',
                }}>
                  <span style={{ fontSize: 16 }}>{source === 'letterboxd' ? '🎬' : '📚'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      {row.title}
                    </div>
                    {row.author && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{row.author}</div>}
                  </div>
                  {row.rating && (
                    <span style={{ fontSize: 11, color: 'var(--trust)', flexShrink: 0 }}>
                      {'★'.repeat(row.rating)}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>
                    {row.status === 'watchlist' ? '🔖' : '✓'}
                  </span>
                </div>
              ))}
              {parsed.length > 8 && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
                  +{parsed.length - 8} more…
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Items will be looked up via TMDB or Google Books and added to your library. Duplicates are skipped.
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={runImport} style={{
                flex: 1, background: 'var(--trust)', color: '#fff', border: 'none',
                borderRadius: 12, padding: '12px 0', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Import {parsed.length} items
              </button>
              <button onClick={() => { setParsed([]); setStep('file'); }} style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 12,
                padding: '12px 16px', fontSize: 14, color: 'var(--muted)',
                cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Back
              </button>
            </div>
          </>
        )}

        {/* ── Importing ── */}
        {step === 'importing' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 14 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Importing…</div>
            <div style={{
              height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginBottom: 14,
            }}>
              <div style={{
                height: '100%', borderRadius: 3, background: 'var(--trust)',
                width: `${Math.round(progress * 100)}%`, transition: 'width 0.3s',
              }} />
            </div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>
              {Math.round(progress * parsed.length)} / {parsed.length} — looking up metadata…
            </div>
            <button onClick={() => { cancelRef.current = true; }} style={{
              marginTop: 18, background: 'none', border: '1px solid var(--border)', borderRadius: 10,
              padding: '8px 16px', fontSize: 13, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Cancel
            </button>
          </div>
        )}

        {/* ── Done ── */}
        {step === 'done' && result && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginBottom: 8 }}>Import complete!</div>
            <div style={{
              display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20,
            }}>
              {[
                { label: 'Imported', value: result.imported, color: 'var(--trust)' },
                { label: 'Skipped', value: result.skipped, color: 'var(--muted)' },
                { label: 'Unmatched', value: result.unmatched, color: 'var(--muted)' },
              ].map((s) => (
                <div key={s.label} style={{
                  flex: 1, background: 'var(--paper)', borderRadius: 12,
                  padding: '12px 0', textAlign: 'center',
                  border: '1px solid var(--border)',
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
            {result.unmatched > 0 && (
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
                {result.unmatched} items were imported without poster/metadata — titles may not have matched exactly.
              </div>
            )}
            <button onClick={onClose} style={{
              background: 'var(--trust)', color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
