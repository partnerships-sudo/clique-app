import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/feed/filter-chips';
import { LibCard } from '@/components/library/lib-card';
import { SortRow, type LibrarySort } from '@/components/library/sort-row';
import { StatsRow } from '@/components/library/stats-row';
import { WatchlistCard } from '@/components/library/watchlist-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import {
  useLibraryItems,
  useMoveToLibrary,
  useRemoveLibraryItem,
  type LibraryItem,
} from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';

type LibTab = 'logged' | 'watchlist';
type WatchlistView = 'mine' | 'friends';

export default function LibraryScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [tab, setTab] = useState<LibTab>('logged');
  const [watchlistView, setWatchlistView] = useState<WatchlistView>('mine');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [sort, setSort] = useState<LibrarySort>('unrated');

  const { logged, watchlist, friendRecItems, isLoading, isFetching, refetch } = useLibraryItems();
  const moveToLibrary = useMoveToLibrary();
  const removeItem = useRemoveLibraryItem();

  const loggedFiltered = useMemo(() => {
    const items =
      filter === 'all' ? logged : logged.filter((item: LibraryItem) => item.type === filter);
    const sorted = [...items];
    if (sort === 'unrated') {
      sorted.sort((a, b) => {
        const aUnrated = a.rating == null ? 0 : 1;
        const bUnrated = b.rating == null ? 0 : 1;
        if (aUnrated !== bUnrated) return aUnrated - bUnrated;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    } else if (sort === 'rating') {
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    } else if (sort === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [logged, filter, sort]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, tab === 'logged' && styles.tabActive]}
            onPress={() => setTab('logged')}>
            <Text style={[styles.tabText, tab === 'logged' && styles.tabTextActive]}>
              📚 Logged
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'watchlist' && styles.tabActive]}
            onPress={() => setTab('watchlist')}>
            <Text style={[styles.tabText, tab === 'watchlist' && styles.tabTextActive]}>
              🔖 Watchlist{watchlist.length ? ` ${watchlist.length}` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === 'logged' ? (
        <FlatList
          contentContainerStyle={styles.content}
          data={loggedFiltered}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Brand.trust}
            />
          }
          ListHeaderComponent={
            <View>
              <StatsRow items={logged} />
              <FilterChips value={filter} onChange={setFilter} />
              <SortRow value={sort} onChange={setSort} />
            </View>
          }
          renderItem={({ item }) => <LibCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            !isLoading ? <Text style={styles.empty}>Nothing logged here yet.</Text> : null
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={watchlistView === 'mine' ? watchlist : friendRecItems}
          keyExtractor={(item: LibraryItem) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Brand.trust}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.subToggleRow}>
                <Pressable
                  style={[styles.subToggle, watchlistView === 'mine' && styles.subToggleActive]}
                  onPress={() => setWatchlistView('mine')}>
                  <Text style={[styles.subToggleText, watchlistView === 'mine' && styles.subToggleTextActive]}>
                    🔖 My Watchlist{watchlist.length ? ` ${watchlist.length}` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.subToggle, watchlistView === 'friends' && styles.subToggleActive]}
                  onPress={() => setWatchlistView('friends')}>
                  <Text style={[styles.subToggleText, watchlistView === 'friends' && styles.subToggleTextActive]}>
                    💌 From Friends{friendRecItems.length ? ` ${friendRecItems.length}` : ''}
                  </Text>
                </Pressable>
              </View>
              {watchlistView === 'mine' ? (
                <Pressable
                  style={styles.addBtn}
                  onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}>
                  <Text style={styles.addBtnText}>+ Add something to your watchlist</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={({ item }: { item: LibraryItem }) => (
            <WatchlistCard
              item={item}
              onLogIt={() => moveToLibrary.mutate(item)}
              onRemove={() => removeItem.mutate(item.id)}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            !isLoading ? (
              <Text style={styles.empty}>
                {watchlistView === 'mine'
                  ? 'Your watchlist is empty — add things you want to get to!'
                  : 'No recs yet — when a friend sends you a rec it shows up here automatically.'}
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, paddingTop: Spacing.three },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 5,
  },
  tab: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: Brand.ink },
  tabText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
  tabTextActive: { color: '#fff' },
  subToggleRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 5,
    marginBottom: 14,
  },
  subToggle: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  subToggleActive: { backgroundColor: Brand.ink },
  subToggleText: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.muted },
  subToggleTextActive: { color: '#fff' },
  addBtn: {
    borderWidth: 2,
    borderColor: Brand.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13.6, color: Brand.muted },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    color: Brand.muted,
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.6,
  },
  });
}
