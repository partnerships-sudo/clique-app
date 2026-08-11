import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendCard } from '@/components/friends/friend-card';
import { FriendRequestCard } from '@/components/friends/friend-request-card';
import { InviteSheet } from '@/components/friends/invite-sheet';
import { SuggestedUserCard } from '@/components/friends/suggested-user-card';
import { UserSearch, type UserSearchHandle } from '@/components/friends/user-search';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useDmThreads } from '@/features/dms/api';
import { useFeedPosts } from '@/features/feed/api';
import {
  useAcceptFollowRequest,
  useCompatItems,
  useDeclineFollowRequest,
  useFollow,
  useFollowRequests,
  useFollowers,
  useFollowing,
  useSuggestedFollows,
  type Profile,
} from '@/features/follows/api';
import { computeCompatibility } from '@/features/friends/compatibility';
import {
  useAttendingPremieres,
  useDeletePremiere,
  useInviteToPremiere,
  useMyPremieres,
  useUpdatePremiere,
  useUpdateRsvp,
  type Premiere,
  type PremiereWithRsvp,
} from '@/features/premieres/api';
import {
  useMyScreeningRooms,
  useAttendingScreeningRooms,
  useDeleteScreeningRoom,
  type ScreeningRoom,
} from '@/features/screening-rooms/api';
import { DrumPicker, WheelColumn, daysInMonth, MONTH_LABELS } from '@/components/drum-picker';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

type FollowListTab = 'following' | 'followers' | 'watchparties';
type WatchPartyTab = 'hosting' | 'attending' | 'screening';

const WP_STATUS_LABEL: Record<string, string> = {
  waiting: 'Scheduled', live: 'Live now', ended: 'Ended', replay: 'Replay',
};
const WP_STATUS_COLOR: Record<string, string> = {
  waiting: '#F59E0B', live: '#22C55E', ended: '#6B7280', replay: '#8B5CF6',
};

function effectivePremiereStatus(item: { status: string; air_date: string | null; air_time: string | null }): string {
  if (item.status !== 'waiting') return item.status;
  if (!item.air_date) return item.status;
  // If the date itself is in the past (ignoring time), it's definitely ended
  const dateOnly = new Date(item.air_date + 'T23:59:00');
  if (!isNaN(dateOnly.getTime()) && dateOnly < new Date()) return 'ended';
  return item.status;
}

