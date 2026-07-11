import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFollowersByUser, useFollowingByUser, type Profile } from '@/features/follows/api';
import { useLibraryItemsByUser, type LibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

type StatsTab = 'logged' | 'followers' | 'following';

export default function ProfileStatsModal() {
  const params = useLocalSearchParams<{ userId: string; tab: string; name: string }>();
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const tab = (params.tab as StatsTab) ?? 'logged';
  const userId = params.userId;
  const [query, setQuery] = useState('');
  const q = query.toLowerCase().trim();

  const { logged, isLoading: loggedLoading } = useLibraryItemsByUser(tab === 'logged' ? userId : undefined);
  const { data: followers, isLoading: followersLoading } = useFollowersByUser(tab === 'followers' ? userId : undefined);
  const { data: following, isLoading: followingLoading } = useFollowingByUser(tab === 'following' ? userId : undefined);

  const isLoading = loggedLoading || followersLoading || followingLoading;

  const filteredLogged = useMemo(
    () => (q ? logged.filter((i) => i.title.toLowerCase().includes(q) || (i.sub ?? '').toLowerCase().includes(q)) : logged),
    [logged, q]
  );
  const filteredFollowers = useMemo(
    () =>
      q
        ? (followers ?? []).filter(
            (p) =>
              (p.full_name ?? '').toLowerCase().includes(q) ||
              (p.username ?? '').toLowerCase().includes(q)
          )
        : (followers ?? []),
    [followers, q]
  );
  const filteredFollowing = useMemo(
    () =>
      q
        ? (following ?? []).filter(
            (p) =>
              (p.full_name ?? '').toLowerCase().includes(q) ||
              (p.username ?? '').toLowerCase().includes(q)
          )
        : (following ?? []),
    [following, q]
  );

  const title = tab === 'logged' ? 'Logged' : tab === 'followers' ? 'Followers' : 'Following';
  const count =
    tab === 'logged' ? filteredLogged.length : tab === 'followers' ? filteredFollowers.length : filteredFollowing.length;

  function openProfile(targetUserId: string) {
    if (targetUserId === user?.id) {
      router.back();
      router.push('/profile');
    } else {
      router.push({ pathname: '/friend-profile-modal', params: { userId: targetUserId } });
    }
  }

  function renderLoggedItem({ item }: { item: LibraryItem }) {
    return (
      <View style={styles.row}>
        {item.poster ? (
          <Image source={{ uri: item.poster }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbFallback]} />
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          {item.sub ? <Text style={styles.rowSub} numberOfLines={1}>{item.sub}</Text> : null}
        </View>
        {item.rating != null ? (
          <Text style={styles.rowRating}>★ {Number(item.rating).toFixed(1)}</Text>
        ) : null}
      </View>
    );
  }

  function renderProfileItem({ item }: { item: Profile }) {
    return (
      <Pressable style={styles.row} onPress={() => openProfile(item.id)}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarFallbackText}>
              {(item.full_name || item.username || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {item.full_name || item.username || 'Unknown'}
          </Text>
          {item.username ? (
            <Text style={styles.rowSub} numberOfLines={1}>@{item.username}</Text>
          ) : null}
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.backBtn}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>
          {title}
          {count > 0 ? <Text style={styles.titleCount}> {count}</Text> : null}
        </Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${title.toLowerCase()}…`}
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {isLoading ? (
        <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
      ) : tab === 'logged' ? (
        <FlatList
          data={filteredLogged}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={renderLoggedItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {q ? 'No results.' : 'Nothing logged yet.'}
            </Text>
          }
        />
      ) : tab === 'followers' ? (
        <FlatList
          data={filteredFollowers}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={renderProfileItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {q ? 'No results.' : 'No followers yet.'}
            </Text>
          }
        />
      ) : (
        <FlatList
          data={filteredFollowing}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={renderProfileItem}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {q ? 'No results.' : 'Not following anyone yet.'}
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
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, marginBottom: 8 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink },
    titleCount: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.muted },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderRadius: 14,
      marginHorizontal: Spacing.three,
      marginBottom: 12,
      paddingLeft: 14,
      paddingRight: 10,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    searchIcon: { fontSize: 14, marginRight: 8 },
    searchInput: {
      flex: 1,
      paddingVertical: 12,
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.ink,
    },
    list: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    sep: { height: 1, backgroundColor: Brand.border },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      gap: 12,
    },
    thumb: { width: 46, height: 62, borderRadius: 8 },
    thumbFallback: { backgroundColor: Brand.tlight },
    avatar: { width: 46, height: 46, borderRadius: 23 },
    avatarFallback: { backgroundColor: Brand.tlight, alignItems: 'center', justifyContent: 'center' },
    avatarFallbackText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    rowInfo: { flex: 1, minWidth: 0 },
    rowTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink },
    rowSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 2 },
    rowRating: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#F4A340' },
    chevron: { fontFamily: BrandFonts.syneBold, fontSize: 20, color: Brand.muted },
    empty: {
      textAlign: 'center',
      paddingVertical: 40,
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
    },
  });
}
