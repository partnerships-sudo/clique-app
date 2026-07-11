import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlockMuteSheet } from '@/components/settings/block-mute-sheet';
import { BlockMuteUserRow } from '@/components/settings/block-mute-user-row';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useBlockableUsers, type BlockableUser } from '@/features/blocks/api';
import { useBrand } from '@/hooks/use-brand';

export default function BlockedMutedAccountsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [query, setQuery] = useState('');
  const { data: users, isLoading } = useBlockableUsers(query);
  const [selected, setSelected] = useState<BlockableUser | undefined>(undefined);

  // Keep the sheet's toggle values in sync with the live query result
  // (rather than a stale snapshot from the moment the row was tapped).
  const selectedLive = selected ? (users.find((u) => u.id === selected.id) ?? selected) : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Blocked & Muted Accounts</Text>
        <Text style={styles.intro}>
          Search for anyone to block or mute them. This is private — they won&rsquo;t be notified either way.
        </Text>

        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.input}
            placeholder="Search all users…"
            placeholderTextColor={Brand.muted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
          />
        </View>

        {isLoading ? (
          <ActivityIndicator color={Brand.trust} style={styles.spinner} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => <BlockMuteUserRow profile={item} onPress={() => setSelected(item)} />}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {query.trim() ? `No users found for “${query.trim()}”.` : 'No other users yet.'}
              </Text>
            }
          />
        )}
      </View>

      <BlockMuteSheet visible={!!selected} onClose={() => setSelected(undefined)} profile={selectedLive} />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    backRow: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, marginBottom: Spacing.three },
    backBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    content: { flex: 1, paddingHorizontal: Spacing.three },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 24, color: Brand.ink, marginBottom: 8 },
    intro: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      lineHeight: 19,
      marginBottom: Spacing.four,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderRadius: 26,
      paddingLeft: 16,
      paddingRight: 16,
      marginBottom: Spacing.three,
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
    spinner: { marginTop: 40 },
    listContent: { paddingBottom: Spacing.six },
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
