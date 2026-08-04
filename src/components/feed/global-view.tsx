import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DiscussionCard } from '@/components/feed/discussion-card';
import { MostReviewedSection } from '@/components/feed/most-reviewed-section';
import { BrandFonts, TypeColorsLight, type BrandPalette, type EntryType } from '@/constants/theme';
import { type FeedFilterValue, useThreadSearch } from '@/features/feed/api';
import { type DiscussionType, useDiscussionSearch, useDiscussions } from '@/features/discussions/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';

const TYPE_MAP: Record<string, EntryType> = {
  watch: 'watch', read: 'read', play: 'play', listen: 'listen', podcast: 'podcast',
};

function openThread(title: string, postType: string, poster?: string | null) {
  router.push({ pathname: '/chat-modal', params: { title, type: postType, ...(poster ? { poster } : {}) } });
}

const DISCUSSION_TYPE_LABELS: Record<string, string> = {
  read: 'Books', watch: 'TV & Film', play: 'Games',
  listen: 'Music', podcast: 'Podcasts', general: 'General',
};

function SearchResults({ query, Brand }: { query: string; Brand: BrandPalette }) {
  const { data: threads = [], isLoading: tLoading } = useThreadSearch(query);
  const { data: discussions = [], isLoading: dLoading } = useDiscussionSearch(query);
  const TypeColors = useTypeColors();

  const isLoading = tLoading || dLoading;
  const hasResults = threads.length > 0 || discussions.length > 0;

  if (isLoading) return <ActivityIndicator style={{ marginTop: 12 }} />;
  if (!hasResults && query.trim().length >= 2) {
    return (
      <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
        <Text style={[styles.searchEmpty, { color: Brand.muted }]}>Nothing found for "{query}"</Text>
      </View>
    );
  }
  if (!hasResults) return null;

  const allItems = [
    ...discussions.map((d) => ({ kind: 'discussion' as const, ...d })),
    ...threads.map((t) => ({ kind: 'thread' as const, ...t })),
  ];

  return (
    <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
      {allItems.map((row, i) => {
        const isLast = i === allItems.length - 1;
        if (row.kind === 'discussion') {
          const typeColors = (TypeColors as any)[row.type] ?? { color: '#6B7280', bg: '#F3F4F6' };
          const typeLabel = DISCUSSION_TYPE_LABELS[row.type] ?? row.type;
          return (
            <Pressable
              key={`d-${row.id}`}
              style={[styles.searchRow, !isLast && { borderBottomWidth: 0.5, borderBottomColor: Brand.border }]}
              onPress={() => router.push({ pathname: '/discussion-detail-modal', params: { id: row.id } })}>
              <View style={[styles.srThumb, { backgroundColor: typeColors.bg, justifyContent: 'center', alignItems: 'center' }]}>
                <SymbolView name="bubble.left.and.bubble.right" size={16} tintColor={typeColors.color} type="monochrome" style={{ width: 16, height: 16 }} />
              </View>
              <View style={styles.srBody}>
                <Text style={[styles.srType, { color: typeColors.color }]}>{typeLabel.toUpperCase()}</Text>
                <Text style={[styles.srTitle, { color: Brand.ink }]} numberOfLines={1}>{row.title}</Text>
                <Text style={[styles.srCount, { color: Brand.muted }]}>{row.comment_count} {row.comment_count === 1 ? 'comment' : 'comments'} · Discussion</Text>
              </View>
              <SymbolView name="chevron.right" size={14} tintColor={Brand.border} type="monochrome" style={{ width: 14, height: 14 }} />
            </Pressable>
          );
        }
        const type = TYPE_MAP[row.post_type];
        const colors = type ? TypeColors[type] : TypeColorsLight.watch;
        return (
          <Pressable
            key={`t-${row.title}-${i}`}
            style={[styles.searchRow, !isLast && { borderBottomWidth: 0.5, borderBottomColor: Brand.border }]}
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

  const discussionType = filter === 'all' ? 'all' : filter as DiscussionType;
  const { data: discussions = [], isLoading: dLoading } = useDiscussions(discussionType);
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
          {/* Discussions board */}
          <View style={styles.sectionRow}>
            <Text style={[styles.sectionTitle, { color: Brand.ink }]}>💬 Discussions</Text>
            <Pressable
              style={[styles.newDiscussionBtn, { backgroundColor: Brand.trust }]}
              onPress={() => router.push('/create-discussion-modal')}>
              <SymbolView name="plus" size={12} tintColor="#fff" type="monochrome" style={{ width: 12, height: 12 }} />
              <Text style={styles.newDiscussionText}>Start one</Text>
            </Pressable>
          </View>

          {dLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} color={Brand.trust} />
          ) : discussions.length === 0 ? (
            <Pressable
              style={[styles.emptyBoard, { backgroundColor: Brand.card, borderColor: Brand.border }]}
              onPress={() => router.push('/create-discussion-modal')}>
              <Text style={styles.emptyBoardIcon}>💬</Text>
              <Text style={[styles.emptyBoardTitle, { color: Brand.ink }]}>No discussions yet</Text>
              <Text style={[styles.emptyBoardSub, { color: Brand.muted }]}>Be the first to start one</Text>
            </Pressable>
          ) : (
            discussions.map((d) => <DiscussionCard key={d.id} item={d} />)
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

  newDiscussionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  newDiscussionText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 12,
    color: '#fff',
  },

  emptyBoard: {
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    borderStyle: 'dashed',
    padding: 32,
    marginBottom: 8,
    gap: 6,
  },
  emptyBoardIcon: { fontSize: 32 },
  emptyBoardTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15 },
  emptyBoardSub: { fontFamily: BrandFonts.interRegular, fontSize: 13 },

  emptyText: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.5,
    textAlign: 'center',
    paddingVertical: 20,
    lineHeight: 20,
  },
});

