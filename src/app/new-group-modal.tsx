import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
import { useCreateGroup } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';

export default function NewGroupModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: friends } = useFriends();
  const createGroup = useCreateGroup();
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggleFriend(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (!selected.size) return;
    const groupId = await createGroup.mutateAsync({
      name: groupName.trim() || null,
      memberIds: [...selected],
    });
    router.back(); // close new-group-modal
    router.back(); // close new-chat-modal
    router.push({
      pathname: '/chat-modal',
      params: { groupId, groupName: groupName.trim() || 'Group Chat' },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>New Group</Text>
        <Pressable
          onPress={handleCreate}
          disabled={selected.size === 0 || createGroup.isPending}
          hitSlop={8}>
          <Text style={[styles.create, selected.size === 0 && styles.createDisabled]}>
            {createGroup.isPending ? 'Creating…' : 'Create'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Group name */}
        <View style={styles.nameSection}>
          <Text style={styles.sectionLabel}>Group name (optional)</Text>
          <TextInput
            style={styles.nameInput}
            placeholder="e.g. Movie Night, Book Club…"
            placeholderTextColor={Brand.muted}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
          />
        </View>

        {/* Member picker */}
        <Text style={styles.sectionLabel}>Add members</Text>
        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selected</Text>
        )}

        {(friends ?? []).length === 0 && (
          <Text style={styles.empty}>You need friends to create a group!</Text>
        )}

        {(friends ?? []).map((friend) => {
          const isSelected = selected.has(friend.id);
          return (
            <Pressable
              key={friend.id}
              style={[styles.friendRow, isSelected && styles.friendRowSelected]}
              onPress={() => toggleFriend(friend.id)}>
              <Avatar
                name={friend.full_name ?? friend.username ?? 'F'}
                size={44}
                avatarUrl={friend.avatar_url}
                ring={isSelected ? Brand.trust : undefined}
              />
              <View style={styles.friendBody}>
                <Text style={styles.friendName}>
                  {friend.full_name ?? friend.username ?? 'Friend'}
                </Text>
                {friend.username ? (
                  <Text style={styles.friendSub}>@{friend.username}</Text>
                ) : null}
              </View>
              <View style={[styles.check, isSelected && styles.checkSelected]}>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
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
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 60 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    create: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 60, textAlign: 'right' },
    createDisabled: { color: Brand.muted },
    content: { paddingBottom: Spacing.six },
    nameSection: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.two,
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: Spacing.three,
      paddingTop: 14,
      paddingBottom: 10,
    },
    nameInput: {
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 13,
      fontSize: 15,
      fontFamily: BrandFonts.interRegular,
      color: Brand.ink,
      marginTop: 8,
    },
    selectedCount: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.5,
      color: Brand.trust,
      paddingHorizontal: Spacing.three,
      marginBottom: 4,
    },
    empty: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      paddingVertical: 24,
      paddingHorizontal: 20,
    },
    friendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    friendRowSelected: { backgroundColor: Brand.tlight },
    friendBody: { flex: 1 },
    friendName: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    friendSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 1 },
    check: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 2,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkSelected: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    checkMark: { color: '#fff', fontSize: 14, fontFamily: BrandFonts.syneBold },
  });
}
