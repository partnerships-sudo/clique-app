import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import { useCollectionItems } from '@/features/collection/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { tmdbFetch } from '@/lib/tmdb';
const HARDCOVER_TOKEN = process.env.EXPO_PUBLIC_HARDCOVER_TOKEN!;

const TMDB_MOVIE_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance',
  878: 'Sci-Fi', 53: 'Thriller', 10752: 'War', 37: 'Western',
};
const TMDB_TV_GENRES: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

type ImportSource = 'letterboxd' | 'goodreads' | 'letterboxd-list';
type ImportStep = 'source' | 'preview' | 'importing' | 'done' | 'list-preview' | 'list-importing' | 'list-done';

interface ParsedRow {
  title: string;
  year: string;
  author: string;
  rating: number | null;
  note: string | null;
  watchedDate: string | null;
  status: 'finished' | 'reading' | 'watchlist';
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  unmatched: number;
}

interface ParsedListItem {
  position: number;
  title: string;
  year: string;
  description: string | null;
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
  // Strip UTF-8 BOM if present
  const clean = text.startsWith('﻿') ? text.slice(1) : text;
  const lines = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/['"]/g, '').trim());
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function col(headers: string[], row: string[], name: string): string {
  const idx = headers.indexOf(name);
  return idx >= 0 ? (row[idx] ?? '').replace(/^"|"$/g, '').trim() : '';
}

// ── Source parsers ────────────────────────────────────────────────────────────

function colFuzzy(headers: string[], row: string[], ...names: string[]): string {
  for (const name of names) {
    const idx = headers.findIndex((h) => h.replace(/\s+/g, '') === name.replace(/\s+/g, ''));
    if (idx >= 0) return (row[idx] ?? '').replace(/^"|"$/g, '').trim();
  }
  return '';
}

function parseLetterboxdFile(text: string, defaultStatus: ParsedRow['status']): ParsedRow[] {
  if (text.startsWith('PK')) throw new Error('zip');
  const { headers, rows } = parseCSV(text);
  const titleCol = headers.includes('name') ? 'name' : 'title';
  return rows
    .filter((r) => r.length > 1)
    .map((row) => {
      const ratingRaw = colFuzzy(headers, row, 'rating', 'rating10');
      const ratingNum = ratingRaw ? parseFloat(ratingRaw) : null;
      const rating = ratingNum === null ? null
        : ratingNum > 5 ? ratingNum / 2
        : ratingNum;
      const watchedDate = colFuzzy(headers, row, 'watched date', 'watcheddate', 'date') || null;
      const reviewRaw = colFuzzy(headers, row, 'review', 'text', 'body');
      const hasSpoilers = colFuzzy(headers, row, 'contains spoilers', 'containsspoilers').toLowerCase() === 'yes';
      const note = reviewRaw ? (hasSpoilers ? `[spoilers] ${reviewRaw}` : reviewRaw) : null;
      return {
        title: col(headers, row, titleCol),
        year: colFuzzy(headers, row, 'year'),
        author: '',
        rating: rating ? Math.min(5, Math.max(0.5, rating)) : null,
        note: note || null,
        watchedDate: watchedDate || null,
        status: defaultStatus,
      };
    })
    .filter((r) => r.title);
}

// Letterboxd exports: user may pick any one of ratings.csv, watched.csv, watchlist.csv, or diary.csv.
// We detect which file it is by the columns present and parse accordingly.
// Precedence when merging: rated entries win over unrated ones for the same title.
function parseLetterboxd(text: string, filename = ''): ParsedRow[] {
  if (text.startsWith('PK')) throw new Error('zip');
  const { headers } = parseCSV(text);
  const hasRating = headers.includes('rating') || headers.includes('rating10');
  const lowerName = filename.toLowerCase();

  // watchlist.csv and watched.csv have identical headers (Date, Name, Year, Letterboxd URI).
  // Distinguish by filename — watchlist.csv entries are to-watch, not finished.
  if (!hasRating) {
    const status = lowerName.includes('watchlist') ? 'watchlist' : 'finished';
    return parseLetterboxdFile(text, status);
  }
  // ratings.csv / diary.csv: has rating — all finished
  return parseLetterboxdFile(text, 'finished');
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
      const review = col(headers, row, 'my review');
      return {
        title: col(headers, row, 'title'),
        year: col(headers, row, 'original publication year') || col(headers, row, 'year published'),
        author: col(headers, row, 'author'),
        rating,
        note: review || null,
        watchedDate: shelf === 'read' ? dateRead : null,
        status,
      };
    })
    .filter((r) => r.title);
}

