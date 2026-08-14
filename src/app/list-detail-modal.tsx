import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { ActionSheetIOS, Alert, FlatList, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  useDeleteList,
  useListCommentCount,
  useListItems,
  useListLikeState,
  useRemoveFromList,
  useSaveList,
  useToggleListLike,
  type ListItem,
} from '@/features/lists/api';
import { useBrand } from '@/hooks/use-brand';
import { useProfile } from '@/features/profile/api';
import { useSession } from '@/hooks/use-session';

export default function ListDetailModal() {
  const { listId, listTitle, listDesc, listPublic, listOwnerId } = useLocalSearchParams<{
    listId: string;
    listTitle: string;
    listDesc?: string;
    listPublic?: string;
    listOwnerId?: string;
  }>();

  const { user } = useSession();
  const { data: profile } = useProfile();
  const isOwn = !listOwnerId || listOwnerId === user?.id;
  const isGold = (profile?.verified_tier ?? 0) >= 1;
  const { data: items = [], isLoading } = useListItems(listId);
  const deleteList = useDeleteList();
  const removeItem = useRemoveFromList();
  const saveList = useSaveList();
  const { data: likeState } = useListLikeState(listId);
  const toggleLike = useToggleListLike();
  const { data: commentCount = 0 } = useListCommentCount(listId);
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  function handleOptions() {
    if (Platform.OS !== 'ios') return;

    if (isOwn) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Edit list', 'Share list', 'Delete list'], destructiveButtonIndex: 3, cancelButtonIndex: 0 },
        (idx) => {
          if (idx === 1) {
            router.push({ pathname: '/create-list-modal', params: { listId, listTitle, listDesc, listPublic } });
          }
          if (idx === 2) {
            if (!isGold) {
              router.push({ pathname: '/get-verified-modal' });
              return;
            }
            if (listPublic === 'false') {
              Alert.alert('Private list', 'Make this list public in Edit list before sharing.');
              return;
            }
            router.push({ pathname: '/list-share-modal', params: { listId, listTitle } });
          }
          if (idx === 3) {
            Alert.alert('Delete list', `Delete "${listTitle}"? This cannot be undone.`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                  try { await deleteList.mutateAsync(listId); router.back(); }
                  catch { Alert.alert('Error', 'Could not delete list.'); }
                },
              },
            ]);
          }
        },
      );
    } else {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Save to my lists'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) {
            try {
              await saveList.mutateAsync({ listId, title: listTitle });
              Alert.alert('Saved!', `"${listTitle}" has been added to your lists.`);
            } catch {
              Alert.alert('Error', 'Could not save list. Try again.');
            }
          }
        },
      );
    }
  }

  function handleItemOptions(item: ListItem) {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Remove from list'], destructiveButtonIndex: 1, cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) {
            try { await removeItem.mutateAsync(item.id); }
            catch { Alert.alert('Error', 'Could not remove item.'); }
          }
        },
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.navigate({ pathname: '/(tabs)/profile', params: { initialTab: 'watchlist' } })} hitSlop={12}>
          <SymbolView name="chevron.left" size={20} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{listTitle}</Text>
          {listPublic === 'false' && <Text style={styles.privateBadge}>Private</Text>}
        </View>
        <Pressable onPress={handleOptions} hitSlop={12}>
          <SymbolView name="ellipsis" size={20} tintColor={Brand.ink} type="monochrome" />
        </Pressable>
      </View>

      {/* Like + comment bar — only show on public lists */}
      {listPublic !== 'false' && (
        <View style={styles.socialBar}>
          <Pressable
            style={styles.socialBtn}
            onPress={() => likeState && toggleLike.mutate({ listId, liked: likeState.liked })}
            hitSlop={10}>
            <SymbolView
              name={likeState?.liked ? 'heart.fill' : 'heart'}
              size={18}
              tintColor={likeState?.liked ? '#e05' : Brand.muted}
              type="monochrome"
            />
            {(likeState?.count ?? 0) > 0 && (
              <Text style={[styles.socialCount, likeState?.liked && styles.socialCountActive]}>
                {likeState!.count}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={styles.socialBtn}
            onPress={() => router.push({ pathname: '/list-comments-modal', params: { listId, listTitle } })}
            hitSlop={10}>
            <SymbolView name="bubble.left" size={18} tintColor={Brand.muted} type="monochrome" />
            {commentCount > 0 && (
              <Text style={styles.socialCount}>{commentCount}</Text>
            )}
          </Pressable>
        </View>
      )}

      {/* Add items bar — own lists only */}
      {isOwn && (
        <Pressable
          style={styles.addBar}
          onPress={() => router.push({ pathname: '/pick-for-list-modal', params: { listId, listTitle } })}>
          <SymbolView name="plus" size={13} tintColor={Brand.trust} style={{ width: 14, height: 14 }} />
          <Text style={styles.addBarText}>Search &amp; add items</Text>
        </Pressable>
      )}

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        style={styles.scroll}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          listDesc ? <Text style={styles.desc}>{listDesc}</Text> : null
        }
        ListEmptyComponent={
          isLoading ? null : (
            <View style={styles.empty}>
              <SymbolView name="list.bullet" size={40} tintColor={Brand.border} type="monochrome" />
              <Text style={styles.emptyTitle}>No items yet</Text>
              <Pressable
                style={styles.emptyBtn}
                onPress={() => router.push({ pathname: '/pick-for-list-modal', params: { listId, listTitle } })}>
                <Text style={styles.emptyBtnText}>+ Search &amp; add items</Text>
              </Pressable>
            </View>
          )
        }
        renderItem={({ item, index }) => (
          <Pressable style={styles.item} onLongPress={() => handleItemOptions(item)}>
            <Text style={styles.itemNum}>{index + 1}</Text>
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPlaceholder]} />
            )}
            <View style={styles.itemInfo}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              {!!item.sub && <Text style={styles.itemSub} numberOfLines={1}>{item.sub}</Text>}
            </View>
            <Pressable onPress={() => handleItemOptions(item)} hitSlop={10} style={styles.itemMore}>
              <SymbolView name="ellipsis" size={16} tintColor={Brand.muted} type="monochrome" />
            </Pressable>
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      gap: 12,
    },
    headerCenter: { flex: 1, alignItems: 'center' },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 17, color: Brand.ink },
    privateBadge: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 10,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 2,
    },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    list: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingBottom: 40 },
    desc: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
      lineHeight: 20,
      paddingVertical: 14,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: 12,
    },
    itemNum: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      width: 22,
      textAlign: 'right',
    },
    poster: {
      width: 44,
      height: 66,
      borderRadius: 6,
      backgroundColor: Brand.border,
    },
    posterPlaceholder: { backgroundColor: Brand.border },
    itemInfo: { flex: 1 },
    itemTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink, marginBottom: 2 },
    itemSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    itemMore: { padding: 4 },
    separator: { height: 1, backgroundColor: Brand.border, marginLeft: 22 + 44 + 12 * 2 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 14 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 17, color: Brand.ink },
    emptyBtn: { backgroundColor: Brand.trust, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 24 },
    emptyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    socialBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      paddingHorizontal: Spacing.three,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    socialBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    socialCount: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    socialCountActive: { color: '#e05' },
    addBar: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: Spacing.three, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Brand.border, backgroundColor: Brand.card },
    addBarText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
  });
}
