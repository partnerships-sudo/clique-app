import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { MostReviewedSection } from '@/components/feed/most-reviewed-section';
import { BrandFonts, TypeColorsLight, type BrandPalette, type EntryType } from '@/constants/theme';
import { type FeedFilterValue, useHotThreads, useThreadSearch } from '@/features/feed/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const TYPE_MAP: Record<string, EntryType> = {
  watch: 'watch', read: 'read', play: 'play', listen: 'listen', podcast: 'podcast',
};

function openThread(title: string, postType: string, poster?: string | null) {
  router.push({ pathname: '/chat-modal', params: { title, type: postType, ...(poster ? { poster } : {}) } });
}

function HotCard({ title, post_type, message_count, poster }: { title: string; post_type: string; message_count: number; poster: string | null }) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const type = TYPE_MAP[post_type];
  const colors = type ? TypeColors[type] : TypeColorsLight.watch;
  return (
    <Pressable style={[styles.hotCard, { borderColor: Brand.border, backgroundColor: Brand.card }]} onPress={() => openThread(title, post_type, poster)}>
      <View style={styles.hotCardImg}>
        {poster ? (
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 32 }}>{colors.icon}</Text>
          </View>
        )}
      </View>
      <View style={styles.hotCardBody}>
        <Text style={[styles.hotCardType, { color: colors.color }]}>{colors.label}</Text>
        <Text style={[styles.hotCardTitle, { color: Brand.ink }]} numberOfLines={2}>{title}</Text>
        <View style={styles.hotCardMeta}>
          <View style={styles.liveDot} />
          <Text style={[styles.hotCardCount, { color: Brand.muted }]}>{message_count} {message_count === 1 ? 'comment' : 'comments'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function ThreadRow({ title, post_type, message_count, last_text, last_user, poster }: {
  title: string; post_type: string; message_count: number; last_text: string; last_user: string; poster: string | null;
}) {
  const Brand = useBrand();
  const TypeColors = useTypeColors();
  const type = TYPE_MAP[post_type];
  const colors = type ? TypeColors[type] : TypeColorsLight.watch;
  return (
    <Pressable style={[styles.threadCard, { backgroundColor: Brand.card, borderColor: Brand.border }]} onPress={() => openThread(title, post_type, poster)}>
      <View style={styles.threadThumb}>
        {poster ? (
          <Image source={{ uri: poster }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 22 }}>{colors.icon}</Text>
          </View>
        )}
      </View>
      <View style={styles.threadBody}>
        <Text style={[styles.threadTitle, { color: Brand.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.threadSnippet, { color: Brand.muted }]} numberOfLines={1}>
          {last_user ? `${last_user}: ` : ''}{last_text}
        </Text>
        <View style={styles.threadFoot}>
          <SymbolView name="bubble.left" size={12} tintColor={Brand.muted} type="monochrome" style={{ width: 12, height: 12 }} />
          <Text style={[styles.threadStat, { color: Brand.muted }]}>{message_count}</Text>
        </View>
      </View>
      <SymbolView name="chevron.right" size={14} tintColor={Brand.border} type="monochrome" style={{ width: 14, height: 14 }} />
    </Pressable>
  );
}

function SearchResults({ query, Brand }: { query: string; Brand: BrandPalette }) {
  const { data = [], isLoading } = useThreadSearch(query);
  const TypeColors = useTypeColors();

  if (isLoading) return <ActivityIndicator style={{ marginTop: 12 }} />;
  if (data.length === 0 && query.trim().length >= 2) {
    return (
      <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
        <Text style={[styles.searchEmpty, { color: Brand.muted }]}>No threads found for "{query}"</Text>
      </View>
    );
  }
  if (data.length === 0) return null;

  return (
    <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
      {data.map((row, i) => {
        const type = TYPE_MAP[row.post_type];
        const colors = type ? TypeColors[type] : TypeColorsLight.watch;
        return (
          <Pressable
            key={`${row.title}-${i}`}
            style={[styles.searchRow, i < data.length - 1 && { borderBottomWidth: 0.5, borderBottomColor: Brand.border }]}
            onPress={() => openThread(row.title, row.post_type, null)}>
            <View style={[styles.srThumb, { backgroundColor: colors.bg }]}>
              <Text style={{ fontSize: 18 }}>{colors.icon}</Text>
            </View>
            <View style={styles.srBody}>
              <Text style={[styles.srType, { color: colors.color }]}>{colors.label}</Text>
              <Text style={[styles.srTitle, { color: Brand.ink }]} numberOfLines={1}>{row.title}</Text>
              <Text style={[styles.srCount, { color: Brand.muted }]}>{row.message_count} {row.message_count === 1 ? 'comment' : 'comments'}</Text>
            </View>
            <SymbolView name="chevron.right" size={14} tintColor={Brand.border} type="monochrome" style={{ width: 14, height: 14 }} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function GlobalView({ filter }: { filter: FeedFilterValue }) {
  const Brand = useBrand();
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length >= 2;

  const { data: hotThreads = [], isLoading: hotLoading } = useHotThreads(filter);
  const hotCards = hotThreads.slice(0, 5);
  const threadRows = hotThreads.slice(5, 10);

  const typeFilter = filter === 'all' ? 'all' : filter;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
        <SymbolView name="magnifyingglass" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16 }} />
        <TextInput
          style={[styles.searchInput, { color: Brand.ink }]}
          placeholder="Search a show, film, book, episode…"
          placeholderTextColor={Brand.muted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Search results overlay */}
      {isSearching && <SearchResults query={searchQuery} Brand={Brand} />}

      {/* Main content — hidden while searching */}
      {!isSearching && (
        <>
          {/* Hot discussions */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: Brand.ink }]}>🔥 Hot discussions</Text>
            <Pressable><Text style={[styles.seeAll, { color: Brand.trust }]}>See all</Text></Pressable>
          </View>

          {hotLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={Brand.trust} />
          ) : hotCards.length === 0 ? (
            <Text style={[styles.emptyText, { color: Brand.muted }]}>
              No active discussions yet. Start one by posting in a content chat.
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hotScroll}>
              {hotCards.map((t) => (
                <HotCard key={t.title} {...t} />
              ))}
            </ScrollView>
          )}

          {/* Community threads */}
          {threadRows.length > 0 && (
            <>
              <View style={[styles.sectionRow, { paddingTop: 20 }]}>
                <Text style={[styles.sectionTitle, { color: Brand.ink }]}>Community threads</Text>
                <Pressable><Text style={[styles.seeAll, { color: Brand.trust }]}>Browse all</Text></Pressable>
              </View>
              {threadRows.map((t) => (
                <ThreadRow key={t.title} {...t} />
              ))}
            </>
          )}

          {/* Most Reviewed — filtered by active chip */}
          <MostReviewedSection typeFilter={typeFilter as EntryType | 'all'} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
  },
  searchResults: {
    borderWidth: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  searchEmpty: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    textAlign: 'center',
    padding: 16,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
  },
  srThumb: {
    width: 36, height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  srBody: { flex: 1, minWidth: 0 },
  srType: { fontFamily: BrandFonts.interMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  srTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, marginBottom: 2 },
  srCount: { fontFamily: BrandFonts.interRegular, fontSize: 11 },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 10,
  },
  sectionTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, letterSpacing: -0.3 },
  seeAll: { fontFamily: BrandFonts.interMedium, fontSize: 13 },

  hotScroll: { gap: 10, paddingRight: 4 },
  hotCard: {
    width: 120,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  hotCardImg: {
    width: '100%',
    aspectRatio: 2 / 3,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hotCardBody: { padding: 10 },
  hotCardType: { fontFamily: BrandFonts.interMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 2 },
  hotCardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 12, lineHeight: 16, marginBottom: 6 },
  hotCardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ef4444' },
  hotCardCount: { fontFamily: BrandFonts.interRegular, fontSize: 11 },

  threadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  threadThumb: {
    width: 44, height: 58,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  threadBody: { flex: 1, minWidth: 0 },
  threadTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, marginBottom: 3 },
  threadSnippet: { fontFamily: BrandFonts.interRegular, fontSize: 11, marginBottom: 5 },
  threadFoot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  threadStat: { fontFamily: BrandFonts.interRegular, fontSize: 11 },

  emptyText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.5,
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
});