// ── Letterboxd list parser ────────────────────────────────────────────────────

function parseLetterboxdList(text: string): ParsedListItem[] {
  if (text.startsWith('PK')) throw new Error('zip');
  const { headers, rows } = parseCSV(text);
  return rows
    .filter((r) => r.length > 1)
    .map((row) => {
      const pos = parseInt(colFuzzy(headers, row, 'position') || '0', 10);
      const title = colFuzzy(headers, row, 'name', 'title');
      const year = colFuzzy(headers, row, 'year');
      const desc = colFuzzy(headers, row, 'description') || null;
      return { position: pos || 0, title, year, description: desc };
    })
    .filter((r) => r.title)
    .sort((a, b) => a.position - b.position);
}

function listNameFromFilename(filename: string): string {
  return filename
    .replace(/\.csv$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

// ── API lookups ───────────────────────────────────────────────────────────────

function tmdbTitleMatches(input: string, result: any): boolean {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const a = normalize(input);
  const b = normalize(result.title ?? result.name ?? '');
  return a === b || a.includes(b) || b.includes(a);
}

async function lookupTMDB(title: string, year: string): Promise<{ externalId: string; poster: string | null; sub: string; mediaType: string } | null> {
  try {
    const yearParam = year ? `&year=${year}` : '';
    const data = await tmdbFetch<any>(
      `search/multi?query=${encodeURIComponent(title)}${yearParam}&include_adult=false`,
    );
    const hit = (data.results ?? []).find(
      (r: any) => (r.media_type === 'movie' || r.media_type === 'tv') && tmdbTitleMatches(title, r),
    );
    if (!hit) return null;
    const isTV = hit.media_type === 'tv';
    const hitYear = (hit.release_date || hit.first_air_date || '').slice(0, 4);
    const genreMap = isTV ? TMDB_TV_GENRES : TMDB_MOVIE_GENRES;
    const genreNames = (hit.genre_ids ?? []).slice(0, 2).map((id: number) => genreMap[id]).filter(Boolean);
    const genrePart = genreNames.length ? ` · ${genreNames.join(' · ')}` : '';
    const sub = isTV
      ? `TV Series${hitYear ? ` · ${hitYear}` : ''}${genrePart}`
      : `Film${hitYear ? ` · ${hitYear}` : ''}${genrePart}`;
    return {
      externalId: String(hit.id),
      poster: hit.poster_path ? `https://image.tmdb.org/t/p/w185${hit.poster_path}` : null,
      sub,
      mediaType: hit.media_type,
    };
  } catch { return null; }
}

async function lookupHardcover(title: string, author: string): Promise<{ externalId: string; poster: string | null; sub: string; mediaType: string } | null> {
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
      mediaType: 'book',
    };
  } catch { return null; }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ImportLibraryModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const queryClient = useQueryClient();
  const { items: collectionItems } = useCollectionItems();

  const [step, setStep] = useState<ImportStep>('source');
  const [source, setSource] = useState<ImportSource | null>(null);
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const cancelledRef = useRef(false);

  // List import state
  const [listItems, setListItems] = useState<ParsedListItem[]>([]);
  const [listName, setListName] = useState('');
  const [listImported, setListImported] = useState(0);

  // Build lookup maps for dedup + update detection
  const existingByExternalId = useMemo(
    () => new Map(collectionItems.filter((i) => i.external_id).map((i) => [i.external_id!, i])),
    [collectionItems],
  );
  const existingByTitle = useMemo(
    () => new Map(collectionItems.map((i) => [i.title.toLowerCase(), i])),
    [collectionItems],
  );

  // Rows that are genuinely new (not in collection by title)
  const newRows = useMemo(
    () => parsed.filter((r) => !existingByTitle.has(r.title.toLowerCase())),
    [parsed, existingByTitle],
  );
  // Rows that exist already but carry a rating we can add
  const updateRows = useMemo(
    () => parsed.filter((r) => {
      const existing = existingByTitle.get(r.title.toLowerCase());
      if (!existing) return false;
      return existing.user_rating === null && r.rating !== null;
    }),
    [parsed, existingByTitle],
  );
  const alreadyOwned = parsed.length - newRows.length - updateRows.length;

  async function pickFile(src: ImportSource) {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const name = asset.name ?? '';

      // Catch ZIP before trying to read it as text
      if (name.toLowerCase().endsWith('.zip') || asset.mimeType === 'application/zip') {
        Alert.alert(
          'Unzip required',
          'Letterboxd exports a ZIP file. Open it in the Files app, then come back and pick one of the CSVs inside — diary.csv or ratings.csv works best.',
        );
        return;
      }

      // Copy to app cache first (handles iCloud security-scoped URLs),
      // then read. Falls back to direct read if copy fails.
      let readUri = asset.uri;
      try {
        const dest = `${FileSystem.cacheDirectory}clique_import_${Date.now()}.csv`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        readUri = dest;
      } catch {
        // Couldn't copy — will try reading the original URI directly
      }

      let text: string;
      try {
        text = await FileSystem.readAsStringAsync(readUri, { encoding: 'utf8' as any });
      } catch {
        try {
          const b64 = await FileSystem.readAsStringAsync(readUri, { encoding: 'base64' as any });
          text = atob(b64);
        } catch (readErr: any) {
          throw new Error(`Cannot read file: ${readErr?.message ?? readErr}`);
        }
      }
      let rows: ParsedRow[] = [];
      try {
        rows = src === 'letterboxd' ? parseLetterboxd(text, name) : parseGoodreads(text);
      } catch (e: any) {
        if (e?.message === 'zip') {
          Alert.alert(
            'Unzip required',
            'Letterboxd exports a ZIP file. Open it in the Files app, then come back and pick one of the CSVs inside — diary.csv or ratings.csv works best.',
          );
          return;
        }
        throw e;
      }
      if (rows.length === 0) {
        Alert.alert('Nothing found', 'The file doesn\'t look like a valid export. Make sure you\'re uploading the diary.csv or ratings.csv from inside the Letterboxd ZIP.');
        return;
      }
      setFileName(asset.name ?? 'file.csv');
      setParsed(rows);
      setStep('preview');
    } catch (e: any) {
      Alert.alert('Could not read file', e?.message ?? 'Unknown error — please try again.');
    }
  }

  async function runImport() {
    if (!user) return;
    cancelledRef.current = false;
    setStep('importing');
    setProgress(0);

    const allRows = [...newRows, ...updateRows];
    let imported = 0;
    let updated = 0;
    let unmatched = 0;
    const inserts: object[] = [];

    for (let i = 0; i < allRows.length; i++) {
      if (cancelledRef.current) break;
      setProgress(i / allRows.length);

      const row = allRows[i];
      const isUpdate = existingByTitle.has(row.title.toLowerCase());

      if (isUpdate) {
        const existing = existingByTitle.get(row.title.toLowerCase())!;
        const patch: Record<string, unknown> = {};
        if (existing.user_rating === null && row.rating !== null) patch.user_rating = row.rating;
        if (!existing.note && row.note) patch.note = row.note;
        if (Object.keys(patch).length > 0) {
          await supabase.from('collection_items')
            .update(patch)
            .eq('id', existing.id)
            .eq('user_id', user.id);
        }
        updated++;
        await new Promise((r) => setTimeout(r, 40));
        continue;
      }

      const lookup = source === 'letterboxd'
        ? await lookupTMDB(row.title, row.year)
        : await lookupHardcover(row.title, row.author);

      // If TMDB resolved to an id already in the collection, update rating instead of inserting
      if (lookup && existingByExternalId.has(lookup.externalId)) {
        const existing = existingByExternalId.get(lookup.externalId)!;
        const idPatch: Record<string, unknown> = {};
        if (existing.user_rating === null && row.rating !== null) idPatch.user_rating = row.rating;
        if (!existing.note && row.note) idPatch.note = row.note;
        if (Object.keys(idPatch).length > 0) {
          await supabase.from('collection_items')
            .update(idPatch)
            .eq('id', existing.id)
            .eq('user_id', user.id);
          updated++;
        }
        continue;
      }

      if (!lookup) unmatched++;

      const type = source === 'goodreads' ? 'read'
        : lookup?.mediaType === 'tv' ? 'tv'
        : 'watch';

      inserts.push({
        user_id: user.id,
        type,
        title: row.title,
        sub: lookup?.sub ?? (row.year || null),
        poster: lookup?.poster ?? null,
        external_id: lookup?.externalId ?? null,
        media_type: lookup?.mediaType ?? (source === 'letterboxd' ? 'movie' : 'book'),
        user_rating: row.rating,
        note: row.note ?? null,
      });
      imported++;

      await new Promise((r) => setTimeout(r, 80));
    }

    if (inserts.length > 0) {
      for (let i = 0; i < inserts.length; i += 50) {
        await supabase.from('collection_items').insert(inserts.slice(i, i + 50));
      }
    }

    await queryClient.invalidateQueries({ queryKey: ['collection-items'] });

    setResult({ imported, updated, skipped: alreadyOwned, unmatched });
    setProgress(1);
    setStep('done');
  }

  async function pickListFile() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'public.comma-separated-values-text', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const name = asset.name ?? '';

      if (name.toLowerCase().endsWith('.zip') || asset.mimeType === 'application/zip') {
        Alert.alert(
          'Unzip required',
          'Letterboxd exports a ZIP file. Open it in the Files app → lists folder, then pick one of the list CSVs.',
        );
        return;
      }

      let readUri = asset.uri;
      try {
        const dest = `${FileSystem.cacheDirectory}clique_list_${Date.now()}.csv`;
        await FileSystem.copyAsync({ from: asset.uri, to: dest });
        readUri = dest;
      } catch { /* fall through */ }

      let text: string;
      try {
        text = await FileSystem.readAsStringAsync(readUri, { encoding: 'utf8' as any });
      } catch {
        const b64 = await FileSystem.readAsStringAsync(readUri, { encoding: 'base64' as any });
        text = atob(b64);
      }

      let items: ParsedListItem[] = [];
      try {
        items = parseLetterboxdList(text);
      } catch (e: any) {
        if (e?.message === 'zip') {
          Alert.alert('Unzip required', 'Open the Letterboxd ZIP in Files, go into the lists folder, then pick a CSV.');
          return;
        }
        throw e;
      }

      if (items.length === 0) {
        Alert.alert('Nothing found', 'This doesn\'t look like a Letterboxd list CSV. The file should have Position, Name, and Year columns.');
        return;
      }

      setListItems(items);
      setListName(listNameFromFilename(name));
      setFileName(name);
      setStep('list-preview');
    } catch (e: any) {
      Alert.alert('Could not read file', e?.message ?? 'Unknown error — please try again.');
    }
  }

  async function runListImport() {
    if (!user) return;
    cancelledRef.current = false;
    setStep('list-importing');
    setProgress(0);

    // 1. Create the list row
    const { data: newList, error: listErr } = await supabase
      .from('lists')
      .insert({ user_id: user.id, title: listName.trim(), description: null, is_public: true })
      .select()
      .single();
    if (listErr || !newList) {
      Alert.alert('Error', 'Could not create list — please try again.');
      setStep('list-preview');
      return;
    }

    // 2. Look up each item and build list_items rows
    const inserts: object[] = [];
    for (let i = 0; i < listItems.length; i++) {
      if (cancelledRef.current) break;
      setProgress(i / listItems.length);

      const item = listItems[i];
      const lookup = await lookupTMDB(item.title, item.year);

      inserts.push({
        list_id: (newList as any).id,
        title: item.title,
        sub: lookup?.sub ?? (item.year || null),
        poster: lookup?.poster ?? null,
        type: lookup?.mediaType === 'tv' ? 'tv' : 'watch',
        position: item.position || i + 1,
        library_item_id: null,
      });

      await new Promise((r) => setTimeout(r, 80));
    }

    // 3. Insert all items in batches
    for (let i = 0; i < inserts.length; i += 50) {
      await supabase.from('list_items').insert(inserts.slice(i, i + 50));
    }

    await queryClient.invalidateQueries({ queryKey: ['lists', user.id] });

    setListImported(inserts.length);
    setProgress(1);
    setStep('list-done');
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
              onPress={() => {
                setSource('letterboxd');
                Alert.alert(
                  'Which file to pick',
                  'We accept three CSVs from your Letterboxd export:\n\n• watched.csv — your watch history\n• ratings.csv — your star ratings\n• reviews.csv — your written reviews\n\nImport them in any order — we\'ll merge them onto the right titles automatically.',
                  [{ text: 'Choose File', onPress: () => pickFile('letterboxd') }, { text: 'Cancel', style: 'cancel' }],
                );
              }}>
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
              onPress={() => { setSource('letterboxd-list'); pickListFile(); }}>
              <View style={styles.rowIcon}>
                <SymbolView name="list.bullet" size={18} tintColor={Brand.muted} type="monochrome" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowLabel}>Letterboxd Lists</Text>
                <Text style={styles.rowSub}>Import a curated list — from the lists/ folder in your export ZIP</Text>
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
            {updateRows.length > 0 && (
              <>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <Text style={[styles.statNum, { color: Brand.trust }]}>{updateRows.length}</Text>
                  <Text style={styles.statLabel}>Ratings to add</Text>
                </View>
              </>
            )}
            <View style={styles.statDivider} />
            <View style={[styles.stat]}>
              <Text style={[styles.statNum, { color: Brand.trust }]}>{newRows.length}</Text>
              <Text style={styles.statLabel}>New</Text>
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
                    <View style={[styles.previewRow, index > 0 && styles.previewDivider]}>
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
            style={[styles.importBtn, (newRows.length + updateRows.length) === 0 && styles.importBtnDisabled]}
            disabled={(newRows.length + updateRows.length) === 0}
            onPress={runImport}>
            <Text style={styles.importBtnText}>
              {newRows.length + updateRows.length === 0
                ? 'Nothing new to import'
                : updateRows.length > 0 && newRows.length === 0
                  ? `Update ${updateRows.length} ratings`
                  : updateRows.length > 0
                    ? `Import ${newRows.length} + update ${updateRows.length}`
                    : `Import ${newRows.length} items`}
            </Text>
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

  // ── Step: list-preview ──────────────────────────────────────────────────────
  if (step === 'list-preview') {
    const preview = listItems.slice(0, 5);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.title}>Import List</Text>
          <Text style={styles.sub}>{listItems.length} titles from {fileName}</Text>

          <Text style={styles.sectionLabel}>List name</Text>
          <View style={[styles.card, { marginBottom: Spacing.three }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[styles.rowLabel, { fontSize: 14 }]}
                  onPress={() =>
                    Alert.prompt('List name', undefined, (text) => { if (text?.trim()) setListName(text.trim()); }, 'plain-text', listName)
                  }>
                  {listName}
                </Text>
                <Text style={styles.rowSub}>Tap to rename</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Preview</Text>
          <View style={styles.card}>
            <FlatList
              data={preview}
              keyExtractor={(_, i) => String(i)}
              scrollEnabled={false}
              renderItem={({ item, index }) => (
                <View style={[styles.previewRow, index > 0 && styles.previewDivider]}>
                  <Text style={[styles.previewSub, { width: 24, textAlign: 'right', flexShrink: 0 }]}>{item.position || index + 1}</Text>
                  <View style={styles.previewBody}>
                    <Text style={styles.previewTitle} numberOfLines={1}>{item.title}</Text>
                    {item.year ? <Text style={styles.previewSub}>{item.year}</Text> : null}
                  </View>
                </View>
              )}
            />
            {listItems.length > 5 && (
              <View style={[styles.previewRow, styles.previewDivider]}>
                <Text style={[styles.previewMore, { paddingLeft: 32 }]}>+{listItems.length - 5} more titles</Text>
              </View>
            )}
          </View>

          <Text style={styles.note}>
            Clique will look up each title to get posters and metadata. The list will appear in your Lists tab.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={() => setStep('source')}>
            <Text style={styles.cancelBtnText}>Back</Text>
          </Pressable>
          <Pressable style={styles.importBtn} onPress={runListImport}>
            <Text style={styles.importBtnText}>Import {listItems.length} titles</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: list-importing ─────────────────────────────────────────────────────
  if (step === 'list-importing') {
    const pct = Math.round(progress * 100);
    const current = Math.round(progress * listItems.length);
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.importingContainer}>
          <ActivityIndicator size="large" color={Brand.trust} style={{ marginBottom: 24 }} />
          <Text style={styles.importingTitle}>Building your list…</Text>
          <Text style={styles.importingCount}>{current} of {listItems.length}</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.importingSub}>Looking up posters and metadata</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Step: list-done ──────────────────────────────────────────────────────────
  if (step === 'list-done') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <Text style={styles.doneEmoji}>🎉</Text>
          <Text style={styles.title}>List Imported!</Text>
          <Text style={styles.sub}>"{listName}" is now in your Lists tab</Text>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: Brand.trust }]}>{listImported}</Text>
              <Text style={styles.statLabel}>Titles added</Text>
            </View>
          </View>

          <Text style={styles.note}>
            Find it in your profile under Lists. You can edit the name, reorder items, or make it private anytime.
          </Text>
        </View>

        <View style={styles.footer}>
          <Pressable style={styles.cancelBtn} onPress={() => { setStep('source'); setListItems([]); setListName(''); }}>
            <Text style={styles.cancelBtnText}>Import another</Text>
          </Pressable>
          <Pressable style={styles.importBtn} onPress={() => router.back()}>
            <Text style={styles.importBtnText}>Done</Text>
          </Pressable>
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
          {(result?.updated ?? 0) > 0 && (
            <>
              <View style={styles.statDivider} />
              <View style={styles.stat}>
                <Text style={[styles.statNum, { color: Brand.trust }]}>{result?.updated}</Text>
                <Text style={styles.statLabel}>Ratings added</Text>
              </View>
            </>
          )}
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
    sectionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },

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
    previewDivider: { borderTopWidth: 1, borderTopColor: Brand.border },

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
