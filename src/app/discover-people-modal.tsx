import { router, Stack } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DiscoverUserCard } from '@/components/friends/discover-user-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useDiscoverPeople, useFollow, useSearchUsers, type DiscoverSortBy } from '@/features/follows/api';
import { useBrand } from '@/hooks/use-brand';

const SORT_OPTIONS: { value: DiscoverSortBy; label: string }[] = [
  { value: 'compatibility', label: 'Compatibility' },
  { value: 'mutual', label: 'Mutual Friends' },
  { value: 'recent', label: 'Newest' },
];

export default function DiscoverPeopleModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [sortBy, setSortBy] = useState<DiscoverSortBy>('compatibility');
  const [locationInput, setLocationInput] = useState('');
  const [location, setLocation] = useState('');
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setLocation(locationInput), 400);
    return () => clearTimeout(timer);
  }, [locationInput]);

  const { data: pool, isLoading: poolLoading } = useDiscoverPeople(sortBy, location);
  const { data: keywordResults, isFetching: keywordFetching } = useSearchUsers(keyword);
  const follow = useFollow();

  // Typing a name/username switches the list to a plain keyword search —
  // keeps "search by name" and "browse/sort/filter" from fighting over one
  // query, since they answer different questions.
  const isSearching = keyword.trim().length >= 2;
  const list = isSearching ? (keywordResults ?? []) : (pool ?? []);
  const isLoading = isSearching ? keywordFetching : poolLoading;

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.95],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.topSection} collapsable={false}>
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backBtn}>‹ Back</Text>
            </Pressable>
            <Text style={styles.title}>Discover People</Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.content}>
          <View style={styles.searchRow}>
            <SymbolView name="magnifyingglass" size={15} tintColor="#999" style={{ width: 16, height: 16, marginRight: 8 }} />
            <TextInput
              style={styles.input}
              placeholder="Search by name or username…"
              placeholderTextColor={Brand.muted}
              value={keyword}
              onChangeText={setKeyword}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.searchRow}>
            <Text style={styles.searchIcon}>📍</Text>
            <TextInput
              style={styles.input}
              placeholder="Filter by location…"
              placeholderTextColor={Brand.muted}
              value={locationInput}
              onChangeText={setLocationInput}
            />
          </View>

          {!isSearching ? (
            <View style={styles.sortRow}>
              {SORT_OPTIONS.map((opt) => {
                const active = opt.value === sortBy;
                return (
                  <Pressable
                    key={opt.value}
                    style={[styles.sortBtn, active && styles.sortBtnActive]}
                    onPress={() => setSortBy(opt.value)}>
                    <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]} numberOfLines={1}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color={Brand.trust} style={styles.spinner} />
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <DiscoverUserCard
                profile={item}
                isAdding={follow.isPending && follow.variables?.targetUserId === item.id}
                onFollow={() => follow.mutate({ targetUserId: item.id, isTargetPrivate: item.is_private })}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {isSearching
                  ? `No users found for “${keyword.trim()}”.`
                  : location
                    ? 'No one matches that location yet.'
                    : "You're all caught up — no new people to discover right now."}
              </Text>
            }
          />
        )}
      </SafeAreaView>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    topSection: {},
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.two,
    },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 44 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink },
    headerSpacer: { width: 44 },
    content: { paddingHorizontal: Spacing.three },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderRadius: 26,
      paddingLeft: 16,
      paddingRight: 16,
      marginBottom: 10,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    searchIcon: { fontSize: 15, marginRight: 8 },
    input: {
      flex: 1,
      paddingVertical: 13,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
    },
    sortRow: {
      flexDirection: 'row',
      gap: 6,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 5,
      marginTop: 4,
      marginBottom: Spacing.three,
    },
    sortBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
    sortBtnActive: { backgroundColor: Brand.ink },
    sortBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted },
    sortBtnTextActive: { color: '#fff' },
    spinner: { marginTop: 40 },
    listContent: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
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
