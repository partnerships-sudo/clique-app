import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QueryErrorState } from '@/components/query-error-state';
import { FilterChips } from '@/components/feed/filter-chips';
import { CollectionItemCard } from '@/components/library/collection-item-card';
import { LibCard } from '@/components/library/lib-card';
import { ListCard } from '@/components/library/list-card';
import { SortRow, type LibrarySort } from '@/components/library/sort-row';
import { WatchlistCard } from '@/components/library/watchlist-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { RatingPicker, type RatingIconStyle } from '@/components/rating-icons';
import { useCollectionItems, useRemoveFromCollection, type CollectionItem } from '@/features/collection/api';
import { useCreatePost, type FeedFilterValue } from '@/features/feed/api';
import {
  useBulkRemoveLibraryItems,
  useFriendWatchlist,
  useLibraryItems,
  useMoveToLibrary,
  useRateLibraryItem,
  useRemoveLibraryItem,
  type LibraryItem,
} from '@/features/library/api';
import { useLists, type ListSummary } from '@/features/lists/api';
import { useProfile } from '@/features/profile/api';
import { useBrand } from '@/hooks/use-brand';

type LibTab = 'logged' | 'watchlist' | 'collection' | 'lists';
type WatchlistView = 'mine' | 'friends' | 'their-watchlist';
type CollectionView = 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
type CollectionSort = 'recent' | 'rating' | 'alpha';

const COLLECTION_SORT_OPTIONS: { value: CollectionSort; label: string }[] = [
  { value: 'recent', label: 'Recent' },
  { value: 'rating', label: 'Rating' },
  { value: 'alpha', label: 'A–Z' },
];
const COLLECTION_VIEW_ORDER: CollectionView[] = ['read', 'watch', 'tv', 'listen', 'play', 'podcast'];
const COLLECTION_EMPTY: Record<CollectionView, { emoji: string; title: string; body: string }> = {
  watch:   { emoji: '🎬', title: 'Show me the movies!',              body: 'Rate a film and it lives here forever.' },
  read:    { emoji: '📚', title: 'To read, or not to read?',         body: "Guess you're not a bookworm... yet." },
  tv:      { emoji: '📺', title: 'Winter is coming',                  body: 'Log some shows to stock up for the long haul.' },
  listen:  { emoji: '🎧', title: 'No bangers detected',               body: 'Rate some music and your collection wakes up.' },
  play:    { emoji: '🎮', title: "It's dangerous to go alone",        body: "Log the games you've conquered." },
  podcast: { emoji: '🎙️', title: 'Houston, we have a podcast problem', body: 'Add podcasts you love to your collection.' },
};

const LibItemSeparator = () => <View style={{ height: 6 }} />;

