import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { SymbolView } from 'expo-symbols';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useCreatePremiere } from '@/features/premieres/api';
import { addPremiereToCalendar } from '@/features/premieres/use-add-to-calendar';
import { useProfile } from '@/features/profile/api';
import { useTitleSearch, useTVSeasons, useTVEpisodes, type SearchResult, type TvSeason, type TvEpisode } from '@/features/search/api';
import { useBrand } from '@/hooks/use-brand';
import { useShareIcons } from '@/hooks/use-share-icons';

type Step = 'search' | 'seasons' | 'episodes' | 'form';

export default function PremiereModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const ic = useShareIcons();
  const { data: profile } = useProfile();
  const createPremiere = useCreatePremiere();

  const params = useLocalSearchParams<{
    showTitle: string;
    showPoster: string;
    externalId: string;
    episodeName: string;
    episodeNumber: string;
    seasonNumber: string;
    airDate: string;
  }>();

  // If launched with params, skip search and go straight to form
  const hasParams = !!params.showTitle;
  const [step, setStep] = useState<Step>(hasParams ? 'form' : 'search');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const { data: searchResults = [], isFetching: searching } = useTitleSearch('watch', searchQuery);

  // Selection state
  const [selectedShow, setSelectedShow] = useState<SearchResult | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<TvEpisode | null>(null);

  const { data: seasons = [], isLoading: seasonsLoading } = useTVSeasons(
    step === 'seasons' ? (selectedShow?.externalId ?? null) : null
  );
  const { data: episodes = [], isLoading: episodesLoading } = useTVEpisodes(
    step === 'episodes' ? (selectedShow?.externalId ?? null) : null,
    selectedSeason
  );

  // Final show/episode values — from params or from search selection
  const showTitle = hasParams ? params.showTitle : (selectedShow?.title ?? '');
  const showPoster = hasParams ? params.showPoster : (selectedShow?.img ?? '');
  const externalId = hasParams ? params.externalId : (selectedShow?.externalId ?? '');
  const episodeName = hasParams ? params.episodeName : (selectedEpisode?.name ?? '');
  const episodeNumber = hasParams ? params.episodeNumber : String(selectedEpisode?.episodeNumber ?? '');
  const seasonNumber = hasParams ? params.seasonNumber : String(selectedEpisode?.seasonNumber ?? selectedSeason ?? '');
  const airDate = hasParams ? params.airDate : (selectedEpisode?.airDate ?? '');

  // Form state
  const [tagline, setTagline] = useState('');
  const [airTime, setAirTime] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [createdPremiereId, setCreatedPremiereId] = useState<string | null>(null);

  const tzAbbr = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return new Date().toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone: tz }).split(' ').pop() ?? '';
    } catch { return ''; }
  }, []);

  const cardRef = useRef<ViewShot>(null);
  const hostName = profile?.full_name ?? profile?.username ?? 'You';
  const airDateFormatted = airDate
    ? new Date(airDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : '';

  function handleSelectShow(result: SearchResult) {
    setSelectedShow(result);
    if (result.mediaType === 'movie') {
      // Movies don't have episodes — go straight to form with just show info
      setSelectedEpisode(null);
      setSelectedSeason(null);
      setStep('form');
    } else {
      setStep('seasons');
    }
  }

  function handleSelectSeason(season: TvSeason) {
    setSelectedSeason(season.seasonNumber);
    setStep('episodes');
  }

  function handleSelectEpisode(episode: TvEpisode) {
    setSelectedEpisode(episode);
    setStep('form');
  }

  async function handleCreate() {
    try {
      const premiere = await createPremiere.mutateAsync({
        showTitle,
        showPoster: showPoster || null,
        externalId: externalId || null,
        episodeName,
        episodeNumber: Number(episodeNumber),
        seasonNumber: Number(seasonNumber),
        airDate,
        airTime: airTime.trim() || null,
        tagline: tagline.trim() || null,
      });

      setIsSharing(true);
      try {
        if (cardRef.current) {
          const uri = await (cardRef.current as any).capture();
          setCapturedUri(uri);
        }
      } catch {}
      setCreatedPremiereId(premiere.id);
      setIsSharing(false);
      setShareSheetVisible(true);
    } catch {
      Alert.alert('Something went wrong', 'Could not create the premiere. Please try again.');
    }
  }

  // ── Step: Search ──────────────────────────────────────────────────────────
  if (step === 'search') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.heading}>Host a Watch Party</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.searchWrap}>
          <SymbolView name="magnifyingglass" size={15} tintColor={Brand.muted} type="monochrome" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search TV shows & movies…"
            placeholderTextColor={Brand.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searching && <ActivityIndicator size="small" color={Brand.trust} />}
        </View>

        <FlatList
          data={searchResults}
          keyExtractor={(r) => r.externalId ?? r.title}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={styles.resultRow} onPress={() => handleSelectShow(item)}>
              {item.img ? (
                <Image source={{ uri: item.img }} style={styles.resultPoster} />
              ) : (
                <View style={[styles.resultPoster, styles.resultPosterFallback]}>
                  <Text style={{ fontSize: 22 }}>🎬</Text>
                </View>
              )}
              <View style={styles.resultInfo}>
                <Text style={styles.resultTitle} numberOfLines={2}>{item.title}</Text>
                <Text style={styles.resultSub} numberOfLines={1}>{item.sub}</Text>
              </View>
              <SymbolView name="chevron.right" size={13} tintColor={Brand.muted} type="monochrome" />
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          ListEmptyComponent={
            searchQuery.length >= 2 && !searching ? (
              <Text style={styles.emptyText}>No results for "{searchQuery}"</Text>
            ) : searchQuery.length === 0 ? (
              <Text style={styles.emptyText}>Search for a show or movie to get started</Text>
            ) : null
          }
        />
      </SafeAreaView>
    );
  }

  // ── Step: Season picker ───────────────────────────────────────────────────
  if (step === 'seasons') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => setStep('search')} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.heading} numberOfLines={1}>{selectedShow?.title}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.stepHint}>Pick a season</Text>

        {seasonsLoading ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={seasons}
            keyExtractor={(s) => String(s.seasonNumber)}
            contentContainerStyle={styles.resultsList}
            renderItem={({ item: season }) => (
              <Pressable style={styles.resultRow} onPress={() => handleSelectSeason(season)}>
                {season.poster ? (
                  <Image source={{ uri: season.poster }} style={styles.resultPoster} />
                ) : (
                  <View style={[styles.resultPoster, styles.resultPosterFallback]}>
                    <Text style={{ fontSize: 22 }}>📺</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle}>Season {season.seasonNumber}</Text>
                  <Text style={styles.resultSub}>{season.episodeCount} episodes{season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ''}</Text>
                </View>
                <SymbolView name="chevron.right" size={13} tintColor={Brand.muted} type="monochrome" />
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Step: Episode picker ──────────────────────────────────────────────────
  if (step === 'episodes') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => setStep('seasons')} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.heading} numberOfLines={1}>Season {selectedSeason}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.stepHint}>Pick an episode</Text>

        {episodesLoading ? (
          <ActivityIndicator color={Brand.trust} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={episodes}
            keyExtractor={(e) => String(e.episodeNumber)}
            contentContainerStyle={styles.resultsList}
            renderItem={({ item: ep }) => (
              <Pressable style={styles.resultRow} onPress={() => handleSelectEpisode(ep)}>
                {ep.stillPath ? (
                  <Image source={{ uri: ep.stillPath }} style={styles.resultStill} />
                ) : (
                  <View style={[styles.resultStill, styles.resultPosterFallback]}>
                    <Text style={{ fontSize: 18 }}>🎬</Text>
                  </View>
                )}
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={1}>E{ep.episodeNumber} · {ep.name}</Text>
                  {ep.airDate ? <Text style={styles.resultSub}>{new Date(ep.airDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text> : null}
                </View>
                <SymbolView name="chevron.right" size={13} tintColor={Brand.muted} type="monochrome" />
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />
        )}
      </SafeAreaView>
    );
  }

  // ── Step: Form ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag">

        <View style={styles.header}>
          <Pressable onPress={() => hasParams ? router.back() : setStep(selectedShow?.mediaType === 'movie' ? 'search' : 'episodes')} hitSlop={8}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
          <Text style={styles.heading}>Create Premiere</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Show info */}
        <View style={styles.showRow}>
          {showPoster ? (
            <Image source={{ uri: showPoster }} style={styles.showPoster} />
          ) : (
            <View style={[styles.showPoster, styles.showPosterFallback]}>
              <Text style={{ fontSize: 28 }}>🎬</Text>
            </View>
          )}
          <View style={styles.showInfo}>
            <Text style={styles.showTitle} numberOfLines={2}>{showTitle}</Text>
            {episodeName ? (
              <Text style={styles.showEpisode}>
                {seasonNumber && episodeNumber ? `S${seasonNumber} E${episodeNumber} · ` : ''}{episodeName}
              </Text>
            ) : null}
            {airDateFormatted ? <Text style={styles.showAirDate}>📅 {airDateFormatted}</Text> : null}
          </View>
        </View>

        {/* Tagline */}
        <Text style={styles.sectionLabel}>Add a tagline</Text>
        <TextInput
          style={styles.taglineInput}
          placeholder={`e.g. "girls night for ${showTitle} 🍷"`}
          placeholderTextColor={Brand.muted}
          value={tagline}
          onChangeText={setTagline}
          maxLength={80}
          multiline
        />

        {/* Start time */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Start time</Text>
          {tzAbbr ? <Text style={styles.tzLabel}>{tzAbbr}</Text> : null}
        </View>
        <View style={styles.timeRow}>
          {['7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map((t) => (
            <Pressable
              key={t}
              style={[styles.timeChip, airTime === t && styles.timeChipActive]}
              onPress={() => setAirTime(airTime === t ? '' : t)}>
              <Text style={[styles.timeChipText, airTime === t && styles.timeChipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.taglineInput}
          placeholder="Or enter a custom time, e.g. 8:30 PM ET"
          placeholderTextColor={Brand.muted}
          value={airTime}
          onChangeText={setAirTime}
        />

        {/* Invite card preview */}
        <Text style={styles.sectionLabel}>Invite card preview</Text>
        <ViewShot ref={cardRef} options={{ format: 'png', quality: 1 }}>
          <InviteCard
            showTitle={showTitle}
            showPoster={showPoster}
            episodeName={episodeName}
            episodeNumber={episodeNumber}
            seasonNumber={seasonNumber}
            airDateFormatted={airDateFormatted}
            airTime={airTime ? `${airTime} ${tzAbbr}`.trim() : ''}
            hostName={hostName}
            hostAvatar={profile?.avatar_url ?? null}
            tagline={tagline}
          />
        </ViewShot>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable
          style={[styles.createBtn, createPremiere.isPending && styles.createBtnDisabled]}
          disabled={createPremiere.isPending || isSharing}
          onPress={handleCreate}>
          {createPremiere.isPending || isSharing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.createBtnText}>Create & Share Invite 🎬</Text>
          )}
        </Pressable>
      </View>

      {/* Share sheet */}
      <Modal visible={shareSheetVisible} transparent animationType="slide">
        <Pressable style={styles.shareBackdrop} onPress={() => {
          setShareSheetVisible(false);
          router.replace({ pathname: '/premiere-waiting-room', params: { id: createdPremiereId! } });
        }}>
          <Pressable style={styles.shareSheet} onPress={() => {}}>
            <View style={styles.shareGrabber} />
            <Text style={styles.shareTitle}>Share your watch party invite</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shareRow}>
              {[
                { label: 'Messages', icon: ic.messages,
                  onPress: async () => { if (capturedUri) await Share.share({ url: capturedUri, message: `Join my ${showTitle} watch party on Clique!\n\nthecliqueapp://premiere/${createdPremiereId}` }); } },
                { label: 'WhatsApp', icon: ic.whatsapp,
                  onPress: async () => {
                    if (capturedUri) {
                      await Share.share({
                        url: capturedUri,
                        message: `Join my ${showTitle} watch party on Clique!\n\nthecliqueapp://premiere/${createdPremiereId}`,
                      });
                    } else {
                      const msg = encodeURIComponent(`Join my ${showTitle} watch party on Clique!\n\nthecliqueapp://premiere/${createdPremiereId}`);
                      const ok = await Linking.canOpenURL('whatsapp://send');
                      if (ok) Linking.openURL(`whatsapp://send?text=${msg}`); else Alert.alert('WhatsApp not installed');
                    }
                  } },
                { label: 'Mail', icon: ic.mail,
                  onPress: async () => {
                    if (capturedUri) {
                      await Share.share({
                        url: capturedUri,
                        message: `Join my ${showTitle} watch party on Clique!\n\nthecliqueapp://premiere/${createdPremiereId}`,
                        title: `Join my ${showTitle} watch party on Clique`,
                      });
                    } else {
                      const subject = encodeURIComponent(`Join my ${showTitle} watch party on Clique`);
                      const body = encodeURIComponent(`Join my ${showTitle} watch party on Clique!\n\nthecliqueapp://premiere/${createdPremiereId}`);
                      Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
                    }
                  } },
                { label: 'AirDrop', icon: ic.airdrop,
                  onPress: async () => { if (capturedUri) await Share.share({ url: capturedUri }); } },
              ].map(({ label, icon, onPress }) => (
                <Pressable key={label} style={styles.shareItem} onPress={async () => { await onPress(); }}>
                  <Image source={icon} style={styles.shareIcon} />
                  <Text style={styles.shareLabel}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              style={styles.calendarBtn}
              onPress={() => addPremiereToCalendar({
                showTitle,
                episodeName,
                episodeNumber,
                seasonNumber,
                airDate,
                airTime: airTime.trim() || null,
                hostName,
                premiereId: createdPremiereId!,
              })}>
              <Text style={styles.calendarBtnText}>📅  Add to Calendar</Text>
            </Pressable>
            <Pressable style={styles.shareCancelBtn} onPress={() => {
              setShareSheetVisible(false);
              router.replace({ pathname: '/premiere-waiting-room', params: { id: createdPremiereId! } });
            }}>
              <Text style={styles.shareCancelText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function InviteCard({
  showTitle, showPoster, episodeName, episodeNumber, seasonNumber,
  airDateFormatted, airTime, hostName, hostAvatar, tagline,
}: {
  showTitle: string; showPoster: string; episodeName: string; episodeNumber: string;
  seasonNumber: string; airDateFormatted: string; airTime: string;
  hostName: string; hostAvatar: string | null; tagline: string;
}) {
  return (
    <View style={card.container}>
      <View style={card.inner}>
        <View style={card.badge}><Text style={card.badgeText}>PREMIERE</Text></View>
        <View style={card.mainRow}>
          {showPoster ? (
            <Image source={{ uri: showPoster }} style={card.poster} />
          ) : (
            <View style={[card.poster, card.posterFallback]}><Text style={{ fontSize: 36 }}>🎬</Text></View>
          )}
          <View style={card.details}>
            <Text style={card.showTitle} numberOfLines={2}>{showTitle}</Text>
            {seasonNumber && episodeNumber ? (
              <Text style={card.episode}>S{seasonNumber} E{episodeNumber}</Text>
            ) : null}
            {episodeName ? <Text style={card.episodeName} numberOfLines={2}>{episodeName}</Text> : null}
          </View>
        </View>
        {tagline ? <Text style={card.tagline}>"{tagline}"</Text> : null}
        <View style={card.divider} />
        <Text style={card.airDate}>{airDateFormatted}{airTime ? ` · ${airTime}` : ''}</Text>
        <View style={card.hostRow}>
          {hostAvatar ? (
            <Image source={{ uri: hostAvatar }} style={card.hostAvatar} />
          ) : (
            <View style={[card.hostAvatar, card.hostAvatarFallback]}>
              <Text style={card.hostInitial}>{hostName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <Text style={card.hostedBy}>Hosted by <Text style={card.hostName}>{hostName}</Text></Text>
        </View>
        <View style={card.joinBtn}><Text style={card.joinBtnText}>Join on Clique</Text></View>
      </View>
    </View>
  );
}

const card = StyleSheet.create({
  container: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#0F0D1A', marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#7C3AED' },
  inner: { padding: 22 },
  badge: { alignSelf: 'flex-start', backgroundColor: '#7C3AED', borderRadius: 6, paddingVertical: 3, paddingHorizontal: 10, marginBottom: 16 },
  badgeText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 10, color: '#fff', letterSpacing: 1.5 },
  mainRow: { flexDirection: 'row', gap: 14, marginBottom: 14 },
  poster: { width: 80, height: 112, borderRadius: 10, backgroundColor: '#2A2640' },
  posterFallback: { alignItems: 'center', justifyContent: 'center' },
  details: { flex: 1, justifyContent: 'center', gap: 4 },
  showTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: '#fff', lineHeight: 24 },
  episode: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#A78BFA', marginTop: 2 },
  episodeName: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: 'rgba(255,255,255,0.6)', lineHeight: 17 },
  tagline: { fontFamily: BrandFonts.interMedium, fontSize: 13.5, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', marginBottom: 14, lineHeight: 19 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 12 },
  airDate: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: '#FCD34D', marginBottom: 12 },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 },
  hostAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#7C3AED' },
  hostAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  hostInitial: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
  hostedBy: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: 'rgba(255,255,255,0.5)' },
  hostName: { fontFamily: BrandFonts.syneBold, color: '#fff' },
  joinBtn: { backgroundColor: '#7C3AED', borderRadius: 10, paddingVertical: 11, alignItems: 'center' },
  joinBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
});

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: Brand.paper, paddingTop: 20 },
    scroll: { flex: 1 },
    content: { padding: Spacing.three, paddingBottom: 160 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.three, paddingHorizontal: 7 },
    back: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.trust },
    heading: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink, flex: 1, textAlign: 'center' },
    stepHint: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted, paddingHorizontal: Spacing.three, marginBottom: 8 },
    searchWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: Brand.card,
      borderRadius: 14,
      marginHorizontal: Spacing.three,
      marginBottom: 12,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: Brand.border,
    },
    searchInput: { flex: 1, paddingVertical: 13, fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.ink },
    resultsList: { paddingHorizontal: Spacing.three, paddingBottom: Spacing.six },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
    resultPoster: { width: 46, height: 64, borderRadius: 8, backgroundColor: Brand.border },
    resultStill: { width: 80, height: 46, borderRadius: 8, backgroundColor: Brand.border },
    resultPosterFallback: { alignItems: 'center', justifyContent: 'center' },
    resultInfo: { flex: 1, minWidth: 0 },
    resultTitle: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 2 },
    resultSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    sep: { height: 1, backgroundColor: Brand.border },
    emptyText: { textAlign: 'center', paddingVertical: 40, fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted },
    showRow: { flexDirection: 'row', gap: 14, backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 16, padding: 12, marginBottom: Spacing.three },
    showPoster: { width: 60, height: 84, borderRadius: 8, backgroundColor: Brand.border },
    showPosterFallback: { alignItems: 'center', justifyContent: 'center' },
    showInfo: { flex: 1, justifyContent: 'center', gap: 3 },
    showTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    showEpisode: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    showAirDate: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#F59E0B', marginTop: 2 },
    sectionLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
    taglineInput: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: BrandFonts.interRegular, color: Brand.ink, backgroundColor: Brand.paper, marginBottom: Spacing.three, minHeight: 52 },
    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    tzLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11.5, color: Brand.muted, backgroundColor: Brand.border, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
    timeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
    timeChip: { borderWidth: 1.5, borderColor: Brand.border, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 14 },
    timeChipActive: { borderColor: '#7C3AED', backgroundColor: '#7C3AED' },
    timeChipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    timeChipTextActive: { color: '#fff' },
    footer: { padding: Spacing.three, borderTopWidth: 1, borderTopColor: Brand.border, backgroundColor: Brand.paper },
    calendarBtn: { borderWidth: 1.5, borderColor: '#7C3AED', borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginBottom: 10 },
    calendarBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: '#7C3AED' },
    createBtn: { backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
    createBtnDisabled: { opacity: 0.5 },
    createBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15.5, color: '#fff' },
    shareBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    shareSheet: { backgroundColor: Brand.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 36 },
    shareGrabber: { width: 40, height: 4, borderRadius: 2, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 16 },
    shareTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink, textAlign: 'center', marginBottom: 20 },
    shareRow: { gap: 16, paddingHorizontal: 4, paddingBottom: 4, marginBottom: 16 },
    shareItem: { alignItems: 'center', width: 72 },
    shareIcon: { width: 58, height: 58, borderRadius: 16, marginBottom: 7 },
    shareLabel: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.ink, textAlign: 'center' },
    shareCancelBtn: { paddingVertical: 13, borderRadius: 16, backgroundColor: Brand.card, alignItems: 'center' },
    shareCancelText: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.trust },
  });
}
