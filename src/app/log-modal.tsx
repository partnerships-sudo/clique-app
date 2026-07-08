import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IntentToggle, type LogIntent } from '@/components/log-modal/intent-toggle';
import { SearchStep } from '@/components/log-modal/search-step';
import { TypePickerStep } from '@/components/log-modal/type-picker-step';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useCreatePost } from '@/features/feed/api';
import { useAddLibraryItem } from '@/features/library/api';
import { useBrand } from '@/hooks/use-brand';

export default function LogModal() {
  const params = useLocalSearchParams<{ intent?: string }>();
  const [type, setType] = useState<EntryType | null>(null);
  const [intent, setIntent] = useState<LogIntent>(params.intent === 'watchlist' ? 'watchlist' : 'log');
  const createPost = useCreatePost();
  const addLibraryItem = useAddLibraryItem();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  async function handleSubmit(input: {
    title: string;
    sub?: string;
    poster?: string;
    note?: string;
    rating?: number;
    extRating?: string;
    externalId?: string;
    mediaType?: string;
  }) {
    if (!type) return;
    await addLibraryItem.mutateAsync({ type, intent, ...input });
    if (intent === 'log') {
      await createPost.mutateAsync({ type, ...input });
    }
    router.back();
  }

  const isSubmitting = createPost.isPending || addLibraryItem.isPending;

  return (
    <>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          sheetAllowedDetents: [0.9],
          sheetGrabberVisible: true,
          headerShown: false,
        }}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets>
        <Text style={styles.heading}>What are you into right now?</Text>
        <TypePickerStep value={type} onSelect={setType} />
        {type ? (
          <View style={styles.entrySection}>
            <IntentToggle value={intent} onChange={setIntent} />
            <SearchStep type={type} intent={intent} onSubmit={handleSubmit} isSubmitting={isSubmitting} />
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Brand.card },
  content: { padding: Spacing.four, paddingBottom: Spacing.four },
  heading: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 19,
    color: Brand.ink,
    marginBottom: 18,
  },
  entrySection: { marginTop: 20 },
  });
}