function formatPartyDate(airDate: string | null): string {
  if (!airDate) return '';
  try {
    return new Date(airDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch { return airDate; }
}

function effectiveScreeningStatus(item: ScreeningRoom): string {
  if (item.status !== 'waiting') return item.status;
  if (!item.air_date) return item.status;
  const d = new Date(item.air_date + 'T23:59:00');
  if (!isNaN(d.getTime()) && d < new Date()) return 'ended';
  return item.status;
}

function ScreeningRoomCard({ item, Brand, styles, deleteScreeningRoom }: {
  item: ScreeningRoom; Brand: BrandPalette; styles: any; deleteScreeningRoom: { mutate: (id: string) => void };
}) {
  const effStatus = effectiveScreeningStatus(item);
  const statusColor = effStatus === 'live' ? '#22C55E' : effStatus === 'ended' ? '#6B7280' : '#F59E0B';
  const statusLabel = effStatus === 'live' ? '● Live' : effStatus === 'ended' ? 'Ended' : 'Scheduled';
  const ended = effStatus === 'ended';
  const endedDate = item.ended_at
    ? new Date(item.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
  const airLine = item.air_date && item.air_time
    ? `${new Date(item.air_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${item.air_time}`
    : null;
  return (
    <View style={styles.wpCard}>
      <Pressable style={styles.wpCardMain} onPress={() => !ended && router.push({ pathname: '/screening-room-live', params: { id: item.id } })}>
        <View style={[styles.wpPoster, styles.wpPosterFallback, { backgroundColor: '#1A0E2E' }]}>
          <Text style={styles.wpPosterEmoji}>🎬</Text>
        </View>
        <View style={styles.wpCardInfo}>
          <View style={styles.wpStatusRow}>
            <Text style={[styles.wpStatusText, { color: statusColor }]}>{statusLabel}</Text>
            {ended && endedDate ? <Text style={styles.wpDate}>{endedDate}</Text> : null}
          </View>
          <Text style={styles.wpShowTitle} numberOfLines={1}>{item.title}</Text>
          {item.tagline ? <Text style={styles.wpEpisodeTitle} numberOfLines={1}>{item.tagline}</Text> : null}
          {!ended && airLine && <Text style={styles.wpDate}>{airLine}</Text>}
          {!ended && !airLine && <Text style={styles.wpDate}>{item.video_type === 'youtube' ? '▶ YouTube' : '▶ Direct video'}</Text>}
        </View>
      </Pressable>
      <View style={styles.wpCardActions}>
        {!ended ? (
          <Pressable style={styles.wpActionBtn} onPress={() => router.push({ pathname: '/screening-room-live', params: { id: item.id } })}>
            <SymbolView name="play.fill" size={14} tintColor={Brand.trust} type="monochrome" />
            <Text style={styles.wpActionBtnText}>Open</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.wpActionBtn} onPress={() => router.push({ pathname: '/screening-room-analytics-modal', params: { roomId: item.id, roomTitle: item.title } })}>
            <SymbolView name="chart.bar.fill" size={14} tintColor={Brand.trust} type="monochrome" />
            <Text style={styles.wpActionBtnText}>Analytics</Text>
          </Pressable>
        )}
        <Pressable style={[styles.wpActionBtn, styles.wpActionBtnDelete]} onPress={() =>
          Alert.alert('Delete screening room?', `"${item.title}" will be removed.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteScreeningRoom.mutate(item.id) },
          ])}>
          <SymbolView name="trash" size={14} tintColor="#E84F4F" type="monochrome" />
          <Text style={[styles.wpActionBtnText, { color: '#E84F4F' }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function WatchPartiesContent({ Brand, styles }: { Brand: BrandPalette; styles: any }) {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [wpTab, setWpTab] = useState<WatchPartyTab>(() =>
    params.tab === 'attending' ? 'attending' : 'hosting'
  );
  const [pastExpanded, setPastExpanded] = useState(false);
  const { data: hosted = [], isLoading: hostedLoading } = useMyPremieres();
  const { data: attending = [], isLoading: attendingLoading } = useAttendingPremieres() as { data: PremiereWithRsvp[]; isLoading: boolean };
  const updateRsvp = useUpdateRsvp();
  const { data: screeningRooms = [], isLoading: screeningLoading } = useMyScreeningRooms();
  const { data: attendingScreeningRooms = [] } = useAttendingScreeningRooms();
  const deleteScreeningRoom = useDeleteScreeningRoom();
  const updatePremiere = useUpdatePremiere();
  const deletePremiere = useDeletePremiere();
  const [editingPremiere, setEditingPremiere] = useState<Premiere | null>(null);

  // Watch party invite picker
  const [invitingParty, setInvitingParty] = useState<Premiere | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<Set<string>>(new Set());
  const [sendingInvites, setSendingInvites] = useState(false);
  const { data: following = [] } = useFollowing();
  const { user } = useSession();
  const inviteToPremiere = useInviteToPremiere();

  function openInvite(p: Premiere) {
    setInvitingParty(p);
    setSelectedFriends(new Set());
  }

  function toggleFriend(id: string) {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendInvites() {
    if (!invitingParty || selectedFriends.size === 0) return;
    setSendingInvites(true);
    try {
      await Promise.all([...selectedFriends].map(async (friendId) => {
        // useInviteToPremiere handles premiere_members insert + DM + push notification
        await inviteToPremiere.mutateAsync({ premiereId: invitingParty.id, friendId, showTitle: invitingParty.show_title });
      }));
      setInvitingParty(null);
    } catch {
      Alert.alert('Could not send invites', 'Please check your connection and try again.');
    } finally {
      setSendingInvites(false);
    }
  }
  const THIS_YEAR = new Date().getFullYear();
  const PARTY_YEARS = Array.from({ length: 4 }, (_, i) => String(THIS_YEAR + i));
  const [editDayIdx, setEditDayIdx] = useState(0);
  const [editMonthIdx, setEditMonthIdx] = useState(0);
  const [editYearIdx, setEditYearIdx] = useState(0);
  const [editHourIdx, setEditHourIdx] = useState(6); // default 7 (index 6)
  const [editMinIdx, setEditMinIdx] = useState(0);   // default :00
  const [editPeriodIdx, setEditPeriodIdx] = useState(1); // default PM
  const [editTagline, setEditTagline] = useState('');
  const dayScrollRef = useRef<ScrollView>(null);

  const editYear = THIS_YEAR + editYearIdx;
  const editDayItems = Array.from({ length: daysInMonth(editMonthIdx, editYear) }, (_, i) => String(i + 1));

  function openEdit(p: Premiere) {
    setEditingPremiere(p);
    if (p.air_date) {
      const d = new Date(p.air_date + 'T12:00:00');
      const yIdx = PARTY_YEARS.indexOf(String(d.getFullYear()));
      setEditYearIdx(yIdx >= 0 ? yIdx : 0);
      setEditMonthIdx(d.getMonth());
      setEditDayIdx(d.getDate() - 1);
    } else {
      setEditYearIdx(0);
      setEditMonthIdx(new Date().getMonth());
      setEditDayIdx(new Date().getDate() - 1);
    }
    // Parse air_time into wheel indices (e.g. "8:30 PM" or "20:30")
    const HOURS_PAD = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const MINUTES = ['00','15','30','45'];
    const timeStr = p.air_time ?? '';
    let hIdx = 6, mIdx = 0, pIdx = 1; // defaults: 07, :00, PM
    const m12 = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    const m24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (m12) {
      const h = parseInt(m12[1], 10);
      const mins = m12[2];
      const period = m12[3].toUpperCase();
      hIdx = Math.max(0, HOURS_PAD.indexOf(String(h).padStart(2, '0')));
      mIdx = Math.max(0, MINUTES.findIndex(v => v === mins.padStart(2, '0')));
      pIdx = period === 'AM' ? 0 : 1;
    } else if (m24) {
      let h = parseInt(m24[1], 10);
      const mins = m24[2];
      pIdx = h >= 12 ? 1 : 0;
      if (h === 0) h = 12;
      else if (h > 12) h -= 12;
      hIdx = Math.max(0, HOURS_PAD.indexOf(String(h).padStart(2, '0')));
      mIdx = Math.max(0, MINUTES.findIndex(v => v === mins.padStart(2, '0')));
    }
    setEditHourIdx(hIdx);
    setEditMinIdx(mIdx);
    setEditPeriodIdx(pIdx);
    setEditTagline(p.tagline ?? '');
  }

  async function handleSaveEdit() {
    if (!editingPremiere) return;
    const month = String(editMonthIdx + 1).padStart(2, '0');
    const day = String(editDayIdx + 1).padStart(2, '0');
    const HOURS_PAD = ['01','02','03','04','05','06','07','08','09','10','11','12'];
    const MINUTES = ['00','15','30','45'];
    const PERIODS = ['AM','PM'];
    const airTime = `${HOURS_PAD[editHourIdx]}:${MINUTES[editMinIdx]} ${PERIODS[editPeriodIdx]}`;
    await updatePremiere.mutateAsync({ id: editingPremiere.id, airDate: `${editYear}-${month}-${day}`, airTime, tagline: editTagline.trim() || null });
    setEditingPremiere(null);
  }

  function handleDelete(p: Premiere) {
    Alert.alert('Delete watch party?', `"${p.show_title}" will be removed and attendees won't be able to join.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deletePremiere.mutate(p.id, { onError: () => Alert.alert('Could not delete', 'Something went wrong. Please try again.') }) },
    ]);
  }

  const list = wpTab === 'hosting' ? hosted : wpTab === 'attending' ? attending : [];
  const loading = wpTab === 'hosting' ? hostedLoading : wpTab === 'attending' ? attendingLoading : screeningLoading;

  return (
    <>
      {/* Sub-tabs */}
      <View style={styles.wpTabRow}>
        {([
          { id: 'hosting' as const, label: 'Host', count: hosted.length },
          { id: 'attending' as const, label: "RSVP's", count: attending.length },
          { id: 'screening' as const, label: '🎬 Screenings', count: screeningRooms.length },
        ]).map((t) => (
          <Pressable key={t.id} style={[styles.wpSubTab, wpTab === t.id && styles.wpSubTabActive]} onPress={() => setWpTab(t.id)}>
            <Text style={[styles.wpSubTabText, wpTab === t.id && styles.wpSubTabTextActive]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Create button — only on hosting/screening tabs */}
      {wpTab !== 'attending' ? (
        <View style={styles.wpCreateRow}>
          <Pressable
            style={[styles.wpCreateBtn, wpTab === 'screening' && { backgroundColor: '#F59E0B' }]}
            onPress={() => wpTab === 'screening' ? router.push('/create-screening-room-modal') : router.push('/premiere-modal')}>
            <Text style={styles.wpCreateBtnText}>
              {wpTab === 'screening' ? '+ New Screening Room' : '+ Host a Watch Party'}
            </Text>
          </Pressable>
        </View>
      ) : null}

      {/* Content */}
      {wpTab === 'screening' ? (
        <>
          {screeningLoading ? <ActivityIndicator style={{ marginTop: 24 }} color={Brand.trust} /> : null}
          {screeningRooms.filter((r) => effectiveScreeningStatus(r) !== 'ended').length > 0 && (
            <>
              <Text style={styles.wpSectionHeader}>Active</Text>
              {screeningRooms.filter((r) => effectiveScreeningStatus(r) !== 'ended').map((item, i) => (
                <View key={item.id}>
                  {i > 0 && <View style={{ height: 12 }} />}
                  <ScreeningRoomCard item={item} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
                </View>
              ))}
            </>
          )}
          {screeningRooms.filter((r) => effectiveScreeningStatus(r) === 'ended').length > 0 && (
            <>
              <Text style={[styles.wpSectionHeader, { marginTop: 24 }]}>History</Text>
              {screeningRooms.filter((r) => effectiveScreeningStatus(r) === 'ended').map((item, i) => (
                <View key={item.id}>
                  {i > 0 && <View style={{ height: 12 }} />}
                  <ScreeningRoomCard item={item} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
                </View>
              ))}
            </>
          )}
          {!screeningLoading && screeningRooms.length === 0 && (
            <View style={styles.wpEmpty}>
              <Text style={styles.wpEmptyEmoji}>🎬</Text>
              <Text style={styles.wpEmptyTitle}>No screening rooms yet</Text>
              <Text style={styles.wpEmptySub}>Create one and invite your audience.</Text>
            </View>
          )}
        </>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color={Brand.trust} />
      ) : wpTab === 'attending' ? (
        (() => {
          const isActive = (p: PremiereWithRsvp) => { const s = effectivePremiereStatus(p); return s !== 'ended' && s !== 'replay'; };
          const invites = attending.filter((p) => p.rsvp_status === 'invited' && isActive(p));
          const going = attending.filter((p) => p.rsvp_status === 'attending' && isActive(p));
          const maybe = attending.filter((p) => p.rsvp_status === 'maybe' && isActive(p));
          const notGoing = attending.filter((p) => p.rsvp_status === 'not_attending' && isActive(p));
          const pastAttending = attending.filter((p) => !isActive(p));
          if (attending.length === 0) {
            return (
              <View style={styles.wpEmpty}>
                <Text style={styles.wpEmptyEmoji}>🎬</Text>
                <Text style={styles.wpEmptyTitle}>No RSVPs yet</Text>
                <Text style={styles.wpEmptySub}>Accept an invite or ask a friend to host one.</Text>
              </View>
            );
          }
          const renderRsvpCard = (item: PremiereWithRsvp) => {
            const effStatus = effectivePremiereStatus(item);
            const canEnter = effStatus === 'waiting' || effStatus === 'live';
            return (
              <View key={item.id} style={[styles.wpCard, { marginBottom: 12 }]}>
                <Pressable style={styles.wpCardMain} onPress={() =>
                  canEnter
                    ? router.push({ pathname: '/premiere-waiting-room', params: { id: item.id } })
                    : router.push({ pathname: '/premiere/[id]', params: { id: item.id } })}>
                  {item.show_poster ? (
                    <Image source={{ uri: item.show_poster }} style={styles.wpPoster} />
                  ) : (
                    <View style={[styles.wpPoster, styles.wpPosterFallback]}>
                      <Text style={styles.wpPosterEmoji}>🎬</Text>
                    </View>
                  )}
                  <View style={styles.wpCardInfo}>
                    <View style={styles.wpStatusRow}>
                      <View style={[styles.wpStatusDot, { backgroundColor: WP_STATUS_COLOR[effStatus] ?? '#6B7280' }]} />
                      <Text style={[styles.wpStatusText, { color: WP_STATUS_COLOR[effStatus] ?? Brand.muted }]}>
                        {WP_STATUS_LABEL[effStatus] ?? effStatus}
                      </Text>
                    </View>
                    <Text style={styles.wpShowTitle} numberOfLines={1}>{item.show_title}</Text>
                    {item.episode_name ? <Text style={styles.wpEpisodeTitle} numberOfLines={1}>S{item.season_number}E{item.episode_number} · {item.episode_name}</Text> : null}
                    {item.air_date ? <Text style={styles.wpDate}>📅 {formatPartyDate(item.air_date)}{item.air_time ? ` · ${item.air_time}` : ''}</Text> : null}
                    {item.tagline ? <Text style={styles.wpTagline} numberOfLines={1}>"{item.tagline}"</Text> : null}
                    <Text style={styles.wpHostedBy}>Hosted by {item.host_name}</Text>
                  </View>
                </Pressable>
                <View style={styles.wpCardActions}>
                  <Pressable
                    style={[styles.wpActionBtn, item.rsvp_status === 'attending' && { borderColor: Brand.trust }]}
                    hitSlop={16}
                    onPress={() => updateRsvp.mutate({ premiereId: item.id, status: 'attending' })}>
                    <Text style={[styles.wpActionBtnText, { color: item.rsvp_status === 'attending' ? Brand.trust : Brand.muted }]}>✓ Going</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.wpActionBtn, styles.wpActionBtnDelete, item.rsvp_status === 'maybe' && { borderColor: Brand.muted }]}
                    hitSlop={16}
                    onPress={() => updateRsvp.mutate({ premiereId: item.id, status: 'maybe' })}>
                    <Text style={[styles.wpActionBtnText, { color: item.rsvp_status === 'maybe' ? Brand.ink : Brand.muted }]}>? Maybe</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.wpActionBtn, styles.wpActionBtnDelete, item.rsvp_status === 'not_attending' && { borderColor: '#E84F4F' }]}
                    hitSlop={16}
                    onPress={() => updateRsvp.mutate({ premiereId: item.id, status: 'not_attending' })}>
                    <Text style={[styles.wpActionBtnText, { color: item.rsvp_status === 'not_attending' ? '#E84F4F' : Brand.muted }]}>✕ Can't</Text>
                  </Pressable>
                </View>
              </View>
            );
          };
          return (
            <>
              {invites.length > 0 && (
                <>
                  <Text style={styles.wpSectionHeader}>Invites</Text>
                  {invites.map(renderRsvpCard)}
                </>
              )}
              {going.length > 0 && (
                <>
                  <Text style={styles.wpSectionHeader}>Attending</Text>
                  {going.map(renderRsvpCard)}
                </>
              )}
              {maybe.length > 0 && (
                <>
                  <Text style={styles.wpSectionHeader}>Maybe</Text>
                  {maybe.map(renderRsvpCard)}
                </>
              )}
              {notGoing.length > 0 && (
                <>
                  <Text style={styles.wpSectionHeader}>Not Attending</Text>
                  {notGoing.map(renderRsvpCard)}
                </>
              )}
              {pastAttending.length > 0 && (
                <View style={{ marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border, paddingTop: 4 }}>
                  <Pressable
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}
                    onPress={() => setPastExpanded((v) => !v)}>
                    <Text style={{ fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted }}>
                      Past parties ({pastAttending.length})
                    </Text>
                    <Text style={{ color: Brand.muted, fontSize: 13 }}>{pastExpanded ? '▲' : '▼'}</Text>
                  </Pressable>
                  {pastExpanded && pastAttending.map(renderRsvpCard)}
                </View>
              )}
              {attendingScreeningRooms.length > 0 && (
                <>
                  <Text style={[styles.wpSectionHeader, { marginTop: 16 }]}>Screening Rooms</Text>
                  {attendingScreeningRooms.map((item, i) => (
                    <View key={item.id}>
                      {i > 0 && <View style={{ height: 12 }} />}
                      <ScreeningRoomCard item={item} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
                    </View>
                  ))}
                </>
              )}
            </>
          );
        })()
      ) : list.length === 0 ? (
        <View style={styles.wpEmpty}>
          <Text style={styles.wpEmptyEmoji}>🎬</Text>
          <Text style={styles.wpEmptyTitle}>No watch parties yet</Text>
          <Text style={styles.wpEmptySub}>Host one and invite your friends.</Text>
        </View>
      ) : (
        <>
          {list.filter((p) => { const s = effectivePremiereStatus(p); return s !== 'ended' && s !== 'replay'; }).map((item, i) => {
          const effStatus = effectivePremiereStatus(item);
          const canEnter = effStatus === 'waiting' || effStatus === 'live';
          return (
            <View key={item.id}>
              {i > 0 && <View style={{ height: 12 }} />}
              <View style={styles.wpCard}>
                <Pressable style={styles.wpCardMain} onPress={() =>
                  canEnter
                    ? router.push({ pathname: '/premiere-waiting-room', params: { id: item.id } })
                    : router.push({ pathname: '/premiere/[id]', params: { id: item.id } })}>
                  {item.show_poster ? (
                    <Image source={{ uri: item.show_poster }} style={styles.wpPoster} />
                  ) : (
                    <View style={[styles.wpPoster, styles.wpPosterFallback]}>
                      <Text style={styles.wpPosterEmoji}>🎬</Text>
                    </View>
                  )}
                  <View style={styles.wpCardInfo}>
                    <View style={styles.wpStatusRow}>
                      <View style={[styles.wpStatusDot, { backgroundColor: WP_STATUS_COLOR[effStatus] ?? '#6B7280' }]} />
                      <Text style={[styles.wpStatusText, { color: WP_STATUS_COLOR[effStatus] ?? Brand.muted }]}>
                        {WP_STATUS_LABEL[effStatus] ?? effStatus}
                      </Text>
                    </View>
                    <Text style={styles.wpShowTitle} numberOfLines={1}>{item.show_title}</Text>
                    {item.episode_name ? <Text style={styles.wpEpisodeTitle} numberOfLines={1}>S{item.season_number}E{item.episode_number} · {item.episode_name}</Text> : null}
                    {item.air_date ? <Text style={styles.wpDate}>📅 {formatPartyDate(item.air_date)}{item.air_time ? ` · ${item.air_time}` : ''}</Text> : null}
                    {item.tagline ? <Text style={styles.wpTagline} numberOfLines={1}>"{item.tagline}"</Text> : null}
                  </View>
                </Pressable>
                {effStatus !== 'ended' && effStatus !== 'replay' ? (
                  <View style={styles.wpCardActions}>
                    <Pressable style={styles.wpActionBtn} hitSlop={16} onPress={() => openInvite(item)}>
                      <SymbolView name="paperplane.fill" size={15} tintColor={Brand.trust} type="monochrome" />
                      <Text style={styles.wpActionBtnText}>Invite</Text>
                    </Pressable>
                    <Pressable style={[styles.wpActionBtn, styles.wpActionBtnDelete]} onPress={() => openEdit(item)} hitSlop={16}>
                      <SymbolView name="pencil" size={15} tintColor={Brand.trust} type="monochrome" />
                      <Text style={styles.wpActionBtnText}>Edit</Text>
                    </Pressable>
                    <Pressable style={[styles.wpActionBtn, styles.wpActionBtnDelete]} onPress={() => handleDelete(item)} hitSlop={16}>
                      <SymbolView name="trash" size={15} tintColor="#E84F4F" type="monochrome" />
                      <Text style={[styles.wpActionBtnText, { color: '#E84F4F' }]}>Delete</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          );
          })}
          {list.filter((p) => { const s = effectivePremiereStatus(p); return s === 'ended' || s === 'replay'; }).length > 0 && (
            <View style={{ marginTop: 24, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Brand.border, paddingTop: 4 }}>
              <Pressable
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}
                onPress={() => setPastExpanded((v) => !v)}>
                <Text style={{ fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.muted }}>
                  Past parties ({list.filter((p) => { const s = effectivePremiereStatus(p); return s === 'ended' || s === 'replay'; }).length})
                </Text>
                <Text style={{ color: Brand.muted, fontSize: 13 }}>{pastExpanded ? '▲' : '▼'}</Text>
              </Pressable>
              {pastExpanded && list.filter((p) => { const s = effectivePremiereStatus(p); return s === 'ended' || s === 'replay'; }).map((item, i) => {
                const effStatus = effectivePremiereStatus(item);
                return (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: 12 }} />}
                    <View style={styles.wpCard}>
                      <Pressable style={styles.wpCardMain} onPress={() => router.push({ pathname: '/premiere-replay', params: { id: item.id } })}>
                        {item.show_poster ? (
                          <Image source={{ uri: item.show_poster }} style={styles.wpPoster} />
                        ) : (
                          <View style={[styles.wpPoster, styles.wpPosterFallback]}>
                            <Text style={styles.wpPosterEmoji}>🎬</Text>
                          </View>
                        )}
                        <View style={styles.wpCardInfo}>
                          <View style={styles.wpStatusRow}>
                            <View style={[styles.wpStatusDot, { backgroundColor: WP_STATUS_COLOR[effStatus] ?? '#6B7280' }]} />
                            <Text style={[styles.wpStatusText, { color: WP_STATUS_COLOR[effStatus] ?? Brand.muted }]}>
                              {WP_STATUS_LABEL[effStatus] ?? effStatus}
                            </Text>
                          </View>
                          <Text style={styles.wpShowTitle} numberOfLines={1}>{item.show_title}</Text>
                          {item.episode_name ? <Text style={styles.wpEpisodeTitle} numberOfLines={1}>S{item.season_number}E{item.episode_number} · {item.episode_name}</Text> : null}
                          {item.air_date ? <Text style={styles.wpDate}>📅 {formatPartyDate(item.air_date)}{item.air_time ? ` · ${item.air_time}` : ''}</Text> : null}
                          {item.tagline ? <Text style={styles.wpTagline} numberOfLines={1}>"{item.tagline}"</Text> : null}
                        </View>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      )}

      {/* Edit modal */}
      <Modal visible={!!editingPremiere} transparent animationType="slide">
        {/* Backdrop sits in absolute layer so it never wraps the sheet */}
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setEditingPremiere(null)} />
        <View style={{ flex: 1, justifyContent: 'flex-end', pointerEvents: 'box-none' }}>
          <View style={styles.wpEditSheet}>
            <View style={styles.wpEditGrabber} />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.wpEditTitle}>Edit Watch Party</Text>
                {editingPremiere ? <Text style={styles.wpEditShow} numberOfLines={1}>{editingPremiere.show_title}{editingPremiere.episode_name ? ` · ${editingPremiere.episode_name}` : ''}</Text> : null}
              </View>
              <Pressable onPress={() => setEditingPremiere(null)} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: Brand.border, justifyContent: 'center', alignItems: 'center', marginLeft: 8, marginTop: 2 }}>
                <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted }}>✕</Text>
              </Pressable>
            </View>
            <View>
              {/* DATE section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.tlight, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <SymbolView name="calendar" size={18} tintColor={Brand.trust} />
                </View>
                <View>
                  <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, letterSpacing: 0.5, textTransform: 'uppercase' }}>Date</Text>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted }}>When is your watch party?</Text>
                </View>
              </View>
              <View style={{ backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1.5, borderColor: Brand.border, overflow: 'hidden', marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Brand.border }}>
                  {['DAY', 'MONTH', 'YEAR'].map((l, i) => (
                    <View key={l} style={{ flex: 1, flexDirection: 'row' }}>
                      {i > 0 && <View style={{ width: 1, backgroundColor: Brand.border }} />}
                      <Text style={{ flex: 1, textAlign: 'center', paddingVertical: 7, fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <WheelColumn items={editDayItems} selectedIndex={editDayIdx} onSelect={(idx) => { setEditDayIdx(idx); }} />
                  <View style={{ width: 1, backgroundColor: Brand.border }} />
                  <WheelColumn items={MONTH_LABELS} selectedIndex={editMonthIdx} onSelect={(idx) => { setEditMonthIdx(idx); const max = daysInMonth(idx, editYear) - 1; if (editDayIdx > max) setEditDayIdx(max); }} />
                  <View style={{ width: 1, backgroundColor: Brand.border }} />
                  <WheelColumn items={PARTY_YEARS} selectedIndex={editYearIdx} onSelect={(idx) => { setEditYearIdx(idx); const max = daysInMonth(editMonthIdx, THIS_YEAR + idx) - 1; if (editDayIdx > max) setEditDayIdx(max); }} />
                </View>
              </View>

              {/* START TIME section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.tlight, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <SymbolView name="clock" size={18} tintColor={Brand.trust} />
                </View>
                <View>
                  <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, letterSpacing: 0.5, textTransform: 'uppercase' }}>Start Time</Text>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted }}>What time does it start?</Text>
                </View>
              </View>
              <View style={{ backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1.5, borderColor: Brand.border, overflow: 'hidden', marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Brand.border }}>
                  {['HOUR', 'MIN', 'AM / PM'].map((l, i) => (
                    <View key={l} style={{ flex: 1, flexDirection: 'row' }}>
                      {i > 0 && <View style={{ width: 1, backgroundColor: Brand.border }} />}
                      <Text style={{ flex: 1, textAlign: 'center', paddingVertical: 7, fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8 }}>{l}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <WheelColumn items={['01','02','03','04','05','06','07','08','09','10','11','12']} selectedIndex={editHourIdx} onSelect={setEditHourIdx} />
                  <View style={{ width: 1, backgroundColor: Brand.border }} />
                  <WheelColumn items={['00','15','30','45']} selectedIndex={editMinIdx} onSelect={setEditMinIdx} />
                  <View style={{ width: 1, backgroundColor: Brand.border }} />
                  <WheelColumn items={['AM','PM']} selectedIndex={editPeriodIdx} onSelect={setEditPeriodIdx} />
                </View>
              </View>

              {/* TAGLINE section */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: Brand.tlight, justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                  <SymbolView name="tag" size={18} tintColor={Brand.trust} />
                </View>
                <View>
                  <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink, letterSpacing: 0.5, textTransform: 'uppercase' }}>Tagline</Text>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted }}>Add a short tagline for your party</Text>
                </View>
              </View>
              <TextInput style={[styles.wpFieldInput, { minHeight: 64, textAlignVertical: 'top' }]} value={editTagline} onChangeText={setEditTagline} placeholder='e.g. "girls night 🍷"' placeholderTextColor={Brand.muted} multiline maxLength={40} />
            </View>
            <Pressable style={[styles.wpSaveBtn, updatePremiere.isPending && { opacity: 0.5 }]} onPress={handleSaveEdit} disabled={updatePremiere.isPending}>
              {updatePremiere.isPending ? <ActivityIndicator color="#fff" /> : <Text style={styles.wpSaveBtnText}>Save changes</Text>}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Watch party invite picker */}
      <Modal visible={!!invitingParty} transparent animationType="slide" onRequestClose={() => setInvitingParty(null)}>
        <Pressable style={styles.wpEditBackdrop} onPress={() => setInvitingParty(null)}>
          <Pressable style={styles.wpEditSheet} onPress={() => {}}>
            <View style={styles.wpEditGrabber} />
            <Text style={styles.wpEditTitle}>Invite to Watch Party</Text>
            {invitingParty ? (
              <Text style={styles.wpEditShow} numberOfLines={1}>
                {invitingParty.show_title}{invitingParty.episode_name ? ` · ${invitingParty.episode_name}` : ''}
              </Text>
            ) : null}
            {following.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                <Text style={[styles.wpEditShow, { color: Brand.muted }]}>You're not following anyone yet</Text>
              </View>
            ) : (
              <FlatList
                data={following}
                keyExtractor={(f) => f.id}
                style={{ maxHeight: 340 }}
                contentContainerStyle={{ gap: 2, paddingVertical: 8 }}
                renderItem={({ item: f }) => {
                  const selected = selectedFriends.has(f.id);
                  return (
                    <Pressable
                      onPress={() => toggleFriend(f.id)}
                      style={[styles.wpInviteRow, selected && styles.wpInviteRowSelected]}>
                      <View style={styles.wpInviteAvatar}>
                        {f.avatar_url ? (
                          <Image source={{ uri: f.avatar_url }} style={styles.wpInviteAvatarImg} />
                        ) : (
                          <Text style={styles.wpInviteAvatarFallback}>
                            {(f.full_name ?? f.username ?? '?')[0].toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        {f.full_name ? <Text style={styles.wpInviteName}>{f.full_name}</Text> : null}
                        <Text style={styles.wpInviteUsername}>@{f.username}</Text>
                      </View>
                      {selected && (
                        <SymbolView name="checkmark.circle.fill" size={20} tintColor={Brand.trust} type="monochrome" />
                      )}
                    </Pressable>
                  );
                }}
              />
            )}
            <Pressable
              style={[styles.wpSaveBtn, (selectedFriends.size === 0 || sendingInvites) && { opacity: 0.4 }]}
              disabled={selectedFriends.size === 0 || sendingInvites}
              onPress={sendInvites}>
              {sendingInvites ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.wpSaveBtnText}>
                  {selectedFriends.size === 0 ? 'Select friends' : `Send to ${selectedFriends.size} friend${selectedFriends.size === 1 ? '' : 's'}`}
                </Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export default function FriendsScreen() {
  const { user } = useSession();
  const params = useLocalSearchParams<{ tab?: FollowListTab }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [tab, setTab] = useState<FollowListTab>(params.tab === 'followers' ? 'followers' : 'following');
  const {
    data: following,
    isLoading: followingLoading,
    isFetching: followingFetching,
    refetch: refetchFollowing,
  } = useFollowing();
  const {
    data: followers,
    isLoading: followersLoading,
    isFetching: followersFetching,
    refetch: refetchFollowers,
  } = useFollowers();
  const { data: requests } = useFollowRequests();
  const { data: suggestions } = useSuggestedFollows();
  const { allPosts } = useFeedPosts('all');
  const { data: compatItemsMap } = useCompatItems();
  const { threads: dmThreads } = useDmThreads();
  const acceptRequest = useAcceptFollowRequest();
  const declineRequest = useDeclineFollowRequest();
  const follow = useFollow();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const searchRef = useRef<UserSearchHandle>(null);

  const rawList = tab === 'following' ? following : tab === 'followers' ? followers : undefined;
  const isLoading = tab === 'following' ? followingLoading : followersLoading;
  const isFetching = tab === 'following' ? followingFetching : followersFetching;
  const refetch = tab === 'following' ? refetchFollowing : refetchFollowers;

  const compatScores = useMemo(() => {
    const map = new Map<string, number>();
    if (!user?.id || !compatItemsMap) return map;
    const myItems = compatItemsMap.get(user.id) ?? [];
    for (const [uid, items] of compatItemsMap) {
      if (uid === user.id) continue;
      map.set(uid, computeCompatibility(myItems, items));
    }
    return map;
  }, [compatItemsMap, user?.id]);

  const list = useMemo(() => {
    if (!rawList) return rawList;
    return [...rawList].sort((a, b) => (compatScores.get(b.id) ?? 0) - (compatScores.get(a.id) ?? 0));
  }, [rawList, compatScores]);

  const activePostByUser = useMemo(() => {
    const map = new Map<string, (typeof allPosts)[number]>();
    for (const post of allPosts) {
      const existing = map.get(post.user_id);
      if (!existing || new Date(post.created_at) > new Date(existing.created_at)) {
        map.set(post.user_id, post);
      }
    }
    return map;
  }, [allPosts]);

  const unreadFriendIds = useMemo(
    () => new Set((dmThreads ?? []).filter((t) => t.isUnread).map((t) => t.friendId)),
    [dmThreads],
  );

  const visibleSuggestions = useMemo(
    () => (suggestions ?? []).filter((s) => !dismissedIds.has(s.id)),
    [suggestions, dismissedIds],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header row — always visible */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Friends</Text>
        <View style={styles.headerActions}>
          {tab !== 'watchparties' && (
            <Pressable style={styles.inviteBtn} onPress={() => setInviteSheetVisible(true)}>
              <Text style={styles.inviteBtnText}>+ Invite</Text>
            </Pressable>
          )}
          <Pressable hitSlop={16} onPress={() => router.push('/discover-people-modal')}>
            <SymbolView name="person.badge.plus" size={22} tintColor={Brand.muted} style={{ width: 26, height: 24 }} />
          </Pressable>
        </View>
      </View>

      {/* Tab bar — always visible */}
      <View style={styles.tabRow}>
        <Pressable style={[styles.tabBtn, tab === 'following' && styles.tabBtnActive]} onPress={() => setTab('following')}>
          <Text style={[styles.tabBtnText, tab === 'following' && styles.tabBtnTextActive]}>
            Following {following?.length ?? ''}
          </Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'followers' && styles.tabBtnActive]} onPress={() => setTab('followers')}>
          <Text style={[styles.tabBtnText, tab === 'followers' && styles.tabBtnTextActive]}>
            Followers {followers?.length ?? ''}
          </Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, styles.tabBtnWatchParties, tab === 'watchparties' && styles.tabBtnActive]} onPress={() => setTab('watchparties')}>
          <Text style={[styles.tabBtnText, tab === 'watchparties' && styles.tabBtnTextActive]}>Watch Parties</Text>
        </Pressable>
      </View>

      {/* Content */}
      {tab === 'watchparties' ? (
        <ScrollView contentContainerStyle={styles.watchPartiesContent}>
          <WatchPartiesContent Brand={Brand} styles={styles} />
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          contentContainerStyle={styles.content}
          data={list ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} tintColor={Brand.trust} />
          }
          ListHeaderComponent={
            <View>
              <UserSearch ref={searchRef} />

              {requests?.length ? (
                <View style={styles.section}>
                  {requests.map((request) => (
                    <FriendRequestCard
                      key={request.followId}
                      request={request}
                      onAccept={() => acceptRequest.mutate(request, { onError: (err) => Alert.alert('Could not accept request', err.message) })}
                      onDecline={() => declineRequest.mutate(request.followId, { onError: (err) => Alert.alert('Could not decline request', err.message) })}
                    />
                  ))}
                </View>
              ) : null}

              {visibleSuggestions.length ? (
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabelInline}>People you may know</Text>
                    <Pressable hitSlop={16} onPress={() => router.push('/discover-people-modal')}>
                      <Text style={styles.seeAll}>See all</Text>
                    </Pressable>
                  </View>
                  <FlatList
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    data={visibleSuggestions}
                    keyExtractor={(p) => p.id}
                    contentContainerStyle={styles.suggestRow}
                    ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
                    renderItem={({ item: profile }) => (
                      <SuggestedUserCard
                        profile={profile}
                        mutualCount={profile.mutualCount}
                        isAdding={follow.isPending && follow.variables?.targetUserId === profile.id}
                        onAdd={() => follow.mutate({ targetUserId: profile.id, isTargetPrivate: profile.is_private })}
                        onDismiss={() => setDismissedIds((prev) => new Set(prev).add(profile.id))}
                      />
                    )}
                  />
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item, index }: { item: Profile; index: number }) => {
            const compat = compatScores.get(item.id) ?? 0;
            const activePost = activePostByUser.get(item.id) ?? null;
            const isFollowingBack = tab === 'followers' && (following ?? []).some((f) => f.id === item.id);
            return (
              <FriendCard
                profile={item}
                compatibility={compat}
                hasUnread={unreadFriendIds.has(item.id)}
                currentlyWatching={activePost}
                isTopMatch={index === 0 && tab === 'following'}
                onFollowBack={tab === 'followers' && !isFollowingBack ? () => follow.mutate({ targetUserId: item.id, isTargetPrivate: item.is_private ?? false }) : undefined}
              />
            );
          }}
          ListEmptyComponent={
            !isLoading ? (
              tab === 'following' ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>👥</Text>
                  <Text style={styles.emptyTitle}>Toto, I've a feeling we need more friends.</Text>
                  <Text style={styles.emptyBody}>Search above to find people you know on Clique.</Text>
                  <Pressable style={styles.emptyBtn} onPress={() => router.push('/discover-people-modal')}>
                    <Text style={styles.emptyBtnText}>Find people →</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>🌟</Text>
                  <Text style={styles.emptyTitle}>No followers yet.</Text>
                  <Text style={styles.emptyBody}>Fame is fleeting, but great taste is forever. Keep logging.</Text>
                </View>
              )
            ) : null
          }
        />
      )}

      <InviteSheet visible={inviteSheetVisible} onClose={() => setInviteSheetVisible(false)} />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: Brand.paper },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: 16 },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink, flex: 1 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    inviteBtn: { backgroundColor: Brand.trust, borderRadius: 50, paddingVertical: 6, paddingHorizontal: 14 },
    inviteBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    tabRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Brand.border, marginBottom: 0, paddingHorizontal: Spacing.three },
    tabBtn: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
    tabBtnWatchParties: { marginRight: 0, marginLeft: 'auto' },
    tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: Brand.trust },
    tabBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.muted },
    tabBtnTextActive: { color: Brand.ink },
    content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
    watchPartiesContent: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
    section: { marginBottom: Spacing.two },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    sectionLabelInline: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 1 },
    seeAll: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.trust },
    suggestRow: { paddingBottom: 4 },
    emptyWrap: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink, marginBottom: 8, textAlign: 'center' },
    emptyBody: { fontFamily: BrandFonts.interRegular, fontSize: 13.6, color: Brand.muted, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
    emptyBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 22 },
    emptyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },

    // Watch Parties styles
    wpTabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Brand.border, marginBottom: 16 },
    wpSubTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    wpSubTabActive: { borderBottomColor: Brand.trust },
    wpSubTabText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    wpSubTabTextActive: { color: Brand.trust },
    wpCreateRow: { marginBottom: 20 },
    wpCreateBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    wpCreateBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    wpSectionHeader: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 10 },
    wpCard: { backgroundColor: Brand.card, borderRadius: 16, borderWidth: 1, borderColor: Brand.border, overflow: 'hidden' },
    wpCardMain: { flexDirection: 'row', padding: 14, gap: 12 },
    wpPoster: { width: 56, height: 84, borderRadius: 8 },
    wpPosterFallback: { backgroundColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
    wpPosterEmoji: { fontSize: 24 },
    wpCardInfo: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
    wpStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    wpStatusDot: { width: 6, height: 6, borderRadius: 3 },
    wpStatusText: { fontFamily: BrandFonts.syneBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    wpShowTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    wpEpisodeTitle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    wpDate: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink, marginTop: 2 },
    wpTagline: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, fontStyle: 'italic' },
    wpHostedBy: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 2 },
    wpCardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: Brand.border },
    wpActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
    wpActionBtnDelete: { borderLeftWidth: 1, borderLeftColor: Brand.border },
    wpActionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },
    wpEmpty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24, gap: 8 },
    wpEmptyEmoji: { fontSize: 44, marginBottom: 4 },
    wpEmptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    wpEmptySub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
    wpEditBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    wpEditSheet: { backgroundColor: Brand.paper, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.three, paddingBottom: 36, maxHeight: '92%', borderWidth: 1.5, borderBottomWidth: 0, borderColor: Brand.border, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 },
    wpEditGrabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 16 },
    wpEditTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, marginBottom: 4 },
    wpEditShow: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginBottom: 20 },
    wpFieldLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: 14 },
    wpFieldInput: { backgroundColor: Brand.card, borderRadius: 12, borderWidth: 1, borderColor: Brand.border, paddingHorizontal: 14, paddingVertical: 11, fontFamily: BrandFonts.interRegular, fontSize: 15, color: Brand.ink },
    wpTimeRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    wpTimeChip: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: Brand.border, backgroundColor: Brand.card },
    wpTimeChipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    wpTimeChipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    wpSaveBtn: { backgroundColor: Brand.trust, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
    wpSaveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },

    wpInviteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderRadius: 12,
    },
    wpInviteRowSelected: { backgroundColor: Brand.tlight },
    wpInviteAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Brand.card,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    wpInviteAvatarImg: { width: 40, height: 40, borderRadius: 20 },
    wpInviteAvatarFallback: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: Brand.ink },
    wpInviteName: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    wpInviteUsername: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },
  });
}
