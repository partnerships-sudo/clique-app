import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useLibraryItems, type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';

type ExportFormat = 'csv' | 'letterboxd' | 'json';

const FORMATS: { id: ExportFormat; sf: string; label: string; sub: string }[] = [
  {
    id: 'csv',
    sf: 'tablecells',
    label: 'CSV',
    sub: 'All logged items — opens in Excel, Google Sheets, or Numbers',
  },
  {
    id: 'letterboxd',
    sf: 'film',
    label: 'Letterboxd',
    sub: 'Movies & TV only — ready to import at letterboxd.com',
  },
  {
    id: 'json',
    sf: 'curlybraces',
    label: 'JSON',
    sub: 'Raw data — every field, for developers and power users',
  },
];

function escapeCSVField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toISODate(isoTimestamp: string): string {
  return isoTimestamp.split('T')[0];
}

function buildCSV(items: LibraryItem[]): string {
  const header = ['Type', 'Title', 'Sub', 'Rating (1–5)', 'Note', 'Status', 'Logged', 'Date Added'];
  const rows = items.map((item) => [
    item.type,
    item.title,
    item.sub ?? '',
    item.rating ?? '',
    item.note ?? '',
    item.status,
    item.date ?? '',
    toISODate(item.created_at),
  ]);
  return [header, ...rows].map((row) => row.map(escapeCSVField).join(',')).join('\n');
}

function buildLetterboxdCSV(items: LibraryItem[]): string {
  const movies = items.filter((i) => i.type === 'watch');
  const header = ['Date', 'Name', 'Year', 'Rating10', 'Rewatch', 'Tags', 'WatchedDate'];
  const rows = movies.map((item) => {
    const date = toISODate(item.created_at);
    const year = /^\d{4}$/.test(item.sub ?? '') ? item.sub : '';
    const rating10 = item.rating !== null ? String(Math.round(item.rating * 2)) : '';
    return [date, item.title, year, rating10, '', '', date];
  });
  return [header, ...rows].map((row) => row.map(escapeCSVField).join(',')).join('\n');
}

function buildJSON(items: LibraryItem[]): string {
  const sanitized = items.map(({ user_id: _uid, ...rest }) => rest);
  return JSON.stringify(sanitized, null, 2);
}

async function runExport(format: ExportFormat, items: LibraryItem[]) {
  let content: string;
  let title: string;

  if (format === 'csv') {
    content = buildCSV(items);
    title = 'clique-library.csv';
  } else if (format === 'letterboxd') {
    content = buildLetterboxdCSV(items);
    title = 'clique-letterboxd.csv';
  } else {
    content = buildJSON(items);
    title = 'clique-library.json';
  }

  await Share.share({ title, message: content });
}

export default function ExportLibraryModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { logged, isLoading } = useLibraryItems();
  const [busy, setBusy] = useState<ExportFormat | null>(null);

  async function handleExport(format: ExportFormat) {
    if (busy) return;
    setBusy(format);
    try {
      await runExport(format, logged);
    } catch {
      Alert.alert('Export failed', 'Something went wrong. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <Text style={styles.title}>Export Library</Text>
        <Text style={styles.sub}>
          {isLoading
            ? 'Loading your library…'
            : `${logged.length} logged item${logged.length !== 1 ? 's' : ''} ready to export`}
        </Text>

        <View style={styles.formatList}>
          {FORMATS.map((fmt, i) => {
            const isBusy = busy === fmt.id;
            return (
              <Pressable
                key={fmt.id}
                style={[styles.formatCard, i > 0 && styles.formatCardDivider]}
                onPress={() => handleExport(fmt.id)}
                disabled={!!busy || isLoading}>
                <View style={styles.formatIcon}>
                  {isBusy ? (
                    <ActivityIndicator size="small" color={Brand.trust} />
                  ) : (
                    <SymbolView
                      name={fmt.sf as any}
                      size={20}
                      tintColor={Brand.trust}
                      type="monochrome"
                      style={{ width: 22, height: 22 }}
                    />
                  )}
                </View>
                <View style={styles.formatBody}>
                  <Text style={styles.formatLabel}>{fmt.label}</Text>
                  <Text style={styles.formatSub}>{fmt.sub}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.note}>
          Export includes your logged items only — watchlist items are not included.
        </Text>
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
    formatList: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      overflow: 'hidden',
    },
    formatCard: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: Spacing.three,
      gap: 14,
    },
    formatCardDivider: { borderTopWidth: 1, borderTopColor: Brand.border },
    formatIcon: { width: 28, alignItems: 'center', justifyContent: 'center' },
    formatBody: { flex: 1, minWidth: 0 },
    formatLabel: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink, marginBottom: 2 },
    formatSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    chevron: { fontSize: 22, color: Brand.muted },
    note: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
      textAlign: 'center',
      marginTop: Spacing.three,
      paddingHorizontal: 10,
    },
  });
}
