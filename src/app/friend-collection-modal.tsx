import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CollectionItemCard } from '@/components/library/collection-item-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useCollectionItemsByUser, type CollectionItem } from '@/features/collection/api';
import { useBrand } from '@/hooks/use-brand';

type CollectionView = 'read' | 'watch' | 'tv' | 'listen' | 'play' | 'podcast';
const VIEW_ORDER: CollectionView[] = ['read', 'watch', 'tv', 'listen', 'play', 'podcast'];

export default function FriendCollectionModal() {
  const params = useLocalSearchParams<{ userId: string; name?: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { items, isLoading } = useCollectionItemsByUser(params.userId);
  const [view, setView] = useState<CollectionView>('read');

  // Land on whichever shared category actually has something in it, rather
  // than always defaulting to Books (which may be empty for this friend) —
  // but only on the initial load, so it doesn't fight a manual tap.
  const hasAutoSelectedView = useRef(false);
  useEffect(() => {
    if (isLoading || hasAutoSelectedView.current) return;
    hasAutoSelectedView.current = true;
    if (items.some((i) => i.type === view)) return;
    const firstWithItems = VIEW_ORDER.find((v) => items.some((i) => i.type === v));
    if (firstWithItems) setView(firstWithItems);
  }, [isLoading, items, view]);

  const filtered = items.filter((item: CollectionItem) => item.type === view);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backBtnWrap}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{params.name ?? 'Friend'}&apos;s Collection</Text>
        <View style={{ width: 56 }} />
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={filtered}
          keyExtractor={(item: CollectionItem) => item.id}
          numColumns={4}
          columnWrapperStyle={styles.gridRow}
          ListHeaderComponent={
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.subToggleScroll}
              contentContainerStyle={styles.subToggleRow}>
              {([
                { v: 'read',    label: '📖 Books'    },
                { v: 'watch',   label: '🎬 Movies'   },
                { v: 'tv',      label: '📺 TV'        },
                { v: 'listen',  label: '🎵 Music'    },
                { v: 'play',    label: '🎮 Games'    },
                { v: 'podcast', label: '🎙 Podcasts' },
              ] as const).map(({ v, label }) => (
                <Pressable
                  key={v}
                  style={[styles.subToggle, view === v && styles.subToggleActive]}
                  onPress={() => setView(v)}>
                  <Text style={[styles.subToggleText, view === v && styles.subToggleTextActive]}>
                    {label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          }
          renderItem={({ item }: { item: CollectionItem }) => (
            <CollectionItemCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/content-detail-modal',
                  params: {
                    title: item.title,
                    type: item.type === 'tv' ? 'watch' : item.type === 'podcast' ? 'podcast' : item.type,
                    poster: item.poster ?? undefined,
                    sub: item.sub ?? undefined,
                  },
                })
              }
            />
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {params.name ?? 'This person'} hasn&apos;t shared anything here yet.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: Spacing.three,
    },
    backBtnWrap: { width: 56 },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    content: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    subToggleScroll: { marginBottom: 14 },
    subToggleRow: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 5,
    },
    subToggle: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, alignItems: 'center' },
    subToggleActive: { backgroundColor: Brand.ink },
    subToggleText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    subToggleTextActive: { color: '#fff' },
    gridRow: { gap: 10, marginBottom: 10 },
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
