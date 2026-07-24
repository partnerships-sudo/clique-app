import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';

import { useCollectionItems, useCollectionItemsByUser, type CollectionItem } from '@/features/collection/api';
import { useBrand } from '@/hooks/use-brand';
import { createStyles } from '../profile-styles';

type CollectionView = 'all' | 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
type CollectionSort = 'recent' | 'rating' | 'alpha';

const CAT_DEFS = [
  { view: 'read',    sf: 'books.vertical', label: 'Books'    },
  { view: 'watch',   sf: 'film',           label: 'Movies'   },
  { view: 'tv',      sf: 'tv',             label: 'TV'       },
  { view: 'listen',  sf: 'music.note',     label: 'Music'    },
  { view: 'play',    sf: 'gamecontroller', label: 'Games'    },
  { view: 'podcast', sf: 'mic',            label: 'Podcasts' },
] as const;

interface Props {
  isOwnProfile: boolean;
  profileId?: string;
}

export function ProfileCollectionTab({ isOwnProfile, profileId }: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [collectionView, setCollectionView] = useState<CollectionView>('all');
  const [collectionSort, setCollectionSort] = useState<CollectionSort>('recent');

  const ownData = useCollectionItems();
  const friendData = useCollectionItemsByUser(isOwnProfile ? undefined : profileId);
  const { items: collectionItems, isLoading } = isOwnProfile ? ownData : friendData;

  const hasAutoSelected = useRef(false);
  useEffect(() => {
    if (isLoading || hasAutoSelected.current) return;
    hasAutoSelected.current = true;
    if (collectionItems.length > 0) setCollectionView('all');
  }, [isLoading, collectionItems]);

  const collectionFiltered = useMemo(() => {
    const items = collectionView === 'all'
      ? collectionItems
      : collectionItems.filter((i: CollectionItem) => i.type === collectionView);
    const sorted = [...items];
    if (collectionSort === 'recent') sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    else if (collectionSort === 'rating') sorted.sort((a, b) => (b.user_rating ?? 0) - (a.user_rating ?? 0));
    else sorted.sort((a, b) => a.title.localeCompare(b.title));
    return sorted;
  }, [collectionItems, collectionView, collectionSort]);

  const sortedCats = CAT_DEFS.map((c) => ({
    ...c,
    count: collectionItems.filter((i: CollectionItem) => i.type === c.view).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <View style={styles.tabContent}>
      {isOwnProfile ? (
        <Pressable style={styles.collSearchRow} onPress={() => router.push('/collection-add-modal')}>
          <SymbolView name="magnifyingglass" size={14} tintColor={Brand.muted} style={{ width: 16, height: 16, marginRight: 7 }} />
          <Text style={styles.collSearchPlaceholder}>Search & add to your collection…</Text>
          <Pressable style={styles.collScanBtn} hitSlop={16} onPress={() => router.push('/collection-scan-modal')}>
            <SymbolView name="barcode.viewfinder" size={16} tintColor="#fff" style={{ width: 18, height: 18 }} />
          </Pressable>
        </Pressable>
      ) : null}

      <View style={styles.collCatRow}>
        <Pressable
          style={[styles.collCatBtn, collectionView === 'all' && styles.collCatBtnActive]}
          onPress={() => setCollectionView('all')}>
          <SymbolView name="square.grid.2x2.fill" size={15} tintColor={collectionView === 'all' ? '#fff' : Brand.muted} style={{ width: 18, height: 18 }} />
          <Text style={[styles.collCatLabel, collectionView === 'all' && styles.collCatLabelActive]}>All</Text>
          <Text style={[styles.collCatCount, collectionView === 'all' && styles.collCatCountActive]}>{collectionItems.length}</Text>
        </Pressable>
        {sortedCats.map(({ view, sf, label, count }) => {
          const active = collectionView === view;
          return (
            <Pressable key={view} style={[styles.collCatBtn, active && styles.collCatBtnActive]} onPress={() => setCollectionView(view)}>
              <SymbolView name={sf as any} size={15} tintColor={active ? '#fff' : Brand.muted} style={{ width: 18, height: 18 }} />
              <Text style={[styles.collCatLabel, active && styles.collCatLabelActive]}>{label}</Text>
              <Text style={[styles.collCatCount, active && styles.collCatCountActive]}>{count}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.collSortRow}>
        <Text style={styles.collSortLabel}>Organize</Text>
        {([{ value: 'recent', label: 'Recent' }, { value: 'rating', label: 'Rating' }, { value: 'alpha', label: 'A–Z' }] as const).map((opt) => {
          const active = collectionSort === opt.value;
          return (
            <Pressable key={opt.value} style={[styles.collSortBtn, active && styles.collSortBtnActive]} onPress={() => setCollectionSort(opt.value)}>
              <Text style={[styles.collSortBtnText, active && styles.collSortBtnTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {collectionFiltered.length === 0 && !isLoading ? (
        <Text style={styles.emptyText}>Nothing here yet.</Text>
      ) : (
        <View style={styles.collGrid}>
          {collectionFiltered.map((item: CollectionItem) => {
            const stars = item.user_rating ? Math.round(item.user_rating) : 0;
            return (
              <Pressable
                key={item.id}
                style={styles.collGridItem}
                onPress={() => router.push({
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
                    isOwner: isOwnProfile ? '1' : '0',
                  },
                })}>
                {item.poster ? (
                  <Image source={{ uri: item.poster }} style={styles.collGridImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.collGridImg, styles.collGridImgPlaceholder]}>
                    <Text style={styles.collGridImgPlaceholderText} numberOfLines={2}>{item.title}</Text>
                  </View>
                )}
                {stars > 0 ? (
                  <View style={styles.collGridStars}>
                    <Text style={styles.collGridStarText}>{'★'.repeat(stars)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
