import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { ListCard } from '@/components/library/list-card';
import { useRemoveLibraryItem, useAddLibraryItem, type LibraryItem } from '@/features/library/api';
import { useLists, useListsByUser } from '@/features/lists/api';
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

export function ProfileWatchlistTab({ watchlist, isOwnProfile, profileUserId, onOpenRating }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const local = useMemo(() => createLocalStyles(Brand), [Brand]);
  const [watchlistView, setWatchlistView] = useState<'mine' | 'friends'>('mine');
  const removeLibraryItem = useRemoveLibraryItem();
  const addLibraryItem = useAddLibraryItem();
  const { data: lists = [] } = useLists();
  const { data: friendLists = [] } = useListsByUser(isOwnProfile ? undefined : profileUserId);

  const visibleItems = watchlistView === 'mine' ? watchlist : watchlist.filter((i) => !!i.rec_from_user_name);

  const recUsernames = useMemo(() => {
    const names = watchlist
      .map((i) => i.rec_from_user_name)
      .filter((n): n is string => !!n);
    return [...new Set(names)];
  }, [watchlist]);

  const recProfiles = useRecProfiles(recUsernames);

  function confirmRemove(item: LibraryItem) {
    Alert.alert('Remove from watchlist?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
    ]);
  }

  return (
    <View style={styles.tabContent}>
      {isOwnProfile && (
        <View style={styles.wlToggleRow}>
          <Pressable style={[styles.wlToggleBtn, watchlistView === 'mine' && styles.wlToggleBtnActive]} onPress={() => setWatchlistView('mine')}>
            <Text style={[styles.wlToggleTxt, watchlistView === 'mine' && styles.wlToggleTxtActive]}>My Watchlist</Text>
          </Pressable>
          <Pressable style={[styles.wlToggleBtn, watchlistView === 'friends' && styles.wlToggleBtnActive]} onPress={() => setWatchlistView('friends')}>
            <Text style={[styles.wlToggleTxt, watchlistView === 'friends' && styles.wlToggleTxtActive]}>From Friends</Text>
          </Pressable>
        </View>
      )}

      {isOwnProfile && watchlistView === 'mine' ? (
        <View style={local.actionRow}>
          <Pressable style={[styles.wlAddBtn, { flex: 1 }]} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}>
            <Text style={styles.wlAddBtnText}>+ Watchlist</Text>
          </Pressable>
          <Pressable style={[styles.wlAddBtn, { flex: 1 }]} onPress={() => router.push('/create-list-modal')}>
            <Text style={styles.wlAddBtnText}>+ Create list</Text>
          </Pressable>
        </View>
      ) : null}


      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>
          {!isOwnProfile
            ? 'Nothing on their watchlist yet.'
            : watchlistView === 'mine'
              ? 'Your watchlist is empty — add things you want to get to!'
              : 'No recs yet — when a friend sends you a rec it shows up here automatically.'}
        </Text>
      ) : (
        <View style={styles.wlGrid}>
          {visibleItems.map((item) => {
            const recProfile = item.rec_from_user_name ? recProfiles[item.rec_from_user_name] : null;
            return (
              <View key={item.id} style={styles.wlGridItem}>
                <Pressable style={styles.wlPosterWrap} onLongPress={() => isOwnProfile && confirmRemove(item)} delayLongPress={400}>
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
                    hitSlop={8}>
                    <SymbolView name="plus" size={11} tintColor={Brand.trust} style={{ width: 12, height: 12 }} />
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Own lists */}
      {isOwnProfile && watchlistView === 'mine' && lists.length > 0 && (
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
