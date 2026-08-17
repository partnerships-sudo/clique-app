import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ListCard } from '@/components/library/list-card';
import { useRemoveLibraryItem, useAddLibraryItem, type LibraryItem } from '@/features/library/api';
import { useLists, useListsByUser, useAddToList } from '@/features/lists/api';
import { supabase } from '@/lib/supabase';
import { AvatarSizes, BrandFonts } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { createStyles } from '../profile-styles';

interface Props {
  watchlist: LibraryItem[];
  isOwnProfile: boolean;
  profileUserId?: string;
  onOpenRating: (item: LibraryItem) => void;
}

interface RecProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

function useRecProfiles(usernames: string[]) {
  const [profiles, setProfiles] = useState<Record<string, RecProfile>>({});

  useEffect(() => {
    if (usernames.length === 0) return;
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('username', usernames)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, RecProfile> = {};
        for (const p of data) map[p.username] = p;
        setProfiles(map);
      });
  }, [usernames.join(',')]);

  return profiles;
}

type WatchlistFilter = 'all' | 'movie' | 'tv' | 'read' | 'play' | 'listen' | 'podcast';
type WatchlistSort = 'recent' | 'alpha';

const CAT_DEFS = [
  { view: 'movie',   sf: 'film',            label: 'Movies'   },
  { view: 'tv',      sf: 'tv',              label: 'TV'       },
  { view: 'read',    sf: 'books.vertical',  label: 'Books'    },
  { view: 'play',    sf: 'gamecontroller',  label: 'Games'    },
  { view: 'podcast', sf: 'mic',             label: 'Podcasts' },
  { view: 'listen',  sf: 'music.note',      label: 'Music'    },
] as const;

function itemMatchesFilter(item: LibraryItem, filter: WatchlistFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'movie') return item.type === 'watch' && item.media_type !== 'tv' && item.media_type !== 'series';
  if (filter === 'tv') return item.type === 'watch' && (item.media_type === 'tv' || item.media_type === 'series');
  return item.type === filter;
}

