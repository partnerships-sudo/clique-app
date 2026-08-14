import { router } from 'expo-router';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandFonts } from '@/constants/theme';
import { DiscussionCard } from '@/components/feed/discussion-card';
import { useSavedDiscussions } from '@/features/discussions/api';
import { useBrand } from '@/hooks/use-brand';

export default function SavedDiscussionsModal() {
  const Brand = useBrand();
  const { data: saved = [], isLoading, isError } = useSavedDiscussions();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: Brand.paper }]} edges={['top']}>
      <View style={[styles.nav, { borderBottomColor: Brand.border }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={[styles.navBack, { color: Brand.trust }]}>‹ Back</Text>
        </Pressable>
        <Text style={[styles.navTitle, { color: Brand.ink }]}>Saved</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {isError && (
          <Text style={[styles.empty, { color: Brand.muted }]}>
            Could not load. Check your connection.
          </Text>
        )}
        {!isError && !isLoading && saved.length === 0 && (
          <Text style={[styles.empty, { color: Brand.muted }]}>
            Nothing saved yet. Tap the ribbon on any post to save it here.
          </Text>
        )}
        {saved.map((d) => <DiscussionCard key={d.id} item={d} />)}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBack: { fontFamily: BrandFonts.syneBold, fontSize: 16, width: 60 },
  navTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16 },
  list: { padding: 16, gap: 10 },
  empty: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 21,
    paddingTop: 40,
    paddingHorizontal: 24,
  },
});
