import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useBoxOfficeTop10, useNowPlayingMovies, useUpcomingMovies, useUpcomingTV, type NowAndComingMovie } from '@/features/movies/api';
import { useUpcomingGames } from '@/features/games/igdb';
import { useUpcomingAlbums, useUpcomingBooks } from '@/features/radar/api';
import { useNewsArticles, type NewsArticle } from '@/features/news/api';
import { track, Events } from '@/features/analytics/api';
import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';

type NewsMode = 'headlines' | 'cinema' | 'radar';
type RadarCategory = 'films' | 'tv' | 'games' | 'albums' | 'books';

const RADAR_CATS: { value: RadarCategory; label: string; sf: string }[] = [
  { value: 'films',  label: 'Films',  sf: 'film.stack' },
  { value: 'tv',     label: 'TV',     sf: 'tv' },
  { value: 'games',  label: 'Games',  sf: 'gamecontroller.fill' },
  { value: 'albums', label: 'New Music', sf: 'headphones' },
  { value: 'books',  label: 'Books',  sf: 'book.fill' },
];

function formatRadarDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatRevenue(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${Math.round(n / 1_000_000)}M`;
  return `$${Math.round(n / 1_000)}K`;
}

const CATEGORY_FILTERS: { value: FeedFilterValue; label: string; sf: string }[] = [
  { value: 'all', label: 'All', sf: 'square.grid.2x2.fill' },
  { value: 'watch', label: 'TV & Film', sf: 'film.stack' },
  { value: 'read', label: 'Books', sf: 'book.fill' },
  { value: 'play', label: 'Games', sf: 'gamecontroller.fill' },
  { value: 'podcast', label: 'Podcasts', sf: 'mic.fill' },
  { value: 'listen', label: 'Music', sf: 'headphones' },
];

const MovieRowSeparator = () => <View style={{ width: 16 }} />;

export default function NewsScreen() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const [mode, setMode] = useState<NewsMode>('headlines');
  const [filter, setFilter] = useState<FeedFilterValue>('all');
  const { data, isLoading, isFetching, isError, refetch } = useNewsArticles(filter);
  const { data: nowPlaying, isLoading: loadingNow } = useNowPlayingMovies();
  const { data: upcoming, isLoading: loadingUpcoming } = useUpcomingMovies();
  const { data: boxOffice } = useBoxOfficeTop10();
  const [radarCat, setRadarCat] = useState<RadarCategory>('films');
  const { data: upcomingGames, isLoading: loadingGames } = useUpcomingGames();
  const { data: upcomingTV, isLoading: loadingTV } = useUpcomingTV();
  const { data: upcomingAlbums, isLoading: loadingAlbums } = useUpcomingAlbums();
  const { data: upcomingBooks, isLoading: loadingBooks } = useUpcomingBooks();
  const boxOfficeByMovie = useMemo(
    () => new Map((boxOffice ?? []).map((e) => [e.id, e.revenue])),
    [boxOffice],
  );
  const maxRevenue = useMemo(
    () => (boxOffice?.[0] ? Math.max(...boxOffice.map((e) => e.revenue)) : 1),
    [boxOffice],
  );

  function openArticle(article: NewsArticle) {
    track(user?.id, Events.NEWS_CARD_TAPPED, {
      title: article.title,
      section: article.section,
      filter,
    });
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
      params: { title: movie.title, type: 'cinema', poster: movie.poster ?? '', tmdbId: String(movie.id) },
    });
  }

  const articles = data ?? [];
  const trending = articles.slice(0, 10);
  const topStories = articles.slice(10);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Sticky header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>News</Text>
        <Text style={styles.screenSub}>
          {mode === 'cinema'
            ? 'In cinemas, coming soon\nand topping the box office'
            : mode === 'radar'
            ? 'Films, games, new music & books\narriving soon'
            : "What's happening in film,\nTV, books, games and music"}
        </Text>

        {/* Headlines / Cinema tabs */}
        <View style={styles.modeRow}>
          <Pressable style={styles.modeTab} onPress={() => setMode('headlines')} accessibilityRole="button" accessibilityLabel="Headlines">
            <Text style={[styles.modeTabText, mode === 'headlines' && styles.modeTabTextActive]}>Headlines</Text>
            {mode === 'headlines' ? <View style={styles.modeUnderline} /> : null}
          </Pressable>
          <Pressable style={styles.modeTab} onPress={() => setMode('cinema')} accessibilityRole="button" accessibilityLabel="Cinema">
            <Text style={[styles.modeTabText, mode === 'cinema' && styles.modeTabTextActive]}>Cinema</Text>
            {mode === 'cinema' ? <View style={styles.modeUnderline} /> : null}
          </Pressable>
          <Pressable style={styles.modeTab} onPress={() => setMode('radar')} accessibilityRole="button" accessibilityLabel="On the Radar">
            <Text style={[styles.modeTabText, mode === 'radar' && styles.modeTabTextActive]}>On the Radar</Text>
            {mode === 'radar' ? <View style={styles.modeUnderline} /> : null}
          </Pressable>
        </View>

        {/* Category icon chips (headlines only) */}
        {mode === 'headlines' ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
            contentContainerStyle={styles.catRow}>
            {CATEGORY_FILTERS.map((cat) => {
              const active = filter === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  style={styles.catItem}
                  accessibilityRole="button"
                  accessibilityLabel={cat.label}
                  onPress={() => setFilter(cat.value)}>
                  <View style={[styles.catChip, active && styles.catChipActive]}>
                    <SymbolView name={cat.sf as any} size={26} tintColor={active ? '#fff' : '#888'} type="monochrome" />
                  </View>
                  <Text style={[styles.catChipLabel, active && styles.catChipLabelActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      {/* On the Radar mode */}
      {mode === 'radar' ? (
        <ScrollView contentContainerStyle={styles.movieContent} showsVerticalScrollIndicator={false}>
          {/* Category chips — same spec as Headlines */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.catScroll}
            contentContainerStyle={styles.catRow}>
            {RADAR_CATS.map((cat) => {
              const active = radarCat === cat.value;
              return (
                <Pressable
                  key={cat.value}
                  style={styles.catItem}
                  accessibilityRole="button"
                  accessibilityLabel={cat.label}
                  onPress={() => setRadarCat(cat.value)}>
                  <View style={[styles.catChip, active && styles.catChipActive]}>
                    <SymbolView name={cat.sf as any} size={26} tintColor={active ? '#fff' : '#888'} type="monochrome" />
                  </View>
                  <Text style={[styles.catChipLabel, active && styles.catChipLabelActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Films */}
          {radarCat === 'films' ? (
            <View>
              {(upcoming ?? []).length === 0 && !loadingUpcoming ? (
                <Text style={styles.empty}>No upcoming films found.</Text>
              ) : (
                (upcoming ?? []).map((film) => (
                  <Pressable
                    key={`radar-film-${film.id}`}
                    style={styles.radarRow}
                    onPress={() => openMovie(film)}>
                    {film.poster ? (
                      <Image source={{ uri: film.poster }} style={styles.radarPoster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.radarPoster, styles.radarPosterFallback]} />
                    )}
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle} numberOfLines={2}>{film.title}</Text>
                      <Text style={styles.radarDate}>{formatRadarDate(film.releaseDate)}</Text>
                      <View style={styles.radarTagRow}>
                        <View style={styles.radarTag}><Text style={styles.radarTagText}>Film</Text></View>
                      </View>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} style={{ width: 14, height: 14 }} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {/* Games */}
          {radarCat === 'games' ? (
            <View>
              {(upcomingGames ?? []).length === 0 && !loadingGames ? (
                <Text style={styles.empty}>No upcoming games found.</Text>
              ) : (
                (upcomingGames ?? []).map((game) => (
                  <Pressable
                    key={`radar-game-${game.id}`}
                    style={styles.radarRow}
                    onPress={() => router.push({ pathname: '/content-detail-modal', params: { title: game.title, type: 'play', poster: game.cover ?? '' } })}>
                    {game.cover ? (
                      <Image source={{ uri: game.cover }} style={styles.radarPoster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.radarPoster, styles.radarPosterFallback]}>
                        <Text style={{ fontSize: 22 }}>🎮</Text>
                      </View>
                    )}
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle} numberOfLines={2}>{game.title}</Text>
                      <Text style={styles.radarDate}>{formatRadarDate(game.releaseDate)}</Text>
                      <View style={styles.radarTagRow}>
                        {game.genre ? <View style={styles.radarTag}><Text style={styles.radarTagText}>{game.genre}</Text></View> : null}
                        {game.platforms.slice(0, 2).map((p) => (
                          <View key={p} style={styles.radarTag}><Text style={styles.radarTagText}>{p}</Text></View>
                        ))}
                      </View>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} style={{ width: 14, height: 14 }} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {/* TV */}
          {radarCat === 'tv' ? (
            <View>
              {(upcomingTV ?? []).length === 0 && !loadingTV ? (
                <Text style={styles.empty}>No upcoming TV shows found.</Text>
              ) : (
                (upcomingTV ?? []).map((show) => (
                  <Pressable
                    key={`radar-tv-${show.id}`}
                    style={styles.radarRow}
                    onPress={() => router.push({ pathname: '/content-detail-modal', params: { title: show.title, type: 'watch', mediaType: 'tv', poster: show.poster ?? '', externalId: String(show.id) } })}>
                    {show.poster ? (
                      <Image source={{ uri: show.poster }} style={styles.radarPoster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.radarPoster, styles.radarPosterFallback]}>
                        <Text style={{ fontSize: 22 }}>📺</Text>
                      </View>
                    )}
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle} numberOfLines={2}>{show.title}</Text>
                      <Text style={styles.radarDate}>{formatRadarDate(show.firstAirDate)}</Text>
                      <View style={styles.radarTagRow}>
                        <View style={styles.radarTag}><Text style={styles.radarTagText}>TV</Text></View>
                        {show.network ? <View style={styles.radarTag}><Text style={styles.radarTagText}>{show.network}</Text></View> : null}
                      </View>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} style={{ width: 14, height: 14 }} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {/* Albums */}
          {radarCat === 'albums' ? (
            <View>
              {(upcomingAlbums ?? []).length === 0 && !loadingAlbums ? (
                <Text style={styles.empty}>No upcoming albums found.</Text>
              ) : (
                (upcomingAlbums ?? []).map((album) => (
                  <Pressable
                    key={`radar-album-${album.id}`}
                    style={styles.radarRow}
                    onPress={() => router.push({ pathname: '/content-detail-modal', params: { title: album.title, type: 'listen', sub: album.artist, poster: album.cover ?? '' } })}>
                    {album.cover ? (
                      <Image source={{ uri: album.cover }} style={[styles.radarPoster, { borderRadius: 6 }]} resizeMode="cover"
                        onError={() => {}} />
                    ) : (
                      <View style={[styles.radarPoster, styles.radarPosterFallback]}>
                        <Text style={{ fontSize: 22 }}>🎵</Text>
                      </View>
                    )}
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle} numberOfLines={2}>{album.title}</Text>
                      <Text style={styles.radarDate}>{album.artist}</Text>
                      <View style={styles.radarTagRow}>
                        <View style={styles.radarTag}><Text style={styles.radarTagText}>{formatRadarDate(album.releaseDate)}</Text></View>
                        {album.albumType ? <View style={styles.radarTag}><Text style={[styles.radarTagText, { textTransform: 'capitalize' }]}>{album.albumType}</Text></View> : null}
                      </View>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} style={{ width: 14, height: 14 }} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {/* Books */}
          {radarCat === 'books' ? (
            <View>
              {(upcomingBooks ?? []).length === 0 && !loadingBooks ? (
                <Text style={styles.empty}>No upcoming books found.</Text>
              ) : (
                (upcomingBooks ?? []).map((book) => (
                  <Pressable
                    key={`radar-book-${book.id}`}
                    style={styles.radarRow}
                    onPress={() => router.push({ pathname: '/content-detail-modal', params: { title: book.title, type: 'read', sub: book.author, poster: book.cover ?? '' } })}>
                    {book.cover ? (
                      <Image source={{ uri: book.cover }} style={[styles.radarPoster, { borderRadius: 4 }]} resizeMode="cover" />
                    ) : (
                      <View style={[styles.radarPoster, styles.radarPosterFallback]}>
                        <Text style={{ fontSize: 22 }}>📚</Text>
                      </View>
                    )}
                    <View style={styles.radarBody}>
                      <Text style={styles.radarTitle} numberOfLines={2}>{book.title}</Text>
                      <Text style={styles.radarDate}>{book.author}</Text>
                      <View style={styles.radarTagRow}>
                        <View style={styles.radarTag}><Text style={styles.radarTagText}>{book.publishDate}</Text></View>
                        {book.subject ? <View style={styles.radarTag}><Text style={styles.radarTagText} numberOfLines={1}>{book.subject}</Text></View> : null}
                      </View>
                    </View>
                    <SymbolView name="chevron.right" size={14} tintColor={Brand.muted} style={{ width: 14, height: 14 }} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {/* Podcasts */}

          <View style={{ height: Spacing.six }} />
        </ScrollView>
      ) : null}

      {/* Cinema mode */}
      {mode === 'cinema' ? (
        <ScrollView contentContainerStyle={styles.movieContent}>
          {loadingNow && loadingUpcoming ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={Brand.trust} />
          ) : null}
          <Text style={styles.sectionTitle}>In cinemas now</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={nowPlaying ?? []}
            keyExtractor={(m) => `now-${m.id}`}
            contentContainerStyle={styles.circleRow}
            ItemSeparatorComponent={MovieRowSeparator}
            renderItem={({ item }) => (
              <MovieCircle title={item.title} poster={item.poster} boxOffice={boxOfficeByMovie.get(item.id)} onPress={() => openMovie(item)} />
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
            ItemSeparatorComponent={MovieRowSeparator}
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

          {/* Box Office Top 10 */}
          {boxOffice && boxOffice.length > 0 ? (
            <View style={styles.boxOfficeSection}>
              <Text style={styles.sectionTitle}>Box Office Top 10</Text>
              {boxOffice.map((entry, i) => (
                  <Pressable
                    key={entry.id}
                    style={styles.boRow}
                    onPress={() => openMovie({ id: entry.id, title: entry.title, poster: entry.poster, releaseDate: entry.releaseDate })}>
                    <Text style={styles.boRank}>{String(i + 1).padStart(2, '0')}</Text>
                    {entry.poster ? (
                      <Image source={{ uri: entry.poster }} style={styles.boPoster} resizeMode="cover" />
                    ) : (
                      <View style={[styles.boPoster, styles.boPosterFallback]} />
                    )}
                    <View style={styles.boBody}>
                      <View style={styles.boTitleRow}>
                        <Text style={styles.boTitle} numberOfLines={1}>{entry.title}</Text>
                        {entry.weeksInTheater === 1 ? (
                          <View style={styles.boNewBadge}><Text style={styles.boNewText}>NEW</Text></View>
                        ) : null}
                        {entry.revenue > 0 ? (
                          <Text style={styles.boRevenue}>{formatRevenue(entry.revenue)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.boWeeks}>
                        {entry.weeksInTheater === 1 ? 'New this week' : `Week ${entry.weeksInTheater}`}
                      </Text>
                      <View style={styles.boBarTrack}>
                        <View style={[styles.boBarFill, { width: `${Math.round((entry.revenue / maxRevenue) * 100)}%` as any }]} />
                      </View>
                    </View>
                  </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
      ) : null}

      {/* Headlines mode */}
      {mode === 'headlines' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Brand.trust}
            />
          }>
          {isLoading && articles.length === 0 ? (
            <ActivityIndicator style={{ marginTop: 60 }} color={Brand.trust} />
          ) : articles.length === 0 ? (
            <Text style={styles.empty}>
              {isError ? "Couldn't load stories — pull down to try again." : 'No stories found right now.'}
            </Text>
          ) : null}

          {/* Trending Now */}
          {trending.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Trending Now</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
                {trending.map((article, i) => (
                  <Pressable key={article.id} style={styles.trendingCard} onPress={() => openArticle(article)}>
                    {/* Image with rank badge overlaid */}
                    <View style={styles.trendingImgWrap}>
                      {article.thumbnail ? (
                        <Image source={{ uri: article.thumbnail }} style={styles.trendingImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.trendingImg, styles.trendingImgFallback]}>
                          <Text style={styles.trendingImgFallbackEmoji}>📰</Text>
                        </View>
                      )}
                      <Text style={styles.trendingNum}>{i + 1}</Text>
                    </View>
                    {/* Text below image */}
                    <Text style={styles.trendingTitle} numberOfLines={3}>{article.title}</Text>
                    <Text style={styles.trendingSource}>{article.section.toUpperCase()}</Text>
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
      ) : null}
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
      marginBottom: 7,
    },
    modeTab: { paddingBottom: 8 },
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

    // Category chips — same spec as FilterChips tiles
    catScroll: { marginBottom: 14 },
    catRow: { flexGrow: 1, justifyContent: 'center', gap: 4 },
    catItem: { alignItems: 'center', gap: 6 },
    catChip: {
      width: 58,
      height: 58,
      borderRadius: 16,
      backgroundColor: Brand.card,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 3,
    },
    catChipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust, shadowOpacity: 0.22, shadowRadius: 10 },
    catChipLabel: {
      fontFamily: BrandFonts.interMedium,
      fontSize: 11,
      color: Brand.muted,
      textAlign: 'center',
    },
    catChipLabelActive: { fontFamily: BrandFonts.syneBold, color: Brand.trust },

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
    trendingRow: { paddingHorizontal: Spacing.three, gap: 11, paddingBottom: 4 },
    trendingCard: {
      width: 132,
    },
    trendingImgWrap: {
      width: '100%',
      height: 171,
      borderRadius: 14,
      overflow: 'hidden',
      marginBottom: 8,
      backgroundColor: Brand.tlight,
    },
    trendingImg: { width: '100%', height: '100%' },
    trendingImgFallback: { backgroundColor: Brand.tlight, alignItems: 'center', justifyContent: 'center' },
    trendingImgFallbackEmoji: { fontSize: 40 },
    trendingNum: {
      position: 'absolute',
      top: 8,
      left: 10,
      zIndex: 1,
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 28,
      lineHeight: 30,
      color: '#fff',
      textShadowColor: 'rgba(0,0,0,0.4)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    trendingTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 14,
      color: Brand.ink,
      lineHeight: 19,
      marginBottom: 5,
    },
    trendingSource: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9.5,
      color: Brand.trust,
      letterSpacing: 0.6,
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

    // Box Office Top 10
    boxOfficeSection: { paddingHorizontal: Spacing.three, paddingTop: 4, paddingBottom: Spacing.two },
    boRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 12,
    },
    boRank: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 14,
      color: Brand.border,
      width: 24,
      textAlign: 'right',
    },
    boPoster: {
      width: 38,
      height: 54,
      borderRadius: 6,
      backgroundColor: Brand.border,
    },
    boPosterFallback: { backgroundColor: Brand.tlight },
    boBody: { flex: 1, gap: 3 },
    boTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    boTitle: {
      flex: 1,
      fontFamily: BrandFonts.syneBold,
      fontSize: 14,
      color: Brand.ink,
    },
    boNewBadge: {
      backgroundColor: Brand.trust,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    boNewText: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 9,
      color: '#fff',
      letterSpacing: 0.5,
    },
    boRevenue: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 14,
      color: Brand.trust,
    },
    boWeeks: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 12,
      color: Brand.muted,
    },
    boBarTrack: {
      height: 3,
      borderRadius: 2,
      backgroundColor: Brand.border,
      marginTop: 4,
    },
    boBarFill: {
      height: 3,
      borderRadius: 2,
      backgroundColor: Brand.trust,
    },

    // On the Radar
    radarRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginHorizontal: Spacing.three,
      marginBottom: 12,
      padding: 12,
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: Brand.border,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    radarPoster: {
      width: 52,
      height: 74,
      borderRadius: 8,
      backgroundColor: Brand.tlight,
      flexShrink: 0,
    },
    radarPosterFallback: { alignItems: 'center', justifyContent: 'center' },
    radarBody: { flex: 1, gap: 4 },
    radarTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, lineHeight: 19 },
    radarDate: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
    radarTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 2 },
    radarTag: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
      backgroundColor: Brand.tlight,
    },
    radarTagText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted },
    radarComingSoon: {
      alignItems: 'center',
      paddingVertical: 60,
      paddingHorizontal: Spacing.three,
    },
    radarComingSoonEmoji: { fontSize: 48, marginBottom: 16 },
    radarComingSoonTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 18,
      color: Brand.ink,
      marginBottom: 8,
      textAlign: 'center',
    },
    radarComingSoonBody: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 14,
      color: Brand.muted,
      textAlign: 'center',
      lineHeight: 20,
    },

    // Cinema / misc
    movieContent: { paddingTop: Spacing.two, paddingBottom: Spacing.six },
    sectionTitle: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 15,
      color: Brand.ink,
      marginBottom: 9,
      paddingHorizontal: Spacing.three,
    },
    circleRow: { paddingHorizontal: Spacing.three, paddingBottom: 12 },
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
