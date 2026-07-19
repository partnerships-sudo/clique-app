import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useCloseFriendIds } from '@/features/close-friends/api';
import { useReactions } from '@/features/feed/reactions';
import { useBrand } from '@/hooks/use-brand';

export default function PostReactionsModal() {
  const { postId, postTitle } = useLocalSearchParams<{ postId: string; postTitle?: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: closeFriendIds } = useCloseFriendIds();
  const { byPost } = useReactions(postId ? [postId] : []);
  const reactions = postId ? (byPost.get(postId) ?? []) : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <View>
          <View style={styles.titleRow}>
            <SymbolView name="heart.fill" size={18} tintColor="#E84F4F" type="monochrome" />
            <Text style={styles.title}>Hearts</Text>
          </View>
          {postTitle ? <Text style={styles.sub} numberOfLines={1}>{postTitle}</Text> : null}
        </View>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.done}>Done</Text>
        </Pressable>
      </View>

      {reactions.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="heart" size={40} tintColor={Brand.muted} type="monochrome" style={styles.emptyIcon} />
          <Text style={styles.emptyTitle}>No hearts yet</Text>
          <Text style={styles.emptySub}>When your friends react to this post, they'll show up here.</Text>
        </View>
      ) : (
        <FlatList
          data={reactions}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => {
            const isCloseFriend = closeFriendIds?.has(item.user_id) ?? false;
            return (
              <Pressable
                style={styles.row}
                onPress={() => router.push({ pathname: '/friend-profile-modal', params: { userId: item.user_id } })}
                hitSlop={4}>
                <View style={styles.avatarWrap}>
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                  ) : (
                    <Avatar name={item.user_name} size={44} />
                  )}
                  {isCloseFriend ? (
                    <View style={styles.closeFriendDot}>
                      <SymbolView name="heart.fill" size={10} tintColor="#34C759" type="monochrome" />
                    </View>
                  ) : null}
                </View>
                <View style={styles.info}>
                  <Text style={styles.name}>{item.user_name}</Text>
                  {isCloseFriend ? (
                    <Text style={styles.closeFriendLabel}>Close friend</Text>
                  ) : null}
                </View>
                <SymbolView name="heart.fill" size={20} tintColor="#E84F4F" type="monochrome" />
              </Pressable>
            );
          }}
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
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, letterSpacing: -0.3 },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2, maxWidth: 240 },
    done: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    list: { paddingVertical: 6 },
    separator: { height: 1, backgroundColor: Brand.border, marginLeft: 72 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      gap: 12,
    },
    avatarWrap: { position: 'relative' },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    closeFriendDot: {
      position: 'absolute',
      bottom: -2,
      right: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: Brand.paper,
      alignItems: 'center',
      justifyContent: 'center',
    },
    closeFriendDotBadge: { alignItems: 'center', justifyContent: 'center' },
    info: { flex: 1, minWidth: 0 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    closeFriendLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: '#34C759', marginTop: 2 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four },
    emptyIcon: { marginBottom: 12 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 18, color: Brand.ink, marginBottom: 6 },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
  });
}
