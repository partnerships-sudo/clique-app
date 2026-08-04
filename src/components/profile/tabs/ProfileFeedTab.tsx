import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useCollectionItems, type CollectionItem } from '@/features/collection/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import { CAT_FILTERS, createStyles } from '../profile-styles';

interface Props {
  // kept for API compat but no longer used — feed now sources from collection
  logged?: unknown[];
}

export function ProfileFeedTab(_props: Props) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [catFilter, setCatFilter] = useState<EntryType | 'all'>('all');
  const [feedSort, setFeedSort] = useState<'recent' | 'alpha'>('recent');
  const { items: collectionItems } = useCollectionItems();

  const feedItems = useMemo(() => {
    const items = catFilter === 'all' ? collectionItems : collectionItems.filter((i) => i.type === catFilter || (catFilter === 'watch' && i.type === 'tv'));
    const sorted = [...items];
    if (feedSort === 'alpha') sorted.sort((a, b) => a.title.localeCompare(b.title));
    else sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [collectionItems, catFilter, feedSort]);

  return (
    <View style={styles.tabContent}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={[styles.chipRow, { paddingRight: 16, flexGrow: 1, justifyContent: 'center' }]}>
        {CAT_FILTERS.map((f) => {
          const isActive = catFilter === f.type;
          return (
            <Pressable
              key={f.type}
              style={styles.chipItem}
              onPress={() => setCatFilter(f.type)}>
              <View style={[styles.chip, isActive && { backgroundColor: f.color, borderColor: f.color, shadowOpacity: 0.22, shadowRadius: 10 }]}>
                <SymbolView name={f.sf as any} size={22} tintColor={isActive ? '#fff' : Brand.muted} style={styles.chipIcon} />
              </View>
              <Text style={[styles.chipText, isActive && styles.chipTextActive, isActive && { color: f.color }]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.feedSortRow}>
        <Text style={styles.feedSortLabel}>Sort by</Text>
        {([{ value: 'recent', label: 'Recent' }, { value: 'alpha', label: 'A—Z' }] as const).map((opt) => {
          const isActive = feedSort === opt.value;
          return (
            <Pressable
              key={opt.value}
              style={[styles.feedSortBtn, isActive && styles.feedSortBtnActive]}
              onPress={() => setFeedSort(opt.value)}>
              <Text style={[styles.feedSortBtnText, isActive && styles.feedSortBtnTextActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {feedItems.length === 0 ? (
        <Text style={styles.emptyText}>Nothing logged yet.</Text>
      ) : (
        feedItems.map((item) => (
          <Pressable
            key={item.id}
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
                isOwner: '1',
              },
            })}>
            <CollectionFeedCard item={item} Brand={Brand} />
          </Pressable>
        ))
      )}
    </View>
  );
}

function CollectionFeedCard({ item, Brand }: { item: CollectionItem; Brand: BrandPalette }) {
  const TypeColors = useTypeColors();
  const type = TypeColors[item.type] ?? TypeColors.watch;
  const stars = item.user_rating ? Math.round(item.user_rating) : 0;
  const s = StyleSheet.create({
    card: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 5 },
    poster: { width: 48, height: 64, borderRadius: 8, backgroundColor: Brand.border },
    fallback: { width: 48, height: 64, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    body: { flex: 1, minWidth: 0 },
    title: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginBottom: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 4 },
    stars: { fontSize: 13, color: Brand.warm },
    emptyStars: { fontSize: 13, color: Brand.warm, opacity: 0.2 },
    date: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
  });
  return (
    <View style={s.card}>
      {item.poster ? (
        <Image source={{ uri: item.poster }} style={s.poster} resizeMode="cover" />
      ) : (
        <View style={[s.fallback, { backgroundColor: type.bg }]}>
          <Text style={{ fontSize: 19 }}>{type.icon}</Text>
        </View>
      )}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{item.title}</Text>
        {item.sub ? <Text style={s.sub} numberOfLines={1}>{item.sub}</Text> : null}
        <View style={s.metaRow}>
          <Text style={stars > 0 ? s.stars : s.emptyStars}>
            {stars > 0 ? '★'.repeat(stars) : '★★★★★'}
          </Text>
          {item.created_at ? (
            <Text style={s.date}>{item.created_at.slice(0, 7)}</Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}
