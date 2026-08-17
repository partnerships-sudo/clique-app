import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActionSheetIOS } from 'react-native';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DiscussionCard } from '@/components/feed/discussion-card';
import { MostReviewedSection } from '@/components/feed/most-reviewed-section';
import { BrandFonts, TypeColorsLight, type BrandPalette, type EntryType } from '@/constants/theme';
import { type FeedFilterValue, useThreadSearch } from '@/features/feed/api';
import { type DiscussionType, useDiscussionSearch, useTrendingDiscussions, usePersonalizedRooms, useFollowedRooms, useSavedDiscussions, type PersonalizedRoom } from '@/features/discussions/api';
import { useContentSearch } from '@/features/search/api';
import { track, Events } from '@/features/analytics/api';
import { useSession } from '@/hooks/use-session';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { data: contentResults = [], isLoading: cLoading } = useContentSearch(query);
  const TypeColors = useTypeColors();
  const { user } = useSession();

  const isLoading = tLoading || dLoading || cLoading;
  const hasResults = threads.length > 0 || discussions.length > 0 || contentResults.length > 0;

  // Fire once per settled query (not while still loading)
  const trackedQuery = useRef('');
  useEffect(() => {
    if (isLoading || query.trim().length < 2) return;
    if (trackedQuery.current === query) return;
    trackedQuery.current = query;
    const resultsCount = threads.length + discussions.length + contentResults.length;
    track(user?.id, Events.SEARCH_PERFORMED, {
      query,
      results_count: resultsCount,
      has_results: resultsCount > 0,
    });
  }, [isLoading, query, threads.length, discussions.length, contentResults.length, user?.id]);

  if (isLoading) return <ActivityIndicator style={{ marginTop: 12 }} />;
  if (!hasResults && query.trim().length >= 2) {
    return (
      <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
        <Text style={[styles.searchEmpty, { color: Brand.muted }]}>Nothing found for "{query}"</Text>
      </View>
    );
  }
  if (!hasResults) return null;

  // Group discussions that share the same content room
  const roomMap = new Map<string, { externalId: string; mediaType: string; title: string; poster: string | null; count: number }>();
  const standaloneDiscussions: typeof discussions = [];

  for (const d of discussions) {
    if (d.content_external_id && d.content_media_type && d.content_title) {
      const key = `${d.content_external_id}|${d.content_media_type}`;
      if (roomMap.has(key)) {
        roomMap.get(key)!.count += 1;
      } else {
        roomMap.set(key, {
          externalId: d.content_external_id,
          mediaType: d.content_media_type,
          title: d.content_title,
          poster: d.content_poster ?? null,
          count: 1,
        });
      }
    } else {
      standaloneDiscussions.push(d);
    }
  }

  const rooms = [...roomMap.values()];

  // TMDB results that don't already have a discussion room entry.
  // Also deduplicate by normalized title so movie + TV variants of the same
  // name don't both appear (prefer the entry with a poster, then the first).
  const roomTitles = new Set([...roomMap.values()].map((r) => r.title.toLowerCase()));
  const seenTmdbTitles = new Set<string>();
  const tmdbItems = contentResults
    .filter((c) => !roomMap.has(`${c.externalId}|${c.mediaType}`))
    .filter((c) => {
      const norm = c.title.toLowerCase();
      if (roomTitles.has(norm) || seenTmdbTitles.has(norm)) return false;
      seenTmdbTitles.add(norm);
      return true;
    })
    .map((c) => ({ kind: 'room' as const, ...c, count: 0 }));

  const allItems = [
    ...rooms.map((r) => ({ kind: 'room' as const, ...r })),
    ...tmdbItems,
    ...standaloneDiscussions.map((d) => ({ kind: 'discussion' as const, ...d })),
    ...threads.map((t) => ({ kind: 'thread' as const, ...t })),
  ];

  return (
    <View style={[styles.searchResults, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
      {allItems.map((row, i) => {
        const isLast = i === allItems.length - 1;
        const sep = !isLast && { borderBottomWidth: 0.5, borderBottomColor: Brand.border };

        if (row.kind === 'room') {
          const tcKey = row.mediaType === 'movie' || row.mediaType === 'tv' ? 'watch'
            : row.mediaType === 'book' ? 'read'
            : row.mediaType === 'game' ? 'play'
            : row.mediaType === 'album' ? 'listen'
            : row.mediaType === 'podcast' ? 'podcast' : null;
          const typeColors = tcKey ? (TypeColors as any)[tcKey] : { color: '#6B7280', bg: '#F3F4F6' };
          const mediaLabel = DISCUSSION_TYPE_LABELS[tcKey ?? ''] ?? row.mediaType;
          return (
            <Pressable
              key={`room-${row.externalId}`}
              style={[styles.srRow, sep]}
              onPress={() => router.push({
                pathname: '/content-room-modal',
                params: { externalId: row.externalId, mediaType: row.mediaType, title: row.title, poster: row.poster ?? '' },
              })}>
              {row.poster ? (
                <Image source={{ uri: row.poster }} style={styles.srPoster} resizeMode="cover" />
              ) : (
                <View style={[styles.srThumb, { backgroundColor: typeColors.bg, justifyContent: 'center', alignItems: 'center' }]}>
                  <SymbolView name="film" size={16} tintColor={typeColors.color} type="monochrome" style={{ width: 16, height: 16 }} />
                </View>
              )}
              <View style={styles.srBody}>
                <Text style={[styles.srType, { color: typeColors.color }]}>{mediaLabel.toUpperCase()} · ROOM</Text>
                <Text style={[styles.srTitle, { color: Brand.ink }]} numberOfLines={1}>{row.title}</Text>
                <Text style={[styles.srCount, { color: row.count === 0 ? Brand.trust : Brand.muted }]}>
                  {row.count === 0 ? 'No discussions yet · Start one' : `${row.count} ${row.count === 1 ? 'discussion' : 'discussions'}`}
                </Text>
              </View>
              <SymbolView name="chevron.right" size={14} tintColor={Brand.border} type="monochrome" style={{ width: 14, height: 14 }} />
            </Pressable>
          );
        }

        if (row.kind === 'discussion') {
          const typeColors = (TypeColors as any)[row.type] ?? { color: '#6B7280', bg: '#F3F4F6' };
          const typeLabel = DISCUSSION_TYPE_LABELS[row.type] ?? row.type;
          return (
            <Pressable
              key={`d-${row.id}`}
              style={[styles.srRow, sep]}
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

        // thread (chat room)
        const type = TYPE_MAP[row.post_type];
        const colors = type ? TypeColors[type] : TypeColorsLight.watch;
        return (
          <Pressable
            key={`t-${row.title}-${i}`}
            style={[styles.srRow, sep]}
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

function PersonalizedRoomRow({ room, Brand }: { room: PersonalizedRoom; Brand: ReturnType<typeof useBrand> }) {
  const TypeColors = useTypeColors();
  const tcKey = room.mediaType === 'movie' || room.mediaType === 'tv' ? 'watch'
    : room.mediaType === 'book' ? 'read'
    : room.mediaType === 'game' ? 'play'
    : room.mediaType === 'album' ? 'listen'
    : room.mediaType === 'podcast' ? 'podcast' : null;
  const typeColors = tcKey ? (TypeColors as any)[tcKey] : { color: '#6B7280', bg: '#F3F4F6' };

  return (
    <View style={styles.roomSection}>
      {/* Room header — tappable to open content room */}
      <Pressable
        style={styles.roomHeader}
        onPress={() => router.push({
          pathname: '/content-room-modal',
          params: { externalId: room.externalId, mediaType: room.mediaType, title: room.contentTitle, poster: room.contentPoster ?? '' },
        })}>
        <View style={styles.roomHeaderLeft}>
          {room.contentPoster ? (
            <Image source={{ uri: room.contentPoster }} style={styles.roomPoster} resizeMode="cover" />
          ) : (
            <View style={[styles.roomPoster, { backgroundColor: typeColors.bg }]} />
          )}
          <View style={styles.roomHeaderText}>
            <Text style={[styles.roomBecause, { color: Brand.muted }]}>Because you logged</Text>
            <Text style={[styles.roomContentTitle, { color: Brand.ink }]} numberOfLines={1}>{room.contentTitle}</Text>
          </View>
        </View>
        <SymbolView name="chevron.right" size={13} tintColor={Brand.muted} type="monochrome" style={{ width: 13, height: 13 }} />
      </Pressable>

      {/* Horizontal scroll of discussion cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomCards}>
        {room.discussions.map((d) => (
          <Pressable
            key={d.id}
            style={[styles.miniCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}
            onPress={() => router.push({ pathname: '/discussion-detail-modal', params: { id: d.id } })}>
            <Text style={[styles.miniTitle, { color: Brand.ink }]} numberOfLines={2}>{d.title}</Text>
            {d.body ? <Text style={[styles.miniBody, { color: Brand.muted }]} numberOfLines={2}>{d.body}</Text> : null}
            <View style={styles.miniFooter}>
              <Text style={[styles.miniMeta, { color: Brand.muted }]}>💬 {d.comment_count}  ↑ {d.upvote_count}</Text>
            </View>
          </Pressable>
        ))}
        <Pressable
          style={[styles.miniCardSeeAll, { backgroundColor: Brand.tlight, borderColor: Brand.border }]}
          onPress={() => router.push({
            pathname: '/content-room-modal',
            params: { externalId: room.externalId, mediaType: room.mediaType, title: room.contentTitle, poster: room.contentPoster ?? '' },
          })}>
          <Text style={[styles.miniSeeAll, { color: Brand.trust }]}>See all →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

export function GlobalView({ filter }: { filter: FeedFilterValue }) {
  const Brand = useBrand();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const isSearching = searchQuery.trim().length >= 2;

  const discussionType = filter === 'all' ? 'all' : filter as DiscussionType;
  const [showAll, setShowAll] = useState(false);
  const [sortMode, setSortMode] = useState<'hot' | 'new' | 'top'>('hot');
  const { data: trendingRaw = [], isLoading: dLoading } = useTrendingDiscussions(showAll ? 50 : 5, discussionType);

  const trending = [...trendingRaw].sort((a, b) => {
    if (sortMode === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sortMode === 'top') return b.upvote_count - a.upvote_count;
    return (b.upvote_count + b.comment_count) - (a.upvote_count + a.comment_count); // hot
  });

  function showSortSheet() {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['Cancel', 'Most Active', 'Newest First', 'Most Upvoted'],
        cancelButtonIndex: 0,
      },
      (i) => {
        if (i === 1) setSortMode('hot');
        if (i === 2) setSortMode('new');
        if (i === 3) setSortMode('top');
      },
    );
  }
  const { data: personalizedRooms = [] } = usePersonalizedRooms();
  const { data: followedRooms = [] } = useFollowedRooms();
  const { data: savedDiscussions = [] } = useSavedDiscussions(4);

  const followedKeys = new Set(followedRooms.map((r) => `${r.externalId}|${r.mediaType}`));
  const unfollowedRooms = personalizedRooms.filter((r) => !followedKeys.has(`${r.externalId}|${r.mediaType}`));

  const hasNoLounges = followedRooms.length === 0;
  const allPersonalizedDiscussions = hasNoLounges
    ? personalizedRooms
        .flatMap((r) => r.discussions.map((d) => ({ ...d, contentTitle: r.contentTitle, contentPoster: r.contentPoster })))
    : [];
  const personalizedDiscussions = showAll ? allPersonalizedDiscussions : allPersonalizedDiscussions.slice(0, 5);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 4 }]} keyboardShouldPersistTaps="handled">
        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={[styles.searchBar, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
            <SymbolView name="magnifyingglass" size={16} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16 }} />
            <TextInput
              style={[styles.searchInput, { color: Brand.ink }]}
              placeholder="Find a lounge…"
              placeholderTextColor={Brand.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
          </View>
          <Pressable onPress={showSortSheet} style={[styles.filterIconBtn, { backgroundColor: Brand.card, borderColor: Brand.border }]} accessibilityRole="button" accessibilityLabel="Sort and filter">
            <SymbolView name="slider.horizontal.3" size={18} tintColor={Brand.muted} type="monochrome" style={{ width: 18, height: 18 }} />
          </Pressable>
        </View>

        {/* Search results overlay */}
        {isSearching && <SearchResults query={searchQuery} Brand={Brand} />}

        {/* Main content — hidden while searching */}
        {!isSearching && (
          <>
            {/* Trending */}
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: Brand.ink }]}>Trending</Text>
              <Pressable onPress={() => setShowAll((v) => !v)}>
                <Text style={[styles.seeAll, { color: Brand.trust }]}>{showAll ? 'Show less' : 'See all'}</Text>
              </Pressable>
            </View>

            {dLoading ? (
              <ActivityIndicator style={{ marginVertical: 20 }} color={Brand.trust} />
            ) : hasNoLounges && personalizedDiscussions.length > 0 ? (
              <>
                {personalizedDiscussions.map((d) => (
                  <DiscussionCard key={d.id} item={d} />
                ))}
              </>
            ) : trending.length === 0 ? (
              <Pressable
                style={[styles.emptyBoard, { backgroundColor: Brand.card, borderColor: Brand.border }]}
                onPress={() => router.push('/create-discussion-modal')}>
                <Text style={styles.emptyBoardIcon}>💬</Text>
                <Text style={[styles.emptyBoardTitle, { color: Brand.ink }]}>No discussions yet</Text>
                <Text style={[styles.emptyBoardSub, { color: Brand.muted }]}>Be the first to start one</Text>
              </Pressable>
            ) : (
              trending.map((d) => <DiscussionCard key={d.id} item={d} />)
            )}

            {/* Your Lounges */}
            {followedRooms.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionTitle, { color: Brand.ink }]}>Your Lounges</Text>
                  <Pressable onPress={() => router.push('/followed-lounges-modal')}>
                    <Text style={[styles.seeAll, { color: Brand.trust }]}>View all</Text>
                  </Pressable>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.followedScroll}>
                  {followedRooms.map((room) => (
                    <Pressable
                      key={`${room.externalId}|${room.mediaType}`}
                      style={[styles.followedCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}
                      onPress={() => router.push({
                        pathname: '/content-room-modal',
                        params: { externalId: room.externalId, mediaType: room.mediaType, title: room.contentTitle, poster: room.contentPoster ?? '' },
                      })}>
                      {room.contentPoster ? (
                        <Image source={{ uri: room.contentPoster }} style={styles.followedPoster} resizeMode="cover" />
                      ) : (
                        <View style={[styles.followedPoster, { backgroundColor: Brand.tlight }]} />
                      )}
                      <View style={styles.followedInfo}>
                        <Text style={[styles.followedRoomTitle, { color: Brand.ink }]} numberOfLines={2}>{room.contentTitle}</Text>
                        <Text style={[styles.followedMeta, { color: Brand.muted }]}>
                          {room.followerCount} {room.followerCount === 1 ? 'follower' : 'followers'}
                        </Text>
                      </View>
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            {/* Saved */}
            {savedDiscussions.length > 0 && (
              <>
                <View style={styles.sectionRow}>
                  <Text style={[styles.sectionTitle, { color: Brand.ink }]}>Saved</Text>
                  <Pressable onPress={() => router.push('/saved-discussions-modal')}>
                    <Text style={[styles.seeAll, { color: Brand.trust }]}>View all</Text>
                  </Pressable>
                </View>
                <View style={styles.savedGrid}>
                  {savedDiscussions.map((d) => (
                    <Pressable
                      key={d.id}
                      style={[styles.savedTile, { backgroundColor: Brand.card, borderColor: Brand.border }]}
                      onPress={() => router.push({ pathname: '/discussion-detail-modal', params: { id: d.id } })}>
                      {d.content_poster ? (
                        <Image source={{ uri: d.content_poster }} style={styles.savedPoster} resizeMode="cover" />
                      ) : (
                        <View style={[styles.savedPoster, { backgroundColor: Brand.tlight, alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ fontSize: 18 }}>💬</Text>
                        </View>
                      )}
                      <Text style={[styles.savedTitle, { color: Brand.ink }]} numberOfLines={1}>{d.title}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* Personalized rooms */}
            {unfollowedRooms.map((room) => (
              <PersonalizedRoomRow key={room.externalId} room={room} Brand={Brand} />
            ))}
          </>
        )}

      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8 },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  searchInput: {
    flex: 1,
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
  },
  filterIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
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
  srRow: {
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
  srPoster: { width: 36, height: 48, borderRadius: 6, flexShrink: 0 },
  srType: { fontFamily: BrandFonts.interMedium, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 1 },
  srTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, marginBottom: 2 },
  srCount: { fontFamily: BrandFonts.interRegular, fontSize: 11 },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 8,
  },
  sectionTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, letterSpacing: -0.3 },
  seeAll: { fontFamily: BrandFonts.syneBold, fontSize: 13 },

  // Floating action bar
  fabRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 6,
  },
  fab: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#6D28D9',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  fabText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
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

  viewMoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    marginBottom: 4,
  },
  viewMoreText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5 },

  // Personalized room rows
  roomSection: { marginTop: 20, gap: 10 },
  roomHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  roomHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  roomPoster: { width: 36, height: 48, borderRadius: 6, flexShrink: 0 },
  roomHeaderText: { flex: 1 },
  roomBecause: { fontFamily: BrandFonts.interRegular, fontSize: 11, marginBottom: 2 },
  roomContentTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15 },
  roomCards: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  miniCard: {
    width: 180,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 6,
    justifyContent: 'space-between',
  },
  miniTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, lineHeight: 18 },
  miniBody: { fontFamily: BrandFonts.interRegular, fontSize: 12, lineHeight: 16, flex: 1 },
  miniFooter: {},
  miniMeta: { fontFamily: BrandFonts.interRegular, fontSize: 11 },
  miniCardSeeAll: {
    width: 100,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniSeeAll: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
  // followed rooms feed
  followedScroll: { flexDirection: 'row', gap: 10, paddingRight: 4, paddingBottom: 4 },
  followedCard: {
    width: 72,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  followedPoster: { width: 72, height: 100, borderRadius: 0, flexShrink: 0 },
  followedInfo: { paddingHorizontal: 6, paddingTop: 5, paddingBottom: 6, gap: 1 },
  followedRoomTitle: { fontFamily: BrandFonts.syneBold, fontSize: 10, lineHeight: 13 },
  followedMeta: { fontFamily: BrandFonts.interRegular, fontSize: 9 },
  savedGrid: { flexDirection: 'row', gap: 8 },
  savedTile: { width: 72, borderRadius: 10, borderWidth: 1, overflow: 'hidden' },
  savedPoster: { width: 72, height: 108 },
  savedTitle: { fontFamily: BrandFonts.syneBold, fontSize: 9, lineHeight: 12, padding: 5 },
});

