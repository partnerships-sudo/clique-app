import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useGroupMembers } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function GroupInfoModal() {
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { data: members, isLoading } = useGroupMembers(groupId ?? null);

  const memberCount = members?.length ?? 0;
  // Put creator (Admin) first, then sort alphabetically
  const sorted = [...(members ?? [])].sort((a, b) => {
    if (a.isCreator && !b.isCreator) return -1;
    if (!a.isCreator && b.isCreator) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Group identity */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Text style={styles.heroIconText}>👥</Text>
          </View>
          <Text style={styles.groupName}>{groupName ?? 'Group Chat'}</Text>
          <Text style={styles.groupSub}>Group · {memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
        </View>

        {/* Add members row */}
        <Pressable
          style={styles.actionRow}
          onPress={() =>
            router.push({
              pathname: '/add-group-members-modal',
              params: { groupId: groupId!, groupName: groupName ?? 'Group Chat' },
            })
          }>
          <View style={styles.actionIcon}>
            <Text style={styles.actionIconText}>＋</Text>
          </View>
          <Text style={styles.actionLabel}>Add members</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        {/* Members */}
        <Text style={styles.sectionLabel}>Members</Text>

        {isLoading && <Text style={styles.loading}>Loading members…</Text>}

        {sorted.map((member) => (
          <View key={member.userId} style={styles.memberRow}>
            <Avatar
              name={member.name}
              size={44}
              avatarUrl={member.avatarUrl}
              ring={member.userId === user?.id ? Brand.trust : undefined}
            />
            <View style={styles.memberBody}>
              <Text style={styles.memberName}>
                {member.userId === user?.id ? 'You' : member.name}
              </Text>
            </View>
            {member.isCreator && (
              <View style={styles.adminBadge}>
                <Text style={styles.adminText}>Admin</Text>
              </View>
            )}
          </View>
        ))}
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
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust, width: 50 },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    content: { paddingBottom: Spacing.six },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      backgroundColor: Brand.card,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      marginBottom: 8,
    },
    actionIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    actionIconText: { fontSize: 22, color: Brand.trust, fontFamily: BrandFonts.syneBold },
    actionLabel: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    chevron: { fontSize: 20, color: Brand.muted },
    hero: { alignItems: 'center', paddingVertical: Spacing.four, backgroundColor: Brand.card, marginBottom: 8 },
    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    heroIconText: { fontSize: 38 },
    groupName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, marginBottom: 4 },
    groupSub: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
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
    loading: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.6,
      color: Brand.muted,
      textAlign: 'center',
      paddingVertical: 20,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingHorizontal: Spacing.three,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      backgroundColor: Brand.card,
    },
    memberBody: { flex: 1 },
    memberName: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.ink },
    adminBadge: {
      backgroundColor: Brand.tlight,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    adminText: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.trust },
  });
}
