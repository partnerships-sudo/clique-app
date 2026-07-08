import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterChips } from '@/components/feed/filter-chips';
import { MovieCircle } from '@/components/more/movie-circle';
import { NewsCard } from '@/components/news/news-card';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import { useNowPlayingMovies, useUpcomingMovies, type NowAndComingMovie } from '@/features/movies/api';
import { useNewsArticles, type NewsArticle } from '@/features/news/api';
import { useBrand } from '@/hooks/use-brand';

type NewsMode = 'headlines' | 'movies';

export default function NewsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [mode, setMode] = useState<NewsMode>('headlines');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const { data, isLoading, isFetching, refetch } = useNewsArticles(filter);
  const { data: nowPlaying, isLoading: loadingNow } = useNowPlayingMovies();
  const { data: upcoming, isLoading: loadingUpcoming } = useUpcomingMovies();
  const isMovies = mode === 'movies';

  function openArticle(article: NewsArticle) {
    router.push({
      pathname: '/news-article-modal',
      params: {
        title: article.title,
        trailText: article.trailText,
        thumbnail: article.thumbnail ?? undefined,
        byline: article.byline ?? undefined,
        section: article.section,
        publishedAt: article.publishedAt,
        url: article.url,
      },
    });
  }

  function openMovie(movie: NowAndComingMovie) {
    router.push({
      pathname: '/where-to-find-modal',
      params: { title: movie.title, type: 'cinema', poster: movie.poster ?? undefined, tmdbId: String(movie.id) },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Frozen header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>News</Text>
        <Text style={styles.screenSub}>What&rsquo;s happening in film, TV, books, games and music</Text>

        <View style={styles.modeRow}>
          <Pressable
            style={[styles.modeBtn, !isMovies && styles.modeBtnActive]}
            onPress={() => setMode('headlines')}>
            <Text style={[styles.modeBtnText, !isMovies && styles.modeBtnTextActive]}>📰 Headlines</Text>
          </Pressable>
          <Pressable style={[styles.modeBtn, isMovies && styles.modeBtnActive]} onPress={() => setMode('movies')}>
            <Text style={[styles.modeBtnText, isMovies && styles.modeBtnTextActive]}>🎬 Movie Releases</Text>
          </Pressable>
        </View>

        {!isMovies ? <FilterChips value={filter} onChange={setFilter} /> : null}
      </View>

      {/* Scrollable content */}
      {isMovies ? (
        <ScrollView contentContainerStyle={styles.movieContent}>
          <Text style={styles.sectionTitle}>In cinemas now</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={nowPlaying ?? []}
            keyExtractor={(m) => `now-${m.id}`}
            contentContainerStyle={styles.circleRow}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            renderItem={({ item }) => (
              <MovieCircle title={item.title} poster={item.poster} onPress={() => openMovie(item)} />
            )}
            ListEmptyComponent={!loadingNow ? <Text style={styles.empty}>Nothing found right now.</Text> : null}
          />

          <Text style={styles.sectionTitle}>Coming soon</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={upcoming ?? []}
            keyExtractor={(m) => `soon-${m.id}`}
            contentContainerStyle={styles.circleRow}
            ItemSeparatorComponent={() => <View style={{ width: 16 }} />}
            renderItem={({ item }) => (
              <MovieCircle
                title={item.title}
                poster={item.poster}
                releaseDate={item.releaseDate}
                onPress={() => openMovie(item)}
              />
            )}
            ListEmptyComponent={
              !loadingUpcoming ? <Text style={styles.empty}>Nothing found right now.</Text> : null
            }
          />
        </ScrollView>
      ) : (
        <FlatList
          contentContainerStyle={styles.content}
          data={data ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Brand.trust}
            />
          }
          renderItem={({ item }) => <NewsCard article={item} onPress={() => openArticle(item)} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListEmptyComponent={
            !isLoading ? <Text style={styles.empty}>No stories found right now.</Text> : null
          }
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    backgroundColor: Brand.paper,
  },
  screenTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, marginBottom: 4 },
  screenSub: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 13,
    color: Brand.muted,
    marginBottom: Spacing.three,
  },
  modeRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.three },
  modeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    paddingVertical: 11,
  },
  modeBtnActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
  modeBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  modeBtnTextActive: { color: '#fff' },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  movieContent: { paddingTop: Spacing.two, paddingBottom: Spacing.six },
  sectionTitle: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
    color: Brand.ink,
    marginBottom: 12,
    paddingHorizontal: Spacing.three,
  },
  circleRow: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.four },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    color: Brand.muted,
    fontFamily: BrandFonts.interRegular,
    fontSize: 13.6,
  },
  });
}