export function ProfileWatchlistTab({ watchlist, isOwnProfile, profileUserId, onOpenRating }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const local = useMemo(() => createLocalStyles(Brand), [Brand]);
  const removeLibraryItem = useRemoveLibraryItem();
  const addLibraryItem = useAddLibraryItem();
  const addToList = useAddToList();
  const { data: lists = [] } = useLists();
  const { data: friendLists = [] } = useListsByUser(isOwnProfile ? undefined : profileUserId);
  const [filter, setFilter] = useState<WatchlistFilter>('all');
  const [sort, setSort] = useState<WatchlistSort>('recent');

  const visibleItems = useMemo(() => {
    const filtered = watchlist.filter((i) => itemMatchesFilter(i, filter));
    const sorted = [...filtered];
    if (sort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [watchlist, filter, sort]);

  const sortedCats = CAT_DEFS.map((c) => ({
    ...c,
    count: watchlist.filter((i) => itemMatchesFilter(i, c.view as WatchlistFilter)).length,
  })).sort((a, b) => b.count - a.count);

  const recUsernames = useMemo(() => {
    const names = watchlist
      .map((i) => i.rec_from_user_name)
      .filter((n): n is string => !!n);
    return [...new Set(names)];
  }, [watchlist]);

  const recProfiles = useRecProfiles(recUsernames);

  function showItemOptions(item: LibraryItem) {
    const listOptions = lists.map((l) => ({
      text: `Move to "${l.title}"`,
      onPress: async () => {
        try {
          await addToList.mutateAsync({
            list_id: l.id,
            library_item_id: item.id,
            title: item.title,
            sub: item.sub ?? null,
            poster: item.poster ?? null,
            type: item.type ?? null,
          });
          removeLibraryItem.mutate(item.id);
        } catch {
          Alert.alert('Error', 'Could not move to list.');
        }
      },
    }));

    Alert.alert(item.title, 'What would you like to do?', [
      ...listOptions,
      { text: 'Remove from Watchlist', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.tabContent}>
      {isOwnProfile ? (
        <View style={local.actionRow}>
          <Pressable style={[styles.wlAddBtn, { flex: 1 }]} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}>
            <Text style={styles.wlAddBtnText}>+ Watchlist</Text>
          </Pressable>
          <Pressable style={[styles.wlAddBtn, { flex: 1 }]} onPress={() => router.push('/create-list-modal')}>
            <Text style={styles.wlAddBtnText}>+ Create list</Text>
          </Pressable>
        </View>
      ) : null}


      {/* Category filter */}
      {watchlist.length > 0 && (
        <>
          <View style={styles.collCatRow}>
            <Pressable style={[styles.collCatBtn, filter === 'all' && styles.collCatBtnActive]} onPress={() => setFilter('all')}>
              <SymbolView name="square.grid.2x2.fill" size={15} tintColor={filter === 'all' ? Brand.paper : Brand.muted} style={{ width: 18, height: 18 }} />
              <Text style={[styles.collCatLabel, filter === 'all' && styles.collCatLabelActive]}>All</Text>
              <Text style={[styles.collCatCount, filter === 'all' && styles.collCatCountActive]}>{watchlist.length}</Text>
            </Pressable>
            {sortedCats.map(({ view, sf, label, count }) => {
              const active = filter === view;
              return (
                <Pressable key={view} style={[styles.collCatBtn, active && styles.collCatBtnActive]} onPress={() => setFilter(view as WatchlistFilter)}>
                  <SymbolView name={sf as any} size={15} tintColor={active ? Brand.paper : Brand.muted} style={{ width: 18, height: 18 }} />
                  <Text style={[styles.collCatLabel, active && styles.collCatLabelActive]}>{label}</Text>
                  <Text style={[styles.collCatCount, active && styles.collCatCountActive]}>{count}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.collSortRow}>
            <Text style={styles.collSortLabel}>Organize</Text>
            {([{ value: 'recent', label: 'Recent' }, { value: 'alpha', label: 'A–Z' }] as const).map((opt) => {
              const active = sort === opt.value;
              return (
                <Pressable key={opt.value} style={[styles.collSortBtn, active && styles.collSortBtnActive]} onPress={() => setSort(opt.value)}>
                  <Text style={[styles.collSortBtnText, active && styles.collSortBtnTextActive]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>
          {isOwnProfile ? 'Your watchlist is empty — add things you want to get to!' : 'Nothing on their watchlist yet.'}
        </Text>
      ) : (
        <View style={styles.wlGrid}>
          {visibleItems.map((item) => {
            const recProfile = item.rec_from_user_name ? recProfiles[item.rec_from_user_name] : null;
            return (
              <View key={item.id} style={styles.wlGridItem}>
                <Pressable
                  style={styles.wlPosterWrap}
                  onPress={() => router.push({
                    pathname: '/content-detail-modal',
                    params: {
                      title: item.title,
                      type: item.type ?? undefined,
                      poster: item.poster ?? undefined,
                      sub: item.sub ?? undefined,
                      externalId: item.external_id ?? undefined,
                      mediaType: item.media_type ?? undefined,
                    },
                  })}
                  onLongPress={() => isOwnProfile && showItemOptions(item)}
                  delayLongPress={400}>
                  {item.poster ? (
                    <Image source={{ uri: item.poster }} style={styles.wlPoster} resizeMode="cover" />
                  ) : (
                    <View style={[styles.wlPoster, styles.wlPosterFallback]}>
                      <Text style={styles.wlPosterFallbackText} numberOfLines={2}>{item.title}</Text>
                    </View>
                  )}

                  {/* Recommender avatar — tappable, opens their profile */}
                  {item.rec_from_user_name ? (
                    <Pressable
                      style={local.recAvatar}
                      onPress={() => recProfile
                        ? router.push({ pathname: '/friend-profile-modal', params: { userId: recProfile.id } })
                        : undefined
                      }
                      hitSlop={8}>
                      <Avatar
                        name={recProfile?.full_name || item.rec_from_user_name}
                        avatarUrl={recProfile?.avatar_url ?? null}
                        size={AvatarSizes.sm}
                      />
                    </Pressable>
                  ) : null}

                </Pressable>
                {isOwnProfile ? (
                  <Pressable style={styles.wlLogBtn} onPress={() => onOpenRating(item)}>
                    <SymbolView name="checkmark" size={10} tintColor="#fff" style={{ width: 11, height: 11 }} />
                    <Text style={styles.wlLogBtnText}>Log it</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    style={local.addToMyListBtn}
                    onPress={() => addLibraryItem.mutate({ type: item.type, title: item.title, sub: item.sub ?? undefined, poster: item.poster ?? undefined, intent: 'watchlist' })}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Add ${item.title} to watchlist`}>
                    <SymbolView name="plus" size={11} tintColor={Brand.trust} style={{ width: 12, height: 12 }} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Own lists */}
      {isOwnProfile && lists.length > 0 && (
        <View style={local.listsSection}>
          <Text style={local.listsSectionTitle}>My Lists</Text>
          {lists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              Brand={Brand}
              onPress={() => router.push({ pathname: '/list-detail-modal', params: { listId: list.id, listTitle: list.title, listDesc: list.description ?? '', listPublic: String(list.is_public), listOwnerId: list.user_id } })}
            />
          ))}
        </View>
      )}

      {/* Friend's public lists */}
      {!isOwnProfile && friendLists.length > 0 && (
        <View style={local.listsSection}>
          <Text style={local.listsSectionTitle}>Lists</Text>
          {friendLists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              Brand={Brand}
              onPress={() => router.push({ pathname: '/list-detail-modal', params: { listId: list.id, listTitle: list.title, listDesc: list.description ?? '', listPublic: String(list.is_public), listOwnerId: list.user_id } })}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function createLocalStyles(Brand: ReturnType<typeof useBrand>) {
  return StyleSheet.create({
  catRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 4,
    marginBottom: 12,
  },
  catChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
  },
  catChipActive: { backgroundColor: Brand.trust },
  catChipLabel: { fontFamily: BrandFonts.syneBold, fontSize: 8, color: Brand.muted, marginTop: 2 },
  catChipLabelActive: { color: Brand.paper },
  catChipCount: { fontFamily: BrandFonts.interRegular, fontSize: 8, color: Brand.muted, marginTop: 1 },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  editBtnText: {
    fontSize: 13,
    fontFamily: BrandFonts.syneBold,
  },
  addToMyListBtn: {
    alignSelf: 'center',
    marginTop: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: Brand.trust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listsSection: {
    marginTop: 28,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Brand.border,
  },
  listsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  listsSectionTitle: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 17,
    color: Brand.ink,
  },
  listsCreateBtn: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 14,
    color: Brand.trust,
  },
  recAvatar: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Brand.card,
    overflow: 'hidden',
  },
  deleteBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    zIndex: 10,
    backgroundColor: Brand.card,
    borderRadius: 11,
  },
  });
}
