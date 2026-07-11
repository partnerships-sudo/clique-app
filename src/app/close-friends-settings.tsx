import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseFriendRow } from '@/components/settings/close-friend-row';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useCloseFriendCandidates, useToggleCloseFriend } from '@/features/close-friends/api';
import { useBrand } from '@/hooks/use-brand';

export default function CloseFriendsSettingsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [query, setQuery] = useState('');
  const { data: candidates, isLoading } = useCloseFriendCandidates(query);
  const toggle = useToggleCloseFriend();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backRow}>
        <Text style={styles.backBtn}>‹ Back</Text>
      </Pressable>
      <View style={styles.content}>
        <Text style={styles.title}>Close Friends</Text>
        <Text style={styles.intro}>
          Search your friends and tap the circle to add them to your close friends list. This is private —
          they won&rsquo;t be notified.
        </Text>

        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.input}
            placeholder="Search your friends…"
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
            data={candidates}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <CloseFriendRow
                profile={item}
                disabled={toggle.isPending && toggle.variables?.friendId === item.id}
                onToggle={() => toggle.mutate({ friendId: item.id, isCloseFriend: !item.isCloseFriend })}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {query.trim()
                  ? `No friends found for “${query.trim()}”.`
                  : "You don't have any mutual friends yet — follow people back to add them here."}
              </Text>
            }
          />
        )}
      </View>
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
