import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useSearchUsers, useSendFriendRequest } from '@/features/friends/api';
import { useBrand } from '@/hooks/use-brand';

export function UserSearch() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useSearchUsers(query);
  const sendRequest = useSendFriendRequest();
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());

  function handleAdd(id: string) {
    sendRequest.mutate(id);
    setRequestedIds((prev) => new Set(prev).add(id));
  }

  return (
    <View>
      <TextInput
        style={styles.input}
        placeholder="Search friends by name or username…"
        placeholderTextColor={Brand.muted}
        value={query}
        onChangeText={setQuery}
        autoCapitalize="none"
      />
      {query.trim().length >= 2 ? (
        <View style={styles.results}>
          {isFetching ? (
            <ActivityIndicator color={Brand.trust} style={styles.spinner} />
          ) : !results?.length ? (
            <Text style={styles.empty}>No users found for &ldquo;{query}&rdquo;.</Text>
          ) : (
            results.map((profile) => {
              const name = profile.full_name || profile.username || 'Unknown';
              const requested = requestedIds.has(profile.id);
              return (
                <View key={profile.id} style={styles.row}>
                  <Avatar name={name} size={40} avatarUrl={profile.avatar_url} />
                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName}>{name}</Text>
                    {profile.username ? <Text style={styles.rowHandle}>@{profile.username}</Text> : null}
                  </View>
                  <Pressable
                    style={[styles.addBtn, requested && styles.addBtnDone]}
                    disabled={requested}
                    onPress={() => handleAdd(profile.id)}>
                    <Text style={[styles.addBtnText, requested && styles.addBtnTextDone]}>
                      {requested ? 'Requested ✓' : '+ Add'}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>
      ) : null}
    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    input: {
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 14.5,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      backgroundColor: Brand.card,
      marginBottom: 14,
    },
    results: { marginBottom: 8 },
    spinner: { paddingVertical: 16 },
    empty: {
      textAlign: 'center',
      padding: 16,
      color: Brand.muted,
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 14,
      padding: 11,
      marginBottom: 8,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    rowHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    addBtn: { backgroundColor: Brand.trust, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
    addBtnDone: { backgroundColor: Brand.tlight },
    addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    addBtnTextDone: { color: Brand.trust },
  });
}