export default function LibraryScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<LibTab>('logged');

  // Lets other screens (e.g. the profile's "My Collection" button) deep-link
  // straight into a specific sub-tab — a plain useState initializer wouldn't
  // pick this up if the Library tab screen was already mounted.
  useEffect(() => {
    if (params.tab === 'logged' || params.tab === 'watchlist' || params.tab === 'collection' || params.tab === 'lists') {
      setTab(params.tab);
    }
  }, [params.tab]);
  const [watchlistView, setWatchlistView] = useState<WatchlistView>('mine');
  const [collectionView, setCollectionView] = useState<CollectionView>('read');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const [sort, setSort] = useState<LibrarySort>('recent');

  const { data: profile } = useProfile();
  const { logged, watchlist, friendRecItems, isLoading, isError, isFetching, refetch } = useLibraryItems();
  const moveToLibrary = useMoveToLibrary();
  const removeItem = useRemoveLibraryItem();
  const rateItem = useRateLibraryItem();
  const createPost = useCreatePost();
  const { items: friendWatchlistItems } = useFriendWatchlist();
  const bulkRemoveItems = useBulkRemoveLibraryItems();

  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  function enterSelectMode(id: string) {
    Vibration.vibrate(40);
    setSelectMode(true);
    setSelectedIds(new Set([id]));
  }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }
  function handleTabChange(next: LibTab) {
    exitSelectMode();
    setTab(next);
  }

  function handleBulkDelete() {
    const count = selectedIds.size;
    Alert.alert(
      `Remove ${count} ${count === 1 ? 'item' : 'items'}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await bulkRemoveItems.mutateAsync([...selectedIds]);
              exitSelectMode();
            } catch {
              Alert.alert('Error', 'Could not remove items. Please try again.');
            }
          },
        },
      ],
    );
  }

  const [ratingItem, setRatingItem] = useState<LibraryItem | null>(null);
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingNote, setRatingNote] = useState('');
  const { data: listsData = [], isLoading: isListsLoading, isFetching: isListsFetching, refetch: refetchLists } = useLists();
  const { items: collectionItems, isLoading: isCollectionLoading, isFetching: isCollectionFetching, refetch: refetchCollection } = useCollectionItems();
  const removeFromCollection = useRemoveFromCollection();

  // Land on whichever category actually has something in it, rather than
  // always defaulting to Books (which may be empty for this user) — but only
  // on the initial load, so it doesn't fight a manual tap on an empty tab.
  const hasAutoSelectedCollectionView = useRef(false);
  useEffect(() => {
    if (isCollectionLoading || hasAutoSelectedCollectionView.current) return;
    hasAutoSelectedCollectionView.current = true;
    if (collectionItems.some((i) => i.type === collectionView)) return;
    const firstWithItems = COLLECTION_VIEW_ORDER.find((v) => collectionItems.some((i) => i.type === v));
    if (firstWithItems) setCollectionView(firstWithItems);
  }, [isCollectionLoading, collectionItems, collectionView]);

  const collectionFiltered = useMemo(() => {
    const items = collectionItems.filter((item: CollectionItem) => item.type === collectionView);
    const sorted = [...items];
    if (collectionSort === 'recent') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (collectionSort === 'rating') {
      sorted.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
    } else if (collectionSort === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [collectionItems, collectionView, collectionSort]);

  const loggedFiltered = useMemo(() => {
    const items =
      filter === 'all' ? logged : logged.filter((item: LibraryItem) => item.type === filter);
    const sorted = [...items];
    if (sort === 'recent') {
      sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else if (sort === 'alpha') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    }
    return sorted;
  }, [logged, filter, sort]);

  const activeList = tab === 'watchlist' ? watchlist : loggedFiltered;
  const allSelected = selectMode && selectedIds.size > 0 && selectedIds.size === activeList.length;

  const renderLoggedItem = useCallback(({ item }: { item: LibraryItem }) => (
    <Pressable
      onLongPress={() => { if (!selectMode) enterSelectMode(item.id); }}
      delayLongPress={400}>
      <View>
        <LibCard item={item} />
        {selectMode ? (
          <Pressable
            style={[StyleSheet.absoluteFill, styles.selectOverlay, selectedIds.has(item.id) && styles.selectOverlayActive]}
            onPress={() => toggleSelect(item.id)}>
            <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
              {selectedIds.has(item.id) ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  ), [selectMode, selectedIds, styles]);

  const renderWatchlistItem = useCallback(({ item }: { item: LibraryItem }) => (
    <Pressable
      onLongPress={() => { if (!selectMode && watchlistView === 'mine') enterSelectMode(item.id); }}
      delayLongPress={400}>
      <View>
        <WatchlistCard
          item={item}
          onLogIt={() => { setRatingItem(item); setRatingValue(null); setRatingNote(''); }}
          onRemove={() => removeItem.mutate(item.id, {
            onError: () => Alert.alert('Could not remove', 'Check your connection and try again.'),
          })}
        />
        {selectMode && watchlistView === 'mine' ? (
          <Pressable
            style={[StyleSheet.absoluteFill, styles.selectOverlay, selectedIds.has(item.id) && styles.selectOverlayActive]}
            onPress={() => toggleSelect(item.id)}>
            <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
              {selectedIds.has(item.id) ? <Text style={styles.checkmark}>✓</Text> : null}
            </View>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  ), [selectMode, watchlistView, selectedIds, styles, removeItem]);

  const renderCollectionItem = useCallback(({ item }: { item: CollectionItem }) => (
    <CollectionItemCard
      item={item}
      onPress={() =>
        router.push({
          pathname: '/collection-item-detail-modal',
          params: {
            id: item.id,
            title: item.title,
            sub: item.sub ?? undefined,
            poster: item.poster ?? undefined,
            type: item.type,
            format: item.format ?? undefined,
            userRating: item.user_rating?.toString() ?? undefined,
            externalId: item.external_id ?? undefined,
            mediaType: item.media_type ?? undefined,
            isOwner: '1',
          },
        })
      }
      onRemove={() => removeFromCollection.mutate(item.id, {
        onError: () => Alert.alert('Could not remove', 'Check your connection and try again.'),
      })}
    />
  ), [removeFromCollection]);

  const renderListItem = useCallback(({ item }: { item: ListSummary }) => (
    <ListCard
      list={item}
      Brand={Brand}
      onPress={() =>
        router.push({
          pathname: '/list-detail-modal',
          params: {
            listId: item.id,
            listTitle: item.title,
            listDesc: item.description ?? undefined,
            listPublic: item.is_public ? 'true' : 'false',
          },
        })
      }
      onLongPress={() =>
        router.push({
          pathname: '/create-list-modal',
          params: {
            listId: item.id,
            listTitle: item.title,
            listDesc: item.description ?? undefined,
            listPublic: item.is_public ? 'true' : 'false',
          },
        })
      }
    />
  ), [Brand]);

  // Show a spinner instead of a blank screen while the initial fetch runs.
  if (isLoading && logged.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ActivityIndicator style={{ flex: 1 }} color={Brand.trust} />
      </SafeAreaView>
    );
  }

  // Without this, a failed fetch renders the empty state — which reads as
  // "your library is empty" rather than "we couldn't load it".
  if (isError && logged.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <QueryErrorState title="Couldn't load your library" onRetry={() => refetch()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.tabRow}>
          <Pressable
            style={[styles.tab, tab === 'logged' && styles.tabActive]}
            onPress={() => handleTabChange('logged')}
            accessibilityRole="button"
            accessibilityLabel="Logged">
            <Text style={[styles.tabText, tab === 'logged' && styles.tabTextActive]}>
              📚 Logged
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'watchlist' && styles.tabActive]}
            onPress={() => handleTabChange('watchlist')}
            accessibilityRole="button"
            accessibilityLabel="Watchlist">
            <Text style={[styles.tabText, tab === 'watchlist' && styles.tabTextActive]}>
              🔖 Watchlist
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'collection' && styles.tabActive]}
            onPress={() => handleTabChange('collection')}
            accessibilityRole="button"
            accessibilityLabel="Collection">
            <Text style={[styles.tabText, tab === 'collection' && styles.tabTextActive]}>
              📦 Collection
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, tab === 'lists' && styles.tabActive]}
            onPress={() => handleTabChange('lists')}
            accessibilityRole="button"
            accessibilityLabel="Lists">
            <Text style={[styles.tabText, tab === 'lists' && styles.tabTextActive]}>
              📋 Lists
            </Text>
          </Pressable>
        </View>
      </View>

      {tab === 'logged' ? (
        <FlatList
          key="logged"
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
              <FilterChips value={filter} onChange={setFilter} />
              <View style={{ height: 12 }} />
              <SortRow value={sort} onChange={setSort} />
            </View>
          }
          renderItem={renderLoggedItem}
          ItemSeparatorComponent={LibItemSeparator}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>🎬</Text>
                <Text style={styles.emptyTitle}>Nothing to see here — yet.</Text>
                <Text style={styles.emptyBody}>Start logging films, shows, books, and games to build your feed.</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'log' } })} accessibilityRole="button" accessibilityLabel="Log something">
                  <Text style={styles.emptyBtnText}>Log something →</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      ) : tab === 'watchlist' ? (
        <FlatList
          key="watchlist"
          contentContainerStyle={styles.content}
          data={watchlistView === 'mine' ? watchlist : watchlistView === 'friends' ? friendRecItems : friendWatchlistItems}
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
                  onPress={() => setWatchlistView('mine')}
                  accessibilityRole="button"
                  accessibilityLabel="My Watchlist">
                  <Text style={[styles.subToggleText, watchlistView === 'mine' && styles.subToggleTextActive]}>
                    🔖 My Watchlist
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.subToggle, watchlistView === 'friends' && styles.subToggleActive]}
                  onPress={() => setWatchlistView('friends')}
                  accessibilityRole="button"
                  accessibilityLabel="From Friends">
                  <Text style={[styles.subToggleText, watchlistView === 'friends' && styles.subToggleTextActive]}>
                    💌 From Friends{friendRecItems.length ? ` ${friendRecItems.length}` : ''}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.subToggle, watchlistView === 'their-watchlist' && styles.subToggleActive]}
                  onPress={() => setWatchlistView('their-watchlist')}
                  accessibilityRole="button"
                  accessibilityLabel="Their Lists">
                  <Text style={[styles.subToggleText, watchlistView === 'their-watchlist' && styles.subToggleTextActive]}>
                    👀 Their Lists{friendWatchlistItems.length ? ` ${friendWatchlistItems.length}` : ''}
                  </Text>
                </Pressable>
              </View>
              {watchlistView === 'mine' ? (
                <Pressable
                  style={styles.addBtn}
                  onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}
                  accessibilityRole="button"
                  accessibilityLabel="Add something to your watchlist">
                  <Text style={styles.addBtnText}>+ Add something to your watchlist</Text>
                </Pressable>
              ) : null}
            </View>
          }
          renderItem={renderWatchlistItem}
          ItemSeparatorComponent={LibItemSeparator}
          ListEmptyComponent={
            !isLoading ? (
              watchlistView === 'mine' ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>🍿</Text>
                  <Text style={styles.emptyTitle}>We're gonna need a bigger watchlist.</Text>
                  <Text style={styles.emptyBody}>Add films, shows, books, and games you want to get to.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })} accessibilityRole="button" accessibilityLabel="Add something to watchlist">
                    <Text style={styles.emptyBtnText}>Add something →</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>📬</Text>
                  <Text style={styles.emptyTitle}>E.T. phone home.</Text>
                  <Text style={styles.emptyBody}>Or just ask a friend to send you a rec — it'll show up here automatically.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push('/discover-people-modal')} accessibilityRole="button" accessibilityLabel="Find friends">
                    <Text style={styles.emptyBtnText}>Find friends →</Text>
                  </Pressable>
                </View>
              )
            ) : null
          }
        />
      ) : tab === 'collection' ? (
        <FlatList
          key="collection"
          contentContainerStyle={styles.content}
          data={collectionFiltered}
          keyExtractor={(item: CollectionItem) => item.id}
          numColumns={4}
          columnWrapperStyle={styles.collectionGridRow}
          refreshControl={
            <RefreshControl
              refreshing={isCollectionFetching && !isCollectionLoading}
              onRefresh={refetchCollection}
              tintColor={Brand.trust}
            />
          }
          ListHeaderComponent={
            <View>
              <Pressable style={styles.collectionSearchRow} onPress={() => router.push('/collection-add-modal')} accessibilityRole="button" accessibilityLabel="Search and add to your collection">
                <SymbolView name="magnifyingglass" size={15} tintColor="#999" style={{ width: 16, height: 16, marginRight: 8 }} />
                <Text style={styles.collectionSearchPlaceholder}>Search & add to your collection…</Text>
                <Pressable
                  style={styles.collectionScanBtn}
                  hitSlop={16}
                  onPress={() => router.push('/collection-scan-modal')}
                  accessibilityRole="button"
                  accessibilityLabel="Scan to add to collection">
                  <Text style={styles.collectionScanBtnIcon}>📷</Text>
                </Pressable>
              </Pressable>
              <View style={styles.subToggleRow6}>
                {([
                  { view: 'read',    sf: 'books.vertical',    label: 'Books'    },
                  { view: 'watch',   sf: 'film',              label: 'Movies'   },
                  { view: 'tv',      sf: 'tv',                label: 'TV'       },
                  { view: 'listen',  sf: 'music.note',        label: 'Music'    },
                  { view: 'play',    sf: 'gamecontroller',    label: 'Games'    },
                  { view: 'podcast', sf: 'mic',               label: 'Podcasts' },
                ] as const).map(({ view, sf, label }) => {
                  const count = collectionItems.filter((i) => i.type === view).length;
                  const active = collectionView === view;
                  return (
                    <Pressable
                      key={view}
                      style={[styles.subToggle6, active && styles.subToggleActive]}
                      onPress={() => setCollectionView(view)}
                      accessibilityRole="button"
                      accessibilityLabel={label}>
                      <SymbolView
                        name={sf as any}
                        size={15}
                        tintColor={active ? '#fff' : Brand.muted}
                        style={styles.subToggleIcon}
                      />
                      <Text style={[styles.subToggleLabel, active && styles.subToggleTextActive]}>
                        {label}
                      </Text>
                      <Text style={[styles.subToggleCount, active && styles.subToggleCountActive]}>
                        {count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.sortRow}>
                <Text style={styles.sortLabel}>Organize</Text>
                {COLLECTION_SORT_OPTIONS.map((opt) => {
                  const active = collectionSort === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setCollectionSort(opt.value)}
                      style={[styles.sortBtn, active && styles.sortBtnActive]}
                      accessibilityRole="button"
                      accessibilityLabel={opt.label}>
                      <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          }
          renderItem={renderCollectionItem}
          ListEmptyComponent={
            !isCollectionLoading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>{COLLECTION_EMPTY[collectionView].emoji}</Text>
                <Text style={styles.emptyTitle}>{COLLECTION_EMPTY[collectionView].title}</Text>
                <Text style={styles.emptyBody}>{COLLECTION_EMPTY[collectionView].body}</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'log' } })} accessibilityRole="button" accessibilityLabel="Log something">
                  <Text style={styles.emptyBtnText}>Log something →</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      ) : (
        <FlatList
          key="lists"
          contentContainerStyle={styles.content}
          data={listsData}
          keyExtractor={(l: ListSummary) => l.id}
          refreshControl={
            <RefreshControl
              refreshing={isListsFetching && !isListsLoading}
              onRefresh={refetchLists}
              tintColor={Brand.trust}
            />
          }
          ListHeaderComponent={
            <Pressable
              style={styles.addBtn}
              onPress={() => router.push('/create-list-modal')}>
              <Text style={styles.addBtnText}>+ Create a new list</Text>
            </Pressable>
          }
          renderItem={renderListItem}
          ListEmptyComponent={
            !isListsLoading ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyEmoji}>📋</Text>
                <Text style={styles.emptyTitle}>Your first list awaits.</Text>
                <Text style={styles.emptyBody}>Group your favourite films, books, or games into shareable lists — like Letterboxd but for everything.</Text>
                <Pressable style={styles.emptyBtn} onPress={() => router.push('/create-list-modal')}>
                  <Text style={styles.emptyBtnText}>Create a list →</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
      {/* Multi-select action bar */}
      {selectMode ? (
        <View style={styles.selectBar}>
          <View style={styles.selectBarTop}>
            <Pressable onPress={exitSelectMode} hitSlop={16} style={styles.selectBarCancel}>
              <Text style={styles.selectBarCancelText}>Cancel</Text>
            </Pressable>
            <Text style={styles.selectBarCount}>
              {selectedIds.size} selected
            </Text>
            <Pressable
              hitSlop={16}
              onPress={() =>
                setSelectedIds(allSelected ? new Set() : new Set(activeList.map((i) => i.id)))
              }>
              <Text style={styles.selectBarAll}>
                {allSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          </View>
          <Pressable
            style={[styles.selectDeleteBtn, selectedIds.size === 0 && styles.selectDeleteBtnDisabled]}
            disabled={selectedIds.size === 0 || bulkRemoveItems.isPending}
            onPress={handleBulkDelete}>
            <Text style={styles.selectDeleteText}>
              {bulkRemoveItems.isPending ? 'Removing…' : `Remove ${selectedIds.size} ${selectedIds.size === 1 ? 'item' : 'items'}`}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Inline rate-and-log sheet */}
      <Modal
        visible={!!ratingItem}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingItem(null)}>
        <Pressable style={styles.rateOverlay} onPress={() => setRatingItem(null)} />
        <View style={styles.rateSheet}>
          {ratingItem ? (
            <>
              <View style={styles.rateItemRow}>
                {ratingItem.poster ? (
                  <Image source={{ uri: ratingItem.poster }} style={styles.ratePoster} contentFit="cover" cachePolicy="memory-disk" recyclingKey={ratingItem.poster} />
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rateTitle} numberOfLines={2}>{ratingItem.title}</Text>
                  {ratingItem.sub ? <Text style={styles.rateSub} numberOfLines={1}>{ratingItem.sub}</Text> : null}
                </View>
              </View>
              <Text style={styles.rateLabel}>Your rating</Text>
              <RatingPicker
                value={ratingValue ?? 0}
                iconStyle={(profile?.rating_icon as RatingIconStyle) ?? 'stars'}
                onChange={(v) => setRatingValue(v === 0 ? null : v)}
                size={36}
              />
              <TextInput
                style={styles.rateNote}
                placeholder="Add a note (optional)"
                placeholderTextColor={Brand.muted}
                value={ratingNote}
                onChangeText={setRatingNote}
                multiline
              />
              <Pressable
                style={[styles.rateLogBtn, (ratingValue === null || rateItem.isPending || createPost.isPending) && styles.rateLogBtnDisabled]}
                disabled={ratingValue === null || rateItem.isPending || createPost.isPending}
                onPress={async () => {
                  if (ratingValue === null || !ratingItem) return;
                  try {
                    await rateItem.mutateAsync({
                      id: ratingItem.id,
                      rating: ratingValue,
                      title: ratingItem.title,
                      type: ratingItem.type,
                      sub: ratingItem.sub ?? null,
                      poster: ratingItem.poster ?? null,
                      externalId: ratingItem.external_id ?? null,
                      mediaType: ratingItem.media_type ?? null,
                      extRating: ratingItem.ext_rating ?? null,
                    });
                    await createPost.mutateAsync({
                      type: ratingItem.type,
                      title: ratingItem.title,
                      sub: ratingItem.sub ?? undefined,
                      poster: ratingItem.poster ?? undefined,
                      rating: ratingValue,
                      note: ratingNote || undefined,
                      externalId: ratingItem.external_id ?? undefined,
                      mediaType: ratingItem.media_type ?? undefined,
                      extRating: ratingItem.ext_rating ?? undefined,
                      visibility: 'everyone',
                    });
                    setRatingItem(null);
                  } catch {
                    Alert.alert('Could not save', 'Something went wrong. Check your connection and try again.');
                  }
                }}>
                {rateItem.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.rateLogBtnText}>Log it →</Text>
                )}
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  header: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two },
  content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six, paddingTop: 7 },
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
  tabActive: { backgroundColor: Brand.trust },
  tabText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted },
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
  subToggleRow6: {
    flexDirection: 'row',
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
    gap: 3,
  },
  subToggle6: { flex: 1, paddingVertical: 7, borderRadius: 10, alignItems: 'center' },
  subToggle: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center' },
  subToggleActive: { backgroundColor: Brand.trust },
  subToggleIcon: { width: 19, height: 19 },
  subToggleLabel: { fontFamily: BrandFonts.syneBold, fontSize: 8.5, color: Brand.muted, marginTop: 1 },
  subToggleText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
  subToggleTextActive: { color: '#fff' },
  subToggleCount: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted, marginTop: 1 },
  subToggleCountActive: { color: 'rgba(255,255,255,0.75)' },
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
  collectionSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.card,
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 6,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  collectionSearchIcon: { fontSize: 15, marginRight: 8 },
  collectionSearchPlaceholder: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 14.5,
    fontFamily: BrandFonts.interRegular,
    color: Brand.muted,
  },
  collectionScanBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Brand.trust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionScanBtnIcon: { fontSize: 14 },
  collectionGridRow: { gap: 10, marginBottom: 10 },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sortLabel: { fontSize: 12.5, color: Brand.muted, fontFamily: BrandFonts.interRegular, marginRight: 2 },
  sortBtn: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  sortBtnActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
  sortBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
  sortBtnTextActive: { color: '#fff' },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    color: Brand.muted,
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.6,
  },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
  emptyEmoji: { fontSize: 40, marginBottom: 12 },
  emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontFamily: BrandFonts.interRegular, fontSize: 13.6, color: Brand.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  emptyBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 22 },
  emptyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },

  // Multi-select
  selectOverlay: {
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.04)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    padding: 8,
  },
  selectOverlayActive: { backgroundColor: 'rgba(99,102,241,0.12)' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Brand.muted,
    backgroundColor: Brand.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: Brand.trust, borderColor: Brand.trust },
  checkmark: { color: '#fff', fontSize: 13, fontFamily: BrandFonts.syneBold, lineHeight: 16 },
  selectBar: {
    backgroundColor: Brand.card,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
    paddingHorizontal: Spacing.three,
    paddingTop: 12,
    paddingBottom: 20,
    gap: 10,
  },
  selectBarTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectBarCancel: { paddingVertical: 4 },
  selectBarCancelText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
  selectBarCount: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14, color: Brand.ink },
  selectBarAll: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
  selectDeleteBtn: {
    backgroundColor: Brand.danger,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  selectDeleteBtnDisabled: { opacity: 0.4 },
  selectDeleteText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },

  // Inline rate-and-log modal
  rateOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  rateSheet: {
    backgroundColor: Brand.paper,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  rateItemRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  ratePoster: { width: 52, height: 72, borderRadius: 10, backgroundColor: Brand.border },
  rateTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink, lineHeight: 21 },
  rateSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
  rateLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  rateNote: {
    borderWidth: 1.5,
    borderColor: Brand.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: BrandFonts.interRegular,
    color: Brand.ink,
    backgroundColor: Brand.card,
    minHeight: 52,
    textAlignVertical: 'top',
  },
  rateLogBtn: {
    backgroundColor: Brand.trust,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  rateLogBtnDisabled: { opacity: 0.45 },
  rateLogBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
