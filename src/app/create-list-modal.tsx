import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useCreateList, useUpdateList } from '@/features/lists/api';
import { useBrand } from '@/hooks/use-brand';

export default function CreateListModal() {
  const params = useLocalSearchParams<{ listId?: string; listTitle?: string; listDesc?: string; listPublic?: string }>();
  const isEditing = !!params.listId;

  const [title, setTitle] = useState(params.listTitle ?? '');
  const [description, setDescription] = useState(params.listDesc ?? '');
  const [isPublic, setIsPublic] = useState(params.listPublic !== 'false');

  const createList = useCreateList();
  const updateList = useUpdateList();
  const loading = createList.isPending || updateList.isPending;
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  async function handleSave() {
    const t = title.trim();
    if (!t) { Alert.alert('Title required', 'Please give your list a name.'); return; }
    try {
      if (isEditing) {
        await updateList.mutateAsync({ id: params.listId!, title: t, description: description.trim() || undefined, is_public: isPublic });
      } else {
        await createList.mutateAsync({ title: t, description: description.trim() || undefined, is_public: isPublic });
      }
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save list. Please try again.');
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{isEditing ? 'Edit List' : 'New List'}</Text>
          <Pressable onPress={handleSave} disabled={loading} hitSlop={12}>
            {loading
              ? <ActivityIndicator color={Brand.trust} />
              : <Text style={[styles.save, !title.trim() && styles.saveDisabled]}>Save</Text>}
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Best Horror Films"
                placeholderTextColor={Brand.muted}
                returnKeyType="next"
                autoFocus={!isEditing}
              />
            </View>
            <View style={styles.divider} />
            <View style={[styles.row, { alignItems: 'flex-start' }]}>
              <Text style={[styles.label, { paddingTop: 2 }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.descInput]}
                value={description}
                onChangeText={(t) => t.length <= 200 && setDescription(t)}
                placeholder="Optional description…"
                placeholderTextColor={Brand.muted}
                multiline
              />
            </View>
          </View>

          <View style={[styles.card, { marginTop: 14 }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Public list</Text>
                <Text style={styles.hint}>Anyone can see public lists on your profile.</Text>
              </View>
              <Switch
                value={isPublic}
                onValueChange={setIsPublic}
                trackColor={{ true: Brand.trust }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.three,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    cancel: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.muted },
    save: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    saveDisabled: { opacity: 0.4 },
    scroll: { flex: 1, backgroundColor: Brand.paper },
    content: { flexGrow: 1, padding: Spacing.three, paddingBottom: 24 },
    card: {
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
    },
    label: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: Brand.muted, width: 90 },
    hint: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 2 },
    input: { flex: 1, fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.ink, padding: 0 },
    descInput: { minHeight: 60, textAlignVertical: 'top', paddingTop: 2 },
    divider: { height: 1, backgroundColor: Brand.border, marginLeft: 14 },
  });
}
