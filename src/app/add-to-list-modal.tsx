import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useAddToList, useListMembership, useLists } from '@/features/lists/api';
import { QueryErrorState } from '@/components/query-error-state';
import { useBrand } from '@/hooks/use-brand';

export default function AddToListModal() {
  const { libraryItemId, title, sub, poster, type } = useLocalSearchParams<{
    libraryItemId: string;
    title: string;
    sub?: string;
    poster?: string;
    type?: string;
  }>();

  const { data: lists = [], isLoading: listsLoading, isError: listsError, refetch: refetchLists } = useLists();
  const { data: membership, isLoading: membershipLoading } = useListMembership(libraryItemId);
  const addToList = useAddToList();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const loading = listsLoading || membershipLoading;

  async function toggleList(listId: string) {
    if (membership?.has(listId)) return; // already added — removal done from list detail
    try {
      await addToList.mutateAsync({
        list_id: listId,
        library_item_id: libraryItemId || null,
        title,
        sub: sub ?? null,
        poster: poster ?? null,
        type: type ?? null,
      });
    } catch {
      Alert.alert('Error', 'Could not add to list.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Add to List</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      {/* Item preview */}
      <View style={styles.preview}>
        <Text style={styles.previewTitle} numberOfLines={1}>{title}</Text>
        {!!sub && <Text style={styles.previewSub} numberOfLines={1}>{sub}</Text>}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Brand.trust} />
      ) : listsError ? (
        // Otherwise a failed fetch looks like "you have no lists", and the
        // user makes a duplicate of one they already own.
        <QueryErrorState title="Couldn't load your lists" onRetry={refetchLists} />
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(l) => l.id}
          style={styles.scroll}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>You haven't created any lists yet.</Text>
              <Pressable
                style={styles.createBtn}
                onPress={() => router.replace('/create-list-modal')}>
                <Text style={styles.createBtnText}>Create a list</Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            lists.length > 0 ? (
              <Pressable
                style={styles.newListRow}
                onPress={() => router.push('/create-list-modal')}>
                <View style={[styles.checkCircle, { backgroundColor: Brand.tlight, borderColor: Brand.trust }]}>
                  <SymbolView name="plus" size={14} tintColor={Brand.trust} type="monochrome" />
                </View>
                <Text style={[styles.listName, { color: Brand.trust }]}>New list…</Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => {
            const checked = membership?.has(item.id) ?? false;
            const saving = addToList.isPending && addToList.variables?.list_id === item.id;
            return (
              <Pressable
                style={styles.row}
                onPress={() => toggleList(item.id)}
                disabled={checked || saving}>
                <View style={[styles.checkCircle, checked && styles.checkCircleActive]}>
                  {saving
                    ? <ActivityIndicator size="small" color={Brand.trust} />
                    : checked
                      ? <SymbolView name="checkmark" size={14} tintColor={Brand.trust} type="monochrome" />
                      : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.listName}>{item.title}</Text>
                  <Text style={styles.listCount}>{item.item_count} {item.item_count === 1 ? 'item' : 'items'}</Text>
                </View>
                {!item.is_public && (
                  <Text style={styles.privateLabel}>Private</Text>
                )}
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    done: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    preview: {
      paddingHorizontal: Spacing.three,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    previewTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    previewSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    list: { flexGrow: 1, paddingBottom: 30 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      gap: 14,
    },
    checkCircle: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkCircleActive: { borderColor: Brand.trust, backgroundColor: Brand.tlight },
    listName: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    listCount: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    privateLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.muted },
    separator: { height: 1, backgroundColor: Brand.border, marginLeft: Spacing.three + 26 + 14 },
    newListRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      gap: 14,
    },
    empty: { alignItems: 'center', paddingTop: 60, gap: 16 },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
    createBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 12,
      paddingHorizontal: 20,
      paddingVertical: 10,
    },
    createBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
  });
}
