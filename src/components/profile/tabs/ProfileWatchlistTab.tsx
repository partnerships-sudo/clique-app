import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Alert, Image, Pressable, Text, View, Vibration } from 'react-native';

import { useRemoveLibraryItem, type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { createStyles } from '../profile-styles';

interface Props {
  watchlist: LibraryItem[];
  unratedLogged: LibraryItem[];
  isOwnProfile: boolean;
  onOpenRating: (item: LibraryItem) => void;
}

export function ProfileWatchlistTab({ watchlist, unratedLogged, isOwnProfile, onOpenRating }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [watchlistView, setWatchlistView] = useState<'mine' | 'friends'>('mine');
  const removeLibraryItem = useRemoveLibraryItem();

  const visibleItems = watchlistView === 'mine' ? watchlist : watchlist.filter((i) => !!i.rec_from_user_name);

  return (
    <View style={styles.tabContent}>
      <View style={styles.wlToggleRow}>
        <Pressable style={[styles.wlToggleBtn, watchlistView === 'mine' && styles.wlToggleBtnActive]} onPress={() => setWatchlistView('mine')}>
          <Text style={[styles.wlToggleTxt, watchlistView === 'mine' && styles.wlToggleTxtActive]}>My Watchlist</Text>
        </Pressable>
        <Pressable style={[styles.wlToggleBtn, watchlistView === 'friends' && styles.wlToggleBtnActive]} onPress={() => setWatchlistView('friends')}>
          <Text style={[styles.wlToggleTxt, watchlistView === 'friends' && styles.wlToggleTxtActive]}>From Friends</Text>
        </Pressable>
      </View>

      {watchlistView === 'mine' ? (
        <Pressable style={styles.wlAddBtn} onPress={() => router.push({ pathname: '/log-modal', params: { intent: 'watchlist' } })}>
          <Text style={styles.wlAddBtnText}>+ Add to watchlist</Text>
        </Pressable>
      ) : null}

      {isOwnProfile && watchlistView === 'mine' && unratedLogged.length > 0 ? (
        <View style={styles.unratedSection}>
          <View style={styles.unratedHeader}>
            <Text style={styles.unratedHeaderTitle}>Rate to add to Collection</Text>
            <Text style={styles.unratedHeaderSub}>You finished these but haven't rated them yet</Text>
          </View>
          <View style={styles.wlGrid}>
            {unratedLogged.map((item) => (
              <View key={item.id} style={styles.wlGridItem}>
                <View style={[styles.wlPosterWrap, styles.unratedPosterWrap]}>
                  {item.poster ? (
                    <Image source={{ uri: item.poster }} style={[styles.wlPoster, styles.unratedPoster]} resizeMode="cover" />
                  ) : (
                    <View style={[styles.wlPoster, styles.wlPosterFallback, styles.unratedPoster]}>
                      <Text style={styles.wlPosterFallbackText} numberOfLines={2}>{item.title}</Text>
                    </View>
                  )}
                </View>
                <Pressable style={styles.wlRateBtn} onPress={() => onOpenRating(item)}>
                  <Text style={styles.wlRateBtnText}>★ Rate it</Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {visibleItems.length === 0 ? (
        <Text style={styles.emptyText}>
          {watchlistView === 'mine'
            ? 'Your watchlist is empty — add things you want to get to!'
            : 'No recs yet — when a friend sends you a rec it shows up here automatically.'}
        </Text>
      ) : (
        <View style={styles.wlGrid}>
          {visibleItems.map((item) => (
            <Pressable
              key={item.id}
              style={styles.wlGridItem}
              onLongPress={() => {
                Vibration.vibrate(40);
                Alert.alert('Remove from watchlist?', item.title, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => removeLibraryItem.mutate(item.id) },
                ]);
              }}
              delayLongPress={500}>
              <View style={styles.wlPosterWrap}>
                {item.poster ? (
                  <Image source={{ uri: item.poster }} style={styles.wlPoster} resizeMode="cover" />
                ) : (
                  <View style={[styles.wlPoster, styles.wlPosterFallback]}>
                    <Text style={styles.wlPosterFallbackText} numberOfLines={2}>{item.title}</Text>
                  </View>
                )}
                {item.rec_from_user_name ? (
                  <View style={styles.wlAvatar}>
                    <Text style={styles.wlAvatarText}>{item.rec_from_user_name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
              <Pressable style={styles.wlLogBtn} onPress={() => onOpenRating(item)}>
                <SymbolView name="checkmark" size={10} tintColor="#fff" style={{ width: 11, height: 11 }} />
                <Text style={styles.wlLogBtnText}>Log it</Text>
              </Pressable>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
