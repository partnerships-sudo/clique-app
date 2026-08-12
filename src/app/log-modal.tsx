import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { IntentToggle, type LogIntent } from '@/components/log-modal/intent-toggle';
import { SearchStep } from '@/components/log-modal/search-step';
import { TypePickerStep } from '@/components/log-modal/type-picker-step';
import { BrandFonts, Spacing, type BrandPalette, type EntryType } from '@/constants/theme';
import { useQueryClient } from '@tanstack/react-query';
import { useCreatePost } from '@/features/feed/api';
import { useAddLibraryItem, libraryQueryKey } from '@/features/library/api';
import { track, Events } from '@/features/analytics/api';
import { useSession } from '@/hooks/use-session';
import type { SearchResult } from '@/features/search/api';
import { useBrand } from '@/hooks/use-brand';

export default function LogModal() {
  const params = useLocalSearchParams<{
    intent?: string;
    prefillTitle?: string;
    prefillType?: EntryType;
    prefillSub?: string;
    prefillPoster?: string;
    prefillExternalId?: string;
    prefillMediaType?: string;
  }>();
  const hasPrefill = !!params.prefillTitle && !!params.prefillType;
  const [type, setType] = useState<EntryType | null>(hasPrefill ? (params.prefillType ?? null) : 'watch');
  const [intent, setIntent] = useState<LogIntent>(params.intent === 'watchlist' ? 'watchlist' : 'log');
  const [universalPrefill, setUniversalPrefill] = useState<{ title: string; sub: string; poster: string | null; externalId: string | null; mediaType: string | null; extRating: string | null; square: boolean } | null>(null);

  function handleUniversalPick(pickedType: EntryType, result: SearchResult) {
    setType(pickedType);
    setUniversalPrefill({ title: result.title, sub: result.sub, poster: result.img, externalId: result.externalId, mediaType: result.mediaType, extRating: result.rating, square: result.square });
  }
  const createPost = useCreatePost();
  const addLibraryItem = useAddLibraryItem();
  const { user } = useSession();
  const queryClient = useQueryClient();
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
    visibility?: 'everyone' | 'close_friends';
    watchedWith?: { id: string; username: string; avatar_url: string | null }[];
  }) {
    if (!type) return;
    try {
      const { visibility, watchedWith, ...libraryInput } = input;
      await addLibraryItem.mutateAsync({ type, intent, ...libraryInput });
      // Await the library refetch so the banner updates before the modal closes
      await queryClient.refetchQueries({ queryKey: libraryQueryKey(user?.id) });
      if (intent === 'log') {
        await createPost.mutateAsync({ type, ...libraryInput, visibility, watchedWith: watchedWith?.map((w) => w.id) });
        track(user?.id, Events.POST_CREATED, {
          type,
          title: input.title,
          has_rating: input.rating != null,
          has_note: !!input.note?.trim(),
          external_id: input.externalId,
        });
        if (input.rating != null) {
          track(user?.id, Events.POST_RATED, { type, title: input.title, rating: input.rating });
        }
      }
    } finally {
      router.back();
    }
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
        {!hasPrefill && (
          <Text style={styles.heading}>
            {intent === 'watchlist' ? 'What do you want to get to?' : 'What are you into right now?'}
          </Text>
        )}
        {!hasPrefill && <TypePickerStep value={type} onSelect={(t) => { setUniversalPrefill(null); setType(t); }} onUniversalPick={handleUniversalPick} />}
        {/* For watchlist intent, only show SearchStep once the user has picked a result (universalPrefill set).
            For log intent (or hasPrefill), show SearchStep as soon as a type is selected. */}
        {type && (hasPrefill || intent === 'log' || intent === 'watchlist' || universalPrefill) ? (
          <View style={hasPrefill ? undefined : styles.entrySection}>
            {/* Hide intent toggle when intent is locked from params (e.g. opened via + Watchlist) */}
            {!hasPrefill && !params.intent && <IntentToggle value={intent} onChange={setIntent} />}
            <SearchStep
              type={type}
              intent={intent}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              prefill={hasPrefill ? {
                title: params.prefillTitle!,
                sub: params.prefillSub ?? '',
                poster: params.prefillPoster ?? null,
                externalId: params.prefillExternalId ?? null,
                mediaType: params.prefillMediaType ?? null,
              } : universalPrefill ?? undefined}
            />
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
