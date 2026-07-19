import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MovieCircle } from '@/components/more/movie-circle';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import type { FeedFilterValue } from '@/features/feed/api';
import { timeAgo } from '@/features/feed/time-ago';
import { useNowPlayingMovies, useUpcomingMovies, type NowAndComingMovie } from '@/features/movies/api';
import { useNewsArticles, type NewsArticle } from '@/features/news/api';
import { useBrand } from '@/hooks/use-brand';

type NewsMode = 'headlines' | 'cinema';

const CATEGORY_FILTERS: { value: FeedFilterValue; label: string; sf: string }[] = [
  { value: 'all', label: 'All', sf: 'square.grid.2x2.fill' },
  { value: 'watch', label: 'TV & Film', sf: 'film.stack' },
  { value: 'read', label: 'Books', sf: 'book.fill' },
  { value: 'play', label: 'Games', sf: 'gamecontroller.fill' },
  { value: 'podcast', label: 'Podcasts', sf: 'mic.fill' },
  { value: 'listen', label: 'Music', sf: 'headphones' },
];

export default function NewsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [mode, setMode] = useState<NewsMode>('headlines');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const { data, isLoading, isFetching, isError, refetch } = useNewsArticles(filter);
  const { data: nowPlaying, isLoading: loadingNow } = useNowPlayingMovies();
  const { data: upcoming, isLoading: loadingUpcoming } = useUpcomingMovies();

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

  const articles = data ?? [];
  const trending = articles.slice(0, 3);
  const topStories = articles.slice(3);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>News</Text>
        <Text style={styles.screenSub}>What&apos;s happening in film,{'\n'}TV, books, games and music</Text>

        {/* Headlines / Cinema tabs */}
        <View style={styles.modeRow}>
          <Pressable style={styles.modeTab} onPress={() => setMode('headlines')}>
            <Text style={[styles.modeTabText, mode === 'headlines' && styles.modeTabTextActive]}>Headlines</Text>
            {mode === 'headlines' ? <View style={styles.modeUnderline} /> : null}
          </Pressable>
          <Pressable style={styles.modeTab} onPress={() => setMode('cinema')}>
            <Text style={[styles.modeTabText, mode === 'cinema' && styles.modeTabTextActive]}>Cinema</Text>
            {mode === 'cinema' ? <View style={styles.modeUnderline} /> : null}
          </Pressable>
        </View>

        {/* Category icon chips (headlines only) */}
        {mode === 'headlines' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRow}
            style={styles.catScroll}>
            {CATEGORY_FILTERS.map((cat) => {
              const active = filter === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  style={[styles.catChip, active && styles.catChipActive]}
                  onPress={() => setFilter(cat.value)}>
                  <SymbolView name={cat.sf as any} size={22} tintColor={active ? '#fff' : '#888'} type="monochrome" />
                  <Text style={[styles.catChipLabel, active && styles.catChipLabelActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* Cinema mode */}
      {mode === 'cinema' ? (
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
        /* Headlines mode */
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Brand.trust}
            />
          }>
          {articles.length === 0 && !isLoading ? (
            <Text style={styles.empty}>
              {isError ? "Couldn't load stories — pull down to try again." : 'No stories found right now.'}
            </Text>
          ) : null}

          {/* Trending Now */}
          {trending.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>🔥 Trending Now</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
                {trending.map((article, i) => (
                  <Pressable key={article.id} style={styles.trendingCard} onPress={() => openArticle(article)}>
                    {article.thumbnail ? (
                      <Image source={{ uri: article.thumbnail }} style={styles.trendingImg} />
                    ) : (
                      <View style={[styles.trendingImg, styles.trendingImgFallback]}>
                        <Text style={styles.trendingImgFallbackEmoji}>📰</Text>
                      </View>
                    )}
                    <View style={styles.trendingNumBadge}>
                      <Text style={styles.trendingNum}>{i + 1}</Text>
                    </View>
                    <View style={styles.trendingOverlay}>
                      <Text style={styles.trendingSource}>{article.section.toUpperCase()}</Text>
                      <Text style={styles.trendingTitle} numberOfLines={3}>{article.title}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Your Top Stories — alternating full-width and 2-col pairs */}
          {topStories.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Your Top Stories</Text>
              {(() => {
                const rows: React.ReactElement[] = [];
                let i = 0;
                while (i < topStories.length) {
                  if (i % 3 === 0) {
                    // Full-width card: entire image darkened, text overlaid at bottom
                    const a = topStories[i];
                    rows.push(
                      <Pressable key={a.id} style={styles.featureCard} onPress={() => openArticle(a)}>
                        {a.thumbnail ? (
                          <Image source={{ uri: a.thumbnail }} style={styles.featureImg} resizeMode="cover" />
                        ) : (
                          <View style={[styles.featureImg, styles.featureImgFallback]} />
                        )}
                        <View style={styles.featureDimOverlay} />
                        <View style={styles.featureTextBlock}>
                          <View style={styles.featureMeta}>
                            <Text style={styles.featureSection}>{a.section.toUpperCase()}</Text>
                            <Text style={styles.featureTime}> · {timeAgo(a.publishedAt)}</Text>
                          </View>
                          <Text style={styles.featureTitle} numberOfLines={3}>{a.title}</Text>
                        </View>
                      </Pressable>
                    );
                    i += 1;
                  } else {
                    // 2-column pair: image on top, text below (no overlay on text)
                    const pair = topStories.slice(i, i + 2);
                    rows.push(
                      <View key={`pair-${i}`} style={styles.grid}>
                        {pair.map((a) => (
                          <Pressable key={a.id} style={styles.gridCard} onPress={() => openArticle(a)}>
                            <View style={styles.gridImgWrap}>
                              {a.thumbnail ? (
                                <Image source={{ uri: a.thumbnail }} style={styles.gridImg} resizeMode="cover" />
                              ) : (
                                <View style={[styles.gridImg, styles.gridImgFallback]} />
                              )}
                              <View style={styles.gridBottomGradient} />
                            </View>
                            <View style={styles.gridBody}>
                              <View style={styles.gridMeta}>
                                <Text style={styles.gridSection}>{a.section.toUpperCase()}</Text>
                                <Text style={styles.gridTime}> · {timeAgo(a.publishedAt)}</Text>
                              </View>
                              <Text style={styles.gridTitle} numberOfLines={3}>{a.title}</Text>
                            </View>
                          </Pressable>
                        ))}
                      </View>
                    );
                    i += 2;
                  }
                }
                return rows;
              })()}
            </View>
          ) : null}

          <View style={{ height: Spacing.six }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },

    // Header
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.three,
      backgroundColor: Brand.paper,
    },
    screenTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 32,
      color: Brand.ink,
      marginBottom: 4,
    },
    screenSub: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13.5,
      color: Brand.muted,
      lineHeight: 19,
      marginBottom: 18,
    },

    // Mode tabs (Headlines / Cinema)
    modeRow: {
      flexDirection: 'row',
      gap: 24,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
      marginBottom: 14,
    },
    modeTab: { paddingBottom: 10 },
    modeTabText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.muted,
    },
    modeTabTextActive: { color: Brand.ink },
    modeUnderline: {
      position: 'absolute',
      bottom: -1,
      left: 0,
      right: 0,
      height: 2.5,
      borderRadius: 2,
      backgroundColor: Brand.trust,
    },

    // Category chips
    catScroll: { marginBottom: 14 },
    catRow: { flexDirection: 'row', gap: 10, paddingRight: 16 },
    catChip: {
      alignItems: 'center',
      justifyContent: 'center',
      width: 72,
      height: 72,
      borderRadius: 18,
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
      gap: 5,
    },
    catChipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    catChipLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 10.5,
      color: Brand.muted,
      textAlign: 'center',
    },
    catChipLabelActive: { color: '#fff' },

    // Section labels
    section: { marginBottom: 8 },
    sectionLabel: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 17,
      color: Brand.ink,
      marginBottom: 12,
      paddingHorizontal: Spacing.three,
    },

    // Trending row
    trendingRow: { paddingHorizontal: Spacing.three, gap: 10, paddingBottom: 4 },
    trendingCard: {
      width: 126,
      height: 176,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: Brand.card,
    },
    trendingImg: { width: '100%', height: '100%', position: 'absolute' },
    trendingImgFallback: { backgroundColor: Brand.tlight, alignItems: 'center', justifyContent: 'center' },
    trendingImgFallbackEmoji: { fontSize: 40 },
    trendingNumBadge: {
      position: 'absolute',
      top: 12,
      left: 12,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: Brand.trust,
      alignItems: 'center',
      justifyContent: 'center',
    },
    trendingNum: { fontFamily: BrandFonts.syneExtraBold, fontSize: 13, color: '#fff' },
    trendingOverlay: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: 14,
      paddingTop: 40,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    trendingSource: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 8.5,
      color: Brand.trust,
      letterSpacing: 0.6,
      marginBottom: 3,
    },
    trendingTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 12,
      color: '#fff',
      lineHeight: 16,
    },

    // Feature card: whole image dimmed, text overlaid at bottom
    featureCard: {
      marginHorizontal: Spacing.three,
      height: 240,
      borderRadius: 18,
      overflow: 'hidden',
      backgroundColor: Brand.card,
      marginBottom: 12,
    },
    featureImg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    featureImgFallback: { backgroundColor: Brand.tlight },
    featureDimOverlay: {
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    featureTextBlock: {
      position: 'absolute', bottom: 0, left: 0, right: 0,
      padding: 16,
    },
    featureMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    featureSection: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.trust, letterSpacing: 0.6 },
    featureTime: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: 'rgba(255,255,255,0.65)' },
    featureTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 19, color: '#fff', lineHeight: 25 },

    // Grid: image on top with bottom gradient, text below
    grid: { flexDirection: 'row', gap: 12, paddingHorizontal: Spacing.three, marginBottom: 12 },
    gridCard: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      backgroundColor: Brand.card,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    gridImgWrap: { position: 'relative' },
    gridImg: { width: '100%', aspectRatio: 16 / 9 },
    gridImgFallback: { backgroundColor: Brand.tlight },
    gridBottomGradient: {
      position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    gridBody: { padding: 10 },
    gridMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    gridSection: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: Brand.trust, letterSpacing: 0.5 },
    gridTime: { fontFamily: BrandFonts.interRegular, fontSize: 9, color: Brand.muted },
    gridTitle: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.ink, lineHeight: 17 },

    // Cinema / misc
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
