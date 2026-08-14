import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ViewShot from 'react-native-view-shot';
import { SymbolView } from 'expo-symbols';

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { DrumPicker, WheelColumn, daysInMonth, MONTH_LABELS } from '@/components/drum-picker';
import { useCreatePremiere } from '@/features/premieres/api';
import { addPremiereToCalendar } from '@/features/premieres/use-add-to-calendar';
import { useProfile } from '@/features/profile/api';
import { useTitleSearch, useTVSeasons, useTVEpisodes, type SearchResult, type TvSeason, type TvEpisode } from '@/features/search/api';
import { useDmThreads } from '@/features/dms/api';
import { useInviteToPremiere } from '@/features/premieres/api';
import { Avatar } from '@/components/avatar';
import { useBrand } from '@/hooks/use-brand';

type Step = 'search' | 'seasons' | 'episodes' | 'form';

export default function PremiereModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
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

  // Drum-picker constants
  const THIS_YEAR = new Date().getFullYear();
  const PARTY_YEARS = Array.from({ length: 4 }, (_, i) => String(THIS_YEAR + i));
  const HOURS_PAD = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const MINUTES = ['00','15','30','45'];
  const PERIODS = ['AM','PM'];

  // Date wheel state — default to today
  const [dayIdx, setDayIdx] = useState(new Date().getDate() - 1);
  const [monthIdx, setMonthIdx] = useState(new Date().getMonth());
  const [yearIdx, setYearIdx] = useState(0);
  // Time wheel state — default 7:00 PM
  const [hourIdx, setHourIdx] = useState(6);
  const [minIdx, setMinIdx] = useState(0);
  const [periodIdx, setPeriodIdx] = useState(1);

  const partyYear = THIS_YEAR + yearIdx;
  const dayItems = Array.from({ length: daysInMonth(monthIdx, partyYear) }, (_, i) => String(i + 1));

  // Derived strings used downstream
  const partyDate = `${partyYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayIdx + 1).padStart(2, '0')}`;
  const airTime = `${HOURS_PAD[hourIdx]}:${MINUTES[minIdx]} ${PERIODS[periodIdx]}`;

  // Sync wheels when episode air date changes
  const prevAirDate = useRef('');
  if (airDate !== prevAirDate.current) {
    prevAirDate.current = airDate;
    const isUpcoming = airDate ? new Date(airDate + 'T12:00:00') > new Date() : false;
    if (isUpcoming) {
      const d = new Date(airDate + 'T12:00:00');
      const yIdx = PARTY_YEARS.indexOf(String(d.getFullYear()));
      setYearIdx(yIdx >= 0 ? yIdx : 0);
      setMonthIdx(d.getMonth());
      setDayIdx(d.getDate() - 1);
    }
  }

  // Form state
  const [tagline, setTagline] = useState('');
  const [buyUrl, setBuyUrl] = useState('');
  const [buyLabel, setBuyLabel] = useState('');
  const isUpperTier = (profile?.verified_tier ?? 0) >= 2;
  const [isSharing, setIsSharing] = useState(false);
  const [shareSheetVisible, setShareSheetVisible] = useState(false);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [createdPremiereId, setCreatedPremiereId] = useState<string | null>(null);
  const [sentToIds, setSentToIds] = useState<Set<string>>(new Set());
  const { threads: dmThreads } = useDmThreads();
  const inviteToPremiere = useInviteToPremiere();

  const tzAbbr = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return new Date().toLocaleTimeString('en-US', { timeZoneName: 'short', timeZone: tz }).split(' ').pop() ?? '';
    } catch { return ''; }
  }, []);

  const cardRef = useRef<ViewShot>(null);
  const hostName = profile?.full_name ?? profile?.username ?? 'You';
  const airDateFormatted = partyDate
    ? new Date(partyDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
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
    if (!showTitle.trim()) {
      Alert.alert('Missing title', 'Please select a show or movie first.');
      return;
    }
    // partyDate is always valid — derived from wheel indices
    try {
      const isMovie = selectedShow?.mediaType === 'movie' || (hasParams && !params.episodeNumber);
      const premiere = await createPremiere.mutateAsync({
        showTitle,
        showPoster: showPoster || null,
        externalId: externalId || null,
        episodeName: isMovie ? '' : episodeName,
        episodeNumber: isMovie ? 0 : (Number(episodeNumber) || 0),
        seasonNumber: isMovie ? 0 : (Number(seasonNumber) || 0),
        airDate: partyDate,
        airTime: airTime.trim() || null,
        tagline: tagline.trim() || null,
        buyUrl: isUpperTier && buyUrl.trim().startsWith('https://') ? buyUrl.trim() : null,
        buyLabel: isUpperTier && buyUrl.trim() ? (buyLabel.trim() || 'Buy / Rent Now') : null,
      });

      setIsSharing(true);
      try {
        if (cardRef.current && typeof (cardRef.current as { capture?: () => Promise<string> }).capture === 'function') {
          const uri = await (cardRef.current as { capture: () => Promise<string> }).capture();
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
          <Pressable onPress={() => router.back()} hitSlop={16}>
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
          <Pressable onPress={() => setStep('search')} hitSlop={16}>
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
          <Pressable onPress={() => setStep('seasons')} hitSlop={16}>
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
          <Pressable onPress={() => hasParams ? router.back() : setStep(selectedShow?.mediaType === 'movie' ? 'search' : 'episodes')} hitSlop={16}>
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

        {/* Buy / Rent link — upper-tier verified only */}
        {isUpperTier && (
          <>
            <Text style={styles.sectionLabel}>Buy / Rent link <Text style={{ color: Brand.muted, fontFamily: BrandFonts.interRegular }}>(optional)</Text></Text>
            <TextInput
              style={styles.taglineInput}
              placeholder="https://tv.apple.com/..."
              placeholderTextColor={Brand.muted}
              value={buyUrl}
              onChangeText={setBuyUrl}
              autoCapitalize="none"
              keyboardType="url"
              autoCorrect={false}
            />
            {buyUrl.trim().length > 0 && (
              <TextInput
                style={[styles.taglineInput, { marginTop: 8 }]}
                placeholder='Button label, e.g. "Buy on Apple TV"'
                placeholderTextColor={Brand.muted}
                value={buyLabel}
                onChangeText={setBuyLabel}
                maxLength={40}
              />
            )}
          </>
        )}

        {/* Watch party date */}
        <Text style={styles.sectionLabel}>Watch party date</Text>
        <View style={styles.drumCard}>
          <View style={styles.drumHeader}>
            {['MONTH', 'DAY', 'YEAR'].map((l, i) => (
              <View key={l} style={{ flex: 1, flexDirection: 'row' }}>
                {i > 0 && <View style={styles.drumDividerV} />}
                <Text style={styles.drumColLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <WheelColumn
              items={MONTH_LABELS}
              selectedIndex={monthIdx}
              onSelect={(i) => { setMonthIdx(i); const max = daysInMonth(i, partyYear) - 1; if (dayIdx > max) setDayIdx(max); }}
            />
            <View style={styles.drumDividerV} />
            <WheelColumn
              items={dayItems}
              selectedIndex={dayIdx}
              onSelect={setDayIdx}
            />
            <View style={styles.drumDividerV} />
            <WheelColumn
              items={PARTY_YEARS}
              selectedIndex={yearIdx}
              onSelect={(i) => { setYearIdx(i); const max = daysInMonth(monthIdx, THIS_YEAR + i) - 1; if (dayIdx > max) setDayIdx(max); }}
            />
          </View>
        </View>

        {/* Start time */}
        <View style={styles.sectionLabelRow}>
          <Text style={styles.sectionLabel}>Start time</Text>
          {tzAbbr ? <Text style={styles.tzLabel}>{tzAbbr}</Text> : null}
        </View>
        <View style={styles.drumCard}>
          <View style={styles.drumHeader}>
            {['HOUR', 'MIN', 'AM / PM'].map((l, i) => (
              <View key={l} style={{ flex: 1, flexDirection: 'row' }}>
                {i > 0 && <View style={styles.drumDividerV} />}
                <Text style={styles.drumColLabel}>{l}</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row' }}>
            <WheelColumn items={HOURS_PAD} selectedIndex={hourIdx} onSelect={setHourIdx} />
            <View style={styles.drumDividerV} />
            <WheelColumn items={MINUTES} selectedIndex={minIdx} onSelect={setMinIdx} />
            <View style={styles.drumDividerV} />
            <WheelColumn items={PERIODS} selectedIndex={periodIdx} onSelect={setPeriodIdx} />
          </View>
        </View>

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
            <Text style={styles.shareTitle}>Invite friends</Text>
            <FlatList
              data={dmThreads}
              keyExtractor={(t) => t.friendId}
              style={styles.sharePickerList}
              renderItem={({ item: thread }) => {
                const sent = sentToIds.has(thread.friendId);
                return (
                  <Pressable
                    style={styles.sharePickerRow}
                    onPress={async () => {
                      if (sent || !createdPremiereId) return;
                      await inviteToPremiere.mutateAsync({ premiereId: createdPremiereId, friendId: thread.friendId, showTitle });
                      setSentToIds((prev) => new Set([...prev, thread.friendId]));
                    }}>
                    <Avatar name={thread.name} size={36} avatarUrl={thread.avatarUrl} />
                    <Text style={styles.sharePickerName}>{thread.name}</Text>
                    <Text style={[styles.sharePickerSend, sent && styles.sharePickerSent]}>
                      {sent ? '✓ Invited' : 'Invite'}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={<Text style={styles.sharePickerEmpty}>No friends yet — follow someone first.</Text>}
            />
            <Pressable
              style={styles.calendarBtn}
              onPress={() => addPremiereToCalendar({
                showTitle, episodeName, episodeNumber, seasonNumber,
                airDate: partyDate, airTime: airTime.trim() || null,
                hostName, premiereId: createdPremiereId!,
              })}>
              <Text style={styles.calendarBtnText}>📅  Add to Calendar</Text>
            </Pressable>
            <Pressable style={styles.shareCancelBtn} onPress={() => {
              setShareSheetVisible(false);
              setSentToIds(new Set());
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
    drumCard: { backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1.5, borderColor: Brand.border, overflow: 'hidden', marginBottom: 20 },
    drumHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Brand.border },
    drumColLabel: { flex: 1, textAlign: 'center', paddingVertical: 7, fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
    drumDividerV: { width: 1, backgroundColor: Brand.border },
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
    cliqueShareIcon: { width: 58, height: 58, borderRadius: 16, marginBottom: 7, backgroundColor: Brand.trust, alignItems: 'center', justifyContent: 'center' },
    cliqueShareIconText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 26, color: '#fff' },
    sharePickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sharePickerBack: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: Brand.trust, width: 50 },
    sharePickerList: { maxHeight: 280, marginBottom: 16 },
    sharePickerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Brand.border },
    sharePickerName: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: Brand.ink, flex: 1 },
    sharePickerSend: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },
    sharePickerSent: { color: '#22C55E' },
    sharePickerEmpty: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, textAlign: 'center', paddingVertical: 20 },
  });
}
