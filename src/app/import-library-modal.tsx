import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useLibraryItems } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const TMDB_KEY = process.env.EXPO_PUBLIC_TMDB_KEY!;
const HARDCOVER_TOKEN = process.env.EXPO_PUBLIC_HARDCOVER_TOKEN!;

type ImportSource = 'letterboxd' | 'goodreads';
type ImportStep = 'source' | 'preview' | 'importing' | 'done';

interface ParsedRow {
  title: string;
  year: string;
  author: string;
  rating: number | null;
  watchedDate: string | null;
  status: 'finished' | 'reading' | 'watchlist';
}

interface ImportResult {
  imported: number;
  skipped: number;
  unmatched: number;
}

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, '').trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function col(headers: string[], row: string[], name: string): string {
  const idx = headers.indexOf(name);
  return idx >= 0 ? (row[idx] ?? '').replace(/^"|"$/g, '').trim() : '';
}

// ── Source parsers ────────────────────────────────────────────────────────────

function parseLetterboxd(text: string): ParsedRow[] {
  const { headers, rows } = parseCSV(text);
  return rows
    .filter((r) => r.length > 1)
    .map((row) => {
      const ratingRaw = col(headers, row, 'rating') || col(headers, row, 'rating10');
      const ratingNum = ratingRaw ? parseFloat(ratingRaw) : null;
      // Letterboxd diary exports "Rating" as 0.5–5; our "Rating10" export is 0–10
      const rating = ratingNum === null ? null
        : ratingNum > 5 ? ratingNum / 2   // Rating10 column
        : ratingNum;                        // Rating column (already 0.5–5)
      const watchedDate = col(headers, row, 'watched date') || col(headers, row, 'watcheddate') || col(headers, row, 'date') || null;
      return {
        title: col(headers, row, 'name'),
        year: col(headers, row, 'year'),
        author: '',
        rating: rating ? Math.min(5, Math.max(0.5, rating)) : null,
        watchedDate: watchedDate || null,
        status: 'finished' as const,
      };
    })
    .filter((r) => r.title);
}

function parseGoodreads(text: string): ParsedRow[] {
  const { headers, rows } = parseCSV(text);
  return rows
    .filter((r) => r.length > 1)
    .map((row) => {
      const ratingRaw = col(headers, row, 'my rating');
      const rating = ratingRaw && ratingRaw !== '0' ? Math.min(5, parseInt(ratingRaw, 10)) : null;
      const shelf = col(headers, row, 'exclusive shelf');
      const dateRead = col(headers, row, 'date read').replace(/\//g, '-') || null;
      const status: ParsedRow['status'] =
        shelf === 'read' ? 'finished'
        : shelf === 'currently-reading' ? 'reading'
        : 'watchlist';
      return {
        title: col(headers, row, 'title'),
        year: col(headers, row, 'original publication year') || col(headers, row, 'year published'),
        author: col(headers, row, 'author'),
        rating,
        watchedDate: shelf === 'read' ? dateRead : null,
        status,
      };
    })
    .filter((r) => r.title);
}

// ── API lookups ───────────────────────────────────────────────────────────────

async function lookupTMDB(title: string, year: string): Promise<{ externalId: string; poster: string | null; sub: string } | null> {
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
    const sub = isTV
      ? `TV Series${hitYear ? ` · ${hitYear}` : ''}`
      : `Film${hitYear ? ` · ${hitYear}` : ''}`;
    return {
      externalId: String(hit.id),
      poster: hit.poster_path ? `https://image.tmdb.org/t/p/w185${hit.poster_path}` : null,
      sub,
    };
  } catch { return null; }
}

