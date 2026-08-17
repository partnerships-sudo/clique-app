import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useGroupInfo, useGroupMembers, useUpdateGroup } from '@/features/groups/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function GroupInfoModal() {
  const { groupId, groupName } = useLocalSearchParams<{ groupId: string; groupName?: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { data: members, isLoading } = useGroupMembers(groupId ?? null);
  const { data: groupInfo } = useGroupInfo(groupId ?? null);
  const updateGroup = useUpdateGroup(groupId ?? null, (err) => Alert.alert('Error', err.message));

  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(groupName ?? 'Group Chat');
  const [localPhoto, setLocalPhoto] = useState<string | null>(null);

  // Sync name from live query once loaded
  useEffect(() => {
    if (groupInfo?.name && !editingName) setNameValue(groupInfo.name);
  }, [groupInfo?.name]);

  const memberCount = members?.length ?? 0;
  const isAdmin = members?.some((m) => m.userId === user?.id && m.isCreator) ?? false;

  const sorted = [...(members ?? [])].sort((a, b) => {
    if (a.isCreator && !b.isCreator) return -1;
    if (!a.isCreator && b.isCreator) return 1;
    return a.name.localeCompare(b.name);
  });

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const uri = result.assets[0].uri;
    setLocalPhoto(uri);
    updateGroup.mutate({ photoUri: uri });
  }

  function saveName() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== (groupInfo?.name ?? groupName)) {
      updateGroup.mutate({ name: trimmed });
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={{ width: 50 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Group identity */}
        <View style={styles.hero}>
          <Pressable onPress={isAdmin ? pickPhoto : undefined} style={styles.photoWrap}>
            {(localPhoto ?? groupInfo?.photo_url) ? (
              <Image source={{ uri: (localPhoto ?? groupInfo?.photo_url)! }} style={styles.heroPhoto} cachePolicy="memory-disk" recyclingKey={(localPhoto ?? groupInfo?.photo_url)!} />
            ) : (
              <View style={styles.heroIcon}>
                <Text style={styles.heroIconText}>👥</Text>
              </View>
            )}
            {isAdmin && (
              <View style={styles.photoEditBadge}>
                <Text style={styles.photoEditText}>📷</Text>
              </View>
            )}
          </Pressable>

          {editingName ? (
            <TextInput
              style={styles.nameInput}
              value={nameValue}
              onChangeText={setNameValue}
              onBlur={saveName}
              onSubmitEditing={saveName}
              autoFocus
              returnKeyType="done"
              maxLength={40}
            />
          ) : (
            <Pressable onPress={isAdmin ? () => setEditingName(true) : undefined}>
              <Text style={styles.groupName}>
                {nameValue}{isAdmin ? ' ✎' : ''}
              </Text>
            </Pressable>
          )}
          <Text style={styles.groupSub}>Group · {memberCount} member{memberCount !== 1 ? 's' : ''}</Text>
        </View>

        {/* Add members row */}
        <Pressable
          style={styles.actionRow}
          onPress={() =>
            router.push({
              pathname: '/add-group-members-modal',
              params: { groupId: groupId!, groupName: nameValue },
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
      </KeyboardAvoidingView>
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
    photoWrap: { position: 'relative', marginBottom: 12 },
    heroPhoto: { width: 80, height: 80, borderRadius: 40 },
    heroIcon: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: Brand.tlight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroIconText: { fontSize: 38 },
    photoEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: Brand.card,
    },
    photoEditText: { fontSize: 11, color: '#fff' },
    groupName: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, color: Brand.ink, marginBottom: 4 },
    nameInput: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 22,
      color: Brand.ink,
      borderBottomWidth: 2,
      borderBottomColor: Brand.trust,
      marginBottom: 4,
      paddingHorizontal: 8,
      paddingVertical: 2,
      minWidth: 160,
      textAlign: 'center',
    },
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
