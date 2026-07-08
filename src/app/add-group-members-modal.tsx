import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFriends } from '@/features/friends/api';
import { useAddGroupMembers, useGroupMembers } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';

export default function AddGroupMembersModal() {
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: friends } = useFriends();
  const { data: currentMembers } = useGroupMembers(groupId ?? null);
  const addMembers = useAddGroupMembers(groupId ?? null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const memberIds = new Set((currentMembers ?? []).map((m) => m.userId));
  const eligible = (friends ?? []).filter((f) => !memberIds.has(f.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleAdd() {
    if (!selected.size) return;
    await addMembers.mutateAsync([...selected]);
    router.back();
  }

  const addLabel = selected.size === 0
    ? 'Add'
    : `Add ${selected.size} member${selected.size > 1 ? 's' : ''}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.title}>{groupName ?? 'Group Chat'}</Text>
        <Pressable
          onPress={handleAdd}
          disabled={selected.size === 0 || addMembers.isPending}
          hitSlop={8}>
          <Text style={[styles.addBtn, selected.size === 0 && styles.addBtnDisabled]}>
            {addMembers.isPending ? 'Adding…' : addLabel}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionLabel}>Add friends to group</Text>

        {selected.size > 0 && (
          <Text style={styles.selectedCount}>{selected.size} selected</Text>
        )}

        {eligible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>All friends are already in this group</Text>
          </View>
        )}

        {eligible.map((friend) => {
          const isSelected = selected.has(friend.id);
          return (
            <Pressable
              key={friend.id}
              style={[styles.row, isSelected && styles.rowSelected]}
              onPress={() => toggle(friend.id)}>
              <Avatar
                name={friend.full_name ?? friend.username ?? 'F'}
                size={44}
                avatarUrl={friend.avatar_url}
                ring={isSelected ? Brand.trust : undefined}
              />
              <View style={styles.rowBody}>
                <Text style={styles.name}>{friend.full_name ?? friend.username ?? 'Friend'}</Text>
                {friend.username ? (
                  <Text style={styles.sub}>@{friend.username}</Text>
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
    cancel: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 60 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink, flex: 1, textAlign: 'center' },
    addBtn: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, minWidth: 60, textAlign: 'right' },
    addBtnDisabled: { color: Brand.muted },
    content: { paddingBottom: Spacing.six },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingHorizontal: Spacing.three,
      paddingTop: 18,
      paddingBottom: 10,
    },
    selectedCount: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 12.5,
      color: Brand.trust,
      paddingHorizontal: Spacing.three,
      marginBottom: 4,
    },
    empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
    emptyEmoji: { fontSize: 36, marginBottom: 10 },
    emptyTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.muted,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    rowSelected: { backgroundColor: Brand.tlight },
    rowBody: { flex: 1 },
    name: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, marginTop: 1 },
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