async function lookupHardcover(title: string, author: string): Promise<{ externalId: string; poster: string | null; sub: string } | null> {
  try {
    const query = author ? `${title} ${author}` : title;
    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${HARDCOVER_TOKEN}` },
      body: JSON.stringify({
        query: `query Search($q: String!) { search(query: $q, query_type: "Book", per_page: 1, page: 1) { results } }`,
        variables: { q: query },
      }),
    });
    const json = await res.json();
    const hit = json.data?.search?.results?.hits?.[0]?.document;
    if (!hit) return null;
    const hitAuthor = hit.author_names?.[0] ?? '';
    const hitYear = hit.release_year ? ` · ${hit.release_year}` : '';
    return {
      externalId: String(hit.id),
      poster: hit.image?.url ?? null,
      sub: `${hitAuthor}${hitYear}`,
    };
  } catch { return null; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportLibraryModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { logged } = useLibraryItems();

  const [step, setStep] = useState<ImportStep>('source');
  const [source, setSource] = useState<ImportSource | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelledRef = useRef(false);

  // Build sets for dedup
  const existingExternalIds = useMemo(
    () => new Set(logged.map((i) => i.external_id).filter(Boolean)),
    [logged],
  );
  const existingTitles = useMemo(
    () => new Set(logged.map((i) => i.title.toLowerCase())),
    [logged],
  );

  const newRows = useMemo(
    () => parsed.filter((r) => !existingTitles.has(r.title.toLowerCase())),
    [parsed, existingTitles],
  );
  const alreadyOwned = parsed.length - newRows.length;

  async function pickFile(src: ImportSource) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const text = await FileSystem.readAsStringAsync(asset.uri);
      const rows = src === 'letterboxd' ? parseLetterboxd(text) : parseGoodreads(text);
      if (rows.length === 0) {
        Alert.alert('Nothing found', 'The file doesn\'t look like a valid Letterboxd or Goodreads export. Make sure you\'re uploading the diary/ratings CSV.');
        return;
      }
      setFileName(asset.name ?? 'file.csv');
      setParsed(rows);
      setStep('preview');
    } catch {
      Alert.alert('Could not read file', 'Please try again.');
    }
  }

  async function runImport() {
    if (!user) return;
    cancelledRef.current = false;
    setStep('importing');
    setProgress(0);

    const rows = newRows;
    let imported = 0;
    let skippedById = 0;
    let unmatched = 0;
    const inserts: object[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (cancelledRef.current) break;
      setProgress(i / rows.length);

      const row = rows[i];
      const lookup = source === 'letterboxd'
        ? await lookupTMDB(row.title, row.year)
        : await lookupHardcover(row.title, row.author);

      // Skip if we resolved an external_id that's already in the library
      if (lookup && existingExternalIds.has(lookup.externalId)) { skippedById++; continue; }

      if (!lookup) unmatched++;

      const type = source === 'letterboxd' ? 'watch' : 'read';
      const dateLabel = row.watchedDate
        ? new Date(row.watchedDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        : null;

      inserts.push({
        user_id: user.id,
        type,
        title: row.title,
        sub: lookup?.sub ?? (row.year || null),
        poster: lookup?.poster ?? null,
        external_id: lookup?.externalId ?? null,
        media_type: source === 'letterboxd' ? 'movie' : 'book',
        status: row.status,
        rating: row.rating,
        date: dateLabel,
        note: null,
      });
      imported++;

      // Small delay to avoid hammering APIs
      await new Promise((r) => setTimeout(r, 80));
    }

    if (inserts.length > 0) {
      // Insert in chunks of 50
      for (let i = 0; i < inserts.length; i += 50) {
        await supabase.from('library').insert(inserts.slice(i, i + 50));
      }
    }

    setResult({ imported, skipped: alreadyOwned + skippedById, unmatched });
    setProgress(1);
    setStep('done');
  }

  // ── Step: source ────────────────────────────────────────────────────────────
  if (step === 'source') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>Import Library</Text>
          <Text style={styles.sub}>Choose where you're importing from</Text>

          <View style={styles.card}>
            <Pressable
              style={styles.row}
              onPress={() => { setSource('letterboxd'); pickFile('letterboxd'); }}>
              <View style={styles.rowIcon}>
                <SymbolView name="film" size={18} tintColor={Brand.muted} type="monochrome" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Letterboxd</Text>
                <Text style={styles.rowSub}>Movies & TV you've logged — export from letterboxd.com/data</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            <View style={styles.divider} />

            <Pressable
              style={styles.row}
              onPress={() => { setSource('goodreads'); pickFile('goodreads'); }}>
              <View style={styles.rowIcon}>
                <SymbolView name="book" size={18} tintColor={Brand.muted} type="monochrome" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Goodreads</Text>
                <Text style={styles.rowSub}>Books you've read — export from goodreads.com/review/import</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          </View>

          <Text style={styles.note}>
            Export your data from the source app first, then come back here to choose the CSV file.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: preview ───────────────────────────────────────────────────────────
  if (step === 'preview') {
    const preview = newRows.slice(0, 5);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>Ready to Import</Text>
          <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{parsed.length}</Text>
              <Text style={styles.statLabel}>Found</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statNum}>{alreadyOwned}</Text>
              <Text style={styles.statLabel}>Already logged</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={[styles.stat]}>
              <Text style={[styles.statNum, { color: Brand.trust }]}>{newRows.length}</Text>
              <Text style={styles.statLabel}>To import</Text>
            </View>
          </View>

          {preview.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Preview</Text>
              <View style={styles.card}>
                <FlatList
                  data={preview}
                  keyExtractor={(_, i) => String(i)}
                  scrollEnabled={false}
                  renderItem={({ item, index }) => (
                    <View style={[styles.previewRow, index > 0 && styles.divider]}>
                      <View style={styles.previewDot} />
                      <View style={styles.previewBody}>
                        <Text style={styles.previewTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.previewSub}>
                          {[item.year, item.author, item.rating ? `${item.rating}★` : null].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </View>
                  )}
                />
                {newRows.length > 5 && (
                  <View style={[styles.previewRow, styles.divider]}>
                    <View style={styles.previewDot} />
                    <Text style={styles.previewMore}>+{newRows.length - 5} more</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <Text style={styles.note}>
            Clique will look up each title to get posters and metadata. This may take a minute for large imports.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={() => setStep('source')}>
            <Text style={styles.cancelBtnText}>Back</Text>
          </Pressable>
          <Pressable
            style={[styles.importBtn, newRows.length === 0 && styles.importBtnDisabled]}
            disabled={newRows.length === 0}
            onPress={runImport}>
            <Text style={styles.importBtnText}>Import {newRows.length} items</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: importing ─────────────────────────────────────────────────────────
  if (step === 'importing') {
    const pct = Math.round(progress * 100);
    const current = Math.round(progress * newRows.length);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.importingContainer}>
          <ActivityIndicator size="large" color={Brand.trust} style={{ marginBottom: 24 }} />
          <Text style={styles.importingTitle}>Importing your library…</Text>
          <Text style={styles.importingCount}>{current} of {newRows.length}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.importingSub}>Looking up posters and metadata</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: done ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.doneEmoji}>🎉</Text>
        <Text style={styles.title}>Import Complete</Text>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statNum, { color: Brand.trust }]}>{result?.imported ?? 0}</Text>
            <Text style={styles.statLabel}>Imported</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{result?.skipped ?? 0}</Text>
            <Text style={styles.statLabel}>Already had</Text>
          </View>
          {(result?.unmatched ?? 0) > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={styles.statNum}>{result?.unmatched}</Text>
                <Text style={styles.statLabel}>No match found</Text>
              </View>
            </>
          )}
        </View>

        {(result?.unmatched ?? 0) > 0 && (
          <Text style={styles.unmatchedNote}>
            Items without a match were still imported with your rating — they just won't have a poster until you log them manually.
          </Text>
        )}
      </View>

      <View style={styles.footer}>
        <Pressable style={styles.importBtn} onPress={() => router.back()}>
          <Text style={styles.importBtnText}>Done</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    container: { flex: 1, paddingHorizontal: Spacing.three, paddingTop: Spacing.four },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, marginBottom: 4 },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 13.5, color: Brand.muted, marginBottom: Spacing.four },
    fileName: { fontFamily: BrandFonts.interMedium, fontSize: 12.5, color: Brand.muted, marginBottom: Spacing.three },

    card: { backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1, borderColor: Brand.border, overflow: 'hidden', marginBottom: Spacing.three },
    row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.three, gap: 14 },
    rowIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
    rowBody: { flex: 1, minWidth: 0 },
    rowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink, marginBottom: 2 },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    chevron: { fontSize: 22, color: Brand.muted },
    divider: { height: 1, backgroundColor: Brand.border, marginLeft: Spacing.three },
    note: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, textAlign: 'center', paddingHorizontal: 10 },
    sectionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },

    statsRow: { flexDirection: 'row', backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1, borderColor: Brand.border, marginBottom: Spacing.three, padding: 16 },
    stat: { flex: 1, alignItems: 'center', gap: 2 },
    statNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink },
    statLabel: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, color: Brand.muted, textAlign: 'center' },
    statDivider: { width: 1, backgroundColor: Brand.border, marginHorizontal: 8 },

    previewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: Spacing.three },
    previewDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Brand.trust, flexShrink: 0 },
    previewBody: { flex: 1, minWidth: 0 },
    previewTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: Brand.ink },
    previewSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    previewMore: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, fontStyle: 'italic' },

    footer: { flexDirection: 'row', gap: 10, padding: Spacing.three, borderTopWidth: 1, borderTopColor: Brand.border, backgroundColor: Brand.paper },
    cancelBtn: { flex: 1, borderWidth: 1.5, borderColor: Brand.border, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    cancelBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    importBtn: { flex: 2, backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
    importBtnDisabled: { opacity: 0.4 },
    importBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },

    importingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
    importingTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, marginBottom: 6 },
    importingCount: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted, marginBottom: 20 },
    progressTrack: { width: '100%', height: 6, backgroundColor: Brand.border, borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
    progressFill: { height: '100%', backgroundColor: Brand.trust, borderRadius: 3 },
    importingSub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },

    doneEmoji: { fontSize: 48, textAlign: 'center', marginBottom: 12 },
    unmatchedNote: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, textAlign: 'center', marginTop: 12, paddingHorizontal: 10, lineHeight: 18 },
  });
}
