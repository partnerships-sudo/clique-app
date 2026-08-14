import { router } from 'expo-router';
import { useMemo } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useMyTasteAll, type MyTasteEntry } from '@/features/follows/api';
import { compatColor, compatEmoji } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';

const TYPE_LABELS: Record<string, string> = {
  watch: '🎬 Film & TV', read: '📚 Books', listen: '🎵 Music', play: '🎮 Games',
};

function TasteRow({ entry, rank, styles, Brand }: { entry: MyTasteEntry; rank: number; styles: ReturnType<typeof createStyles>; Brand: BrandPalette }) {
  const name = entry.full_name || entry.username || 'Someone';
  const color = compatColor(entry.compatibility);

  return (
    <Pressable
      style={styles.row}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${entry.compatibility}% taste match`}
      onPress={() => router.push({ pathname: '/taste-detail-modal', params: { friendId: entry.id } })}>
      <Text style={styles.rank}>#{rank}</Text>
      <Avatar name={name} size={48} avatarUrl={entry.avatar_url} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
        {entry.username ? <Text style={styles.handle}>@{entry.username}</Text> : null}
        <View style={styles.metaRow}>
          <View style={[styles.pill, { backgroundColor: color + '1A' }]}>
            <Text style={[styles.pillText, { color }]}>
              {compatEmoji(entry.compatibility)} {entry.compatibility}%
            </Text>
          </View>
          {entry.sharedCount > 0 ? (
            <Text style={styles.sharedHint}>{entry.sharedCount} in common</Text>
          ) : null}
          {entry.topType ? (
            <Text style={styles.sharedHint}>{TYPE_LABELS[entry.topType] ?? entry.topType}</Text>
          ) : null}
        </View>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} type="monochrome" />
    </Pressable>
  );
}

export default function MyTasteModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: entries = [], isLoading } = useMyTasteAll();
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>MyTaste</Text>
        <Text style={styles.sub}>Your friends ranked by taste compatibility</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
      ) : entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No friends yet</Text>
          <Text style={styles.emptySub}>Follow people to see your taste compatibility</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <TasteRow entry={item} rank={index + 1} styles={styles} Brand={Brand} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: 16,
      paddingBottom: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginTop: 2 },

    list: { paddingHorizontal: Spacing.three, paddingVertical: 8 },
    separator: { height: 1, backgroundColor: Brand.border },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 14,
    },
    rank: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 13,
      color: Brand.muted,
      width: 28,
      textAlign: 'right',
    },
    info: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink, marginBottom: 1 },
    handle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginBottom: 4 },
    pill: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 8,
    },
    pillText: { fontFamily: BrandFonts.syneBold, fontSize: 11 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 4 },
    sharedHint: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted },
    pctBadge: {
      borderRadius: 10,
      paddingHorizontal: 8,
      paddingVertical: 4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pctText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 12, color: '#fff' },

    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    emptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, textAlign: 'center', paddingHorizontal: 32 },
  });
}
