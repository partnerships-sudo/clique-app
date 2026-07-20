import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useFollow, useSearchUsers } from '@/features/follows/api';
import { useBrand } from '@/hooks/use-brand';

export interface UserSearchHandle {
  focus: () => void;
}

function SlidersIcon({ color }: { color: string }) {
  return (
    <View style={{ width: 16, height: 14, justifyContent: 'space-between' }}>
      {[0.3, 0.65, 0.45].map((pos, i) => (
        <View key={i} style={{ width: '100%', height: 2, borderRadius: 1, backgroundColor: color, opacity: 0.35 }}>
          <View
            style={{
              position: 'absolute',
              top: -2,
              left: `${pos * 100}%`,
              width: 6,
              height: 6,
              borderRadius: 3,
              marginLeft: -3,
              backgroundColor: color,
            }}
          />
        </View>
      ))}
    </View>
  );
}

export const UserSearch = forwardRef<UserSearchHandle>(function UserSearch(_props, ref) {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [query, setQuery] = useState('');
  const { data: results, isFetching } = useSearchUsers(query);
  const follow = useFollow();
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }));

  function handleAdd(id: string, isPrivate: boolean) {
    follow.mutate({ targetUserId: id, isTargetPrivate: isPrivate });
    setRequestedIds((prev) => new Set(prev).add(id));
  }

  return (
    <View>
      <View style={styles.searchRow}>
        <SymbolView name="magnifyingglass" size={15} tintColor="#999" style={{ width: 16, height: 16, marginRight: 8 }} />
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder="Search for people to follow…"
          placeholderTextColor={Brand.muted}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        <Pressable
          style={styles.filterBtn}
          hitSlop={8}
          onPress={() => router.push('/discover-people-modal')}>
          <SlidersIcon color={Brand.trust} />
        </Pressable>
      </View>
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
                    onPress={() => handleAdd(profile.id, profile.is_private)}>
                    <Text style={[styles.addBtnText, requested && styles.addBtnTextDone]}>
                      {requested ? (profile.is_private ? 'Requested ✓' : 'Following ✓') : '+ Follow'}
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
});

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Brand.card,
      borderRadius: 26,
      paddingLeft: 16,
      paddingRight: 6,
      marginBottom: 14,
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
    filterBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
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
      borderRadius: 16,
      padding: 11,
      marginBottom: 8,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    rowInfo: { flex: 1, minWidth: 0 },
    rowName: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    rowHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 },
    addBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 7, paddingHorizontal: 12 },
    addBtnDone: { backgroundColor: Brand.tlight },
    addBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    addBtnTextDone: { color: Brand.trust },
  });
}
