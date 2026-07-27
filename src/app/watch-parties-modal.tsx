import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
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

import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import {
  useAttendingPremieres,
  useDeletePremiere,
  useMyPremieres,
  useUpdatePremiere,
  type Premiere,
} from '@/features/premieres/api';
import {
  useMyScreeningRooms,
  useDeleteScreeningRoom,
  type ScreeningRoom,
} from '@/features/screening-rooms/api';
import { useBrand } from '@/hooks/use-brand';

type Tab = 'hosting' | 'attending' | 'screening';

const STATUS_LABEL: Record<string, string> = {
  waiting: 'Scheduled',
  live: 'Live now',
  ended: 'Ended',
  replay: 'Replay',
};

const STATUS_COLOR: Record<string, string> = {
  waiting: '#F59E0B',
  live: '#22C55E',
  ended: '#6B7280',
  replay: '#8B5CF6',
};

function formatPartyDate(airDate: string | null): string {
  if (!airDate) return '';
  try {
    return new Date(airDate + 'T12:00:00').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return airDate;
  }
}

function ScreeningRoomCard({
  item,
  Brand,
  styles,
  deleteScreeningRoom,
}: {
  item: ScreeningRoom;
  Brand: BrandPalette;
  styles: ReturnType<typeof createStyles>;
  deleteScreeningRoom: { mutate: (id: string) => void };
}) {
  const statusColor = item.status === 'live' ? '#22C55E' : item.status === 'ended' ? '#6B7280' : '#F59E0B';
  const statusLabel = item.status === 'live' ? '● Live' : item.status === 'ended' ? 'Ended' : 'Waiting';
  const ended = item.status === 'ended';
  const endedDate = item.ended_at
    ? new Date(item.ended_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : item.created_at
      ? new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.cardMain}
        onPress={() => !ended && router.push({ pathname: '/screening-room-live', params: { id: item.id } })}>
        <View style={[styles.poster, styles.posterFallback, { backgroundColor: '#1A0E2E' }]}>
          <Text style={styles.posterEmoji}>🎬</Text>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.statusRow}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
            {ended && endedDate ? <Text style={styles.date}>{endedDate}</Text> : null}
          </View>
          <Text style={styles.showTitle} numberOfLines={1}>{item.title}</Text>
          {item.description ? <Text style={styles.episodeTitle} numberOfLines={1}>{item.description}</Text> : null}
          {!ended && (
            <Text style={styles.date}>{item.video_type === 'youtube' ? '▶ YouTube' : '▶ Direct video'}</Text>
          )}
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        {!ended ? (
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/screening-room-live', params: { id: item.id } })}>
            <SymbolView name="play.fill" size={14} tintColor={Brand.trust} type="monochrome" />
            <Text style={styles.actionBtnText}>Open</Text>
          </Pressable>
        ) : (
          <Pressable
            style={styles.actionBtn}
            onPress={() => router.push({ pathname: '/screening-room-analytics-modal', params: { roomId: item.id, roomTitle: item.title } })}>
            <SymbolView name="chart.bar.fill" size={14} tintColor={Brand.trust} type="monochrome" />
            <Text style={styles.actionBtnText}>Analytics</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnDelete]}
          onPress={() => Alert.alert('Delete screening room?', `"${item.title}" will be removed.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteScreeningRoom.mutate(item.id) },
          ])}>
          <SymbolView name="trash" size={14} tintColor="#E84F4F" type="monochrome" />
          <Text style={[styles.actionBtnText, styles.actionBtnTextDelete]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ScreeningsTab({
  screeningRooms,
  Brand,
  styles,
  deleteScreeningRoom,
}: {
  screeningRooms: ScreeningRoom[];
  Brand: BrandPalette;
  styles: ReturnType<typeof createStyles>;
  deleteScreeningRoom: { mutate: (id: string) => void };
}) {
  const active = screeningRooms.filter((r) => r.status !== 'ended');
  const ended = screeningRooms.filter((r) => r.status === 'ended');

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.list, { flexGrow: 1 }]}>
      <Pressable
        style={[styles.createBtn, { backgroundColor: '#F59E0B', marginBottom: 20 }]}
        onPress={() => router.push('/create-screening-room-modal')}>
        <Text style={styles.createBtnText}>+ New Screening Room</Text>
      </Pressable>

      {active.length > 0 && (
        <>
          <Text style={styles.sectionHeader}>Active</Text>
          {active.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <View style={{ height: 12 }} />}
              <ScreeningRoomCard item={item} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
            </View>
          ))}
        </>
      )}

      {ended.length > 0 && (
        <>
          <Text style={[styles.sectionHeader, active.length > 0 && { marginTop: 24 }]}>History</Text>
          {ended.map((item, i) => (
            <View key={item.id}>
              {i > 0 && <View style={{ height: 12 }} />}
              <ScreeningRoomCard item={item} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
            </View>
          ))}
        </>
      )}

      {screeningRooms.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyTitle}>No screening rooms yet</Text>
          <Text style={styles.emptySub}>Create one and invite your audience.</Text>
        </View>
      )}
    </ScrollView>
  );
}

export default function WatchPartiesModal() {
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const [tab, setTab] = useState<Tab>('hosting');

  const { data: hosted = [], isLoading: hostedLoading } = useMyPremieres();
  const { data: attending = [], isLoading: attendingLoading } = useAttendingPremieres();
  const { data: screeningRooms = [], isLoading: screeningLoading } = useMyScreeningRooms();
  const deleteScreeningRoom = useDeleteScreeningRoom();

  const [editingPremiere, setEditingPremiere] = useState<Premiere | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editTagline, setEditTagline] = useState('');

  const updatePremiere = useUpdatePremiere();
  const deletePremiere = useDeletePremiere();

  function openEdit(p: Premiere) {
    setEditingPremiere(p);
    setEditDate(p.air_date ?? '');
    setEditTime(p.air_time ?? '');
    setEditTagline(p.tagline ?? '');
  }

  async function handleSaveEdit() {
    if (!editingPremiere) return;
    await updatePremiere.mutateAsync({
      id: editingPremiere.id,
      airDate: editDate,
      airTime: editTime.trim() || null,
      tagline: editTagline.trim() || null,
    });
    setEditingPremiere(null);
  }

  function handleDelete(p: Premiere) {
    Alert.alert(
      'Delete watch party?',
      `"${p.show_title}" will be removed and attendees won't be able to join.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deletePremiere.mutate(p.id, {
              onError: () =>
                Alert.alert('Could not delete', 'Something went wrong. Please try again.'),
            }),
        },
      ],
    );
  }

  const list = tab === 'hosting' ? hosted : tab === 'attending' ? attending : [];
  const loading = tab === 'hosting' ? hostedLoading : tab === 'attending' ? attendingLoading : screeningLoading;

  function renderItem({ item }: { item: Premiere }) {
    const isHost = tab === 'hosting';
    const canEnter = item.status === 'waiting' || item.status === 'live';

    return (
      <View style={styles.card}>
        <Pressable
          style={styles.cardMain}
          onPress={() =>
            canEnter
              ? router.push({ pathname: '/premiere-waiting-room', params: { id: item.id } })
              : router.push({ pathname: '/premiere/[id]', params: { id: item.id } })
          }>
          {item.show_poster ? (
            <Image source={{ uri: item.show_poster }} style={styles.poster} />
          ) : (
            <View style={[styles.poster, styles.posterFallback]}>
              <Text style={styles.posterEmoji}>🎬</Text>
            </View>
          )}
          <View style={styles.cardInfo}>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] ?? '#6B7280' }]} />
              <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] ?? Brand.muted }]}>
                {STATUS_LABEL[item.status] ?? item.status}
              </Text>
            </View>
            <Text style={styles.showTitle} numberOfLines={1}>{item.show_title}</Text>
            {item.episode_name ? (
              <Text style={styles.episodeTitle} numberOfLines={1}>
                S{item.season_number}E{item.episode_number} · {item.episode_name}
              </Text>
            ) : null}
            {item.air_date ? (
              <Text style={styles.date}>📅 {formatPartyDate(item.air_date)}{item.air_time ? ` · ${item.air_time}` : ''}</Text>
            ) : null}
            {item.tagline ? (
              <Text style={styles.tagline} numberOfLines={1}>"{item.tagline}"</Text>
            ) : null}
            {!isHost ? (
              <Text style={styles.hostedBy}>Hosted by {item.host_name}</Text>
            ) : null}
          </View>
        </Pressable>

        {isHost && item.status !== 'ended' ? (
          <View style={styles.cardActions}>
            <Pressable style={styles.actionBtn} onPress={() => openEdit(item)} hitSlop={16}>
              <SymbolView name="pencil" size={15} tintColor={Brand.trust} type="monochrome" />
              <Text style={styles.actionBtnText}>Edit</Text>
            </Pressable>
            <Pressable style={[styles.actionBtn, styles.actionBtnDelete]} onPress={() => handleDelete(item)} hitSlop={16}>
              <SymbolView name="trash" size={15} tintColor="#E84F4F" type="monochrome" />
              <Text style={[styles.actionBtnText, styles.actionBtnTextDelete]}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.back}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Watch Parties</Text>
        <Pressable
          onPress={() => tab === 'screening' ? router.push('/create-screening-room-modal') : router.push('/premiere-modal')}
          hitSlop={16}>
          <SymbolView name="plus" size={20} tintColor={Brand.trust} type="monochrome" />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {([
          { id: 'hosting', label: 'Parties', count: hosted.length },
          { id: 'attending', label: 'Attending', count: attending.length },
          { id: 'screening', label: '🎬 Screenings', count: screeningRooms.length },
        ] as { id: Tab; label: string; count: number }[]).map((t) => (
          <Pressable
            key={t.id}
            style={[styles.tab, tab === t.id && styles.tabActive]}
            onPress={() => setTab(t.id)}>
            <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>
              {t.label}{t.count > 0 ? ` (${t.count})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {tab === 'screening' ? (
        <ScreeningsTab screeningRooms={screeningRooms} Brand={Brand} styles={styles} deleteScreeningRoom={deleteScreeningRoom} />
      ) : loading ? (
        <ActivityIndicator style={styles.loader} color={Brand.trust} />
      ) : list.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🎬</Text>
          <Text style={styles.emptyTitle}>
            {tab === 'hosting' ? 'No watch parties yet' : "You haven't joined any yet"}
          </Text>
          <Text style={styles.emptySub}>
            {tab === 'hosting'
              ? 'Host one and invite your friends.'
              : 'Accept an invite or ask a friend to host one.'}
          </Text>
          {tab === 'hosting' ? (
            <Pressable style={styles.createBtn} onPress={() => router.push('/premiere-modal')}>
              <Text style={styles.createBtnText}>Host a watch party</Text>
            </Pressable>
          ) : tab === 'screening' ? (
            <Pressable style={[styles.createBtn, { backgroundColor: '#F59E0B' }]} onPress={() => router.push('/create-screening-room-modal')}>
              <Text style={styles.createBtnText}>Create a Screening Room</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}

      {/* Edit modal */}
      <Modal visible={!!editingPremiere} transparent animationType="slide">
        <Pressable style={styles.editBackdrop} onPress={() => setEditingPremiere(null)}>
          <Pressable style={styles.editSheet} onPress={() => {}}>
            <View style={styles.editGrabber} />
            <Text style={styles.editTitle}>Edit Watch Party</Text>
            {editingPremiere ? (
              <Text style={styles.editShow} numberOfLines={1}>
                {editingPremiere.show_title}
                {editingPremiere.episode_name ? ` · ${editingPremiere.episode_name}` : ''}
              </Text>
            ) : null}

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.fieldInput}
                value={editDate}
                onChangeText={setEditDate}
                placeholder="e.g. 2025-08-10"
                placeholderTextColor={Brand.muted}
                keyboardType="numbers-and-punctuation"
                autoCorrect={false}
              />

              <Text style={styles.fieldLabel}>Start time</Text>
              <View style={styles.timeRow}>
                {['7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM'].map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.timeChip, editTime === t && styles.timeChipActive]}
                    onPress={() => setEditTime(editTime === t ? '' : t)}>
                    <Text style={[styles.timeChipText, editTime === t && styles.timeChipTextActive]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={styles.fieldInput}
                value={editTime}
                onChangeText={setEditTime}
                placeholder="Or enter custom time, e.g. 8:30 PM ET"
                placeholderTextColor={Brand.muted}
              />

              <Text style={styles.fieldLabel}>Tagline</Text>
              <TextInput
                style={[styles.fieldInput, styles.fieldInputMulti]}
                value={editTagline}
                onChangeText={setEditTagline}
                placeholder='e.g. "girls night 🍷"'
                placeholderTextColor={Brand.muted}
                multiline
                maxLength={80}
              />
            </ScrollView>

            <Pressable
              style={[styles.saveBtn, updatePremiere.isPending && { opacity: 0.5 }]}
              onPress={handleSaveEdit}
              disabled={updatePremiere.isPending}>
              {updatePremiere.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
    back: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.trust },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    tabRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 2,
      borderBottomColor: 'transparent',
    },
    tabActive: { borderBottomColor: Brand.trust },
    tabText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    tabTextActive: { color: Brand.trust },
    loader: { marginTop: 40 },
    list: { padding: Spacing.three },
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: Brand.border,
      overflow: 'hidden',
    },
    cardMain: { flexDirection: 'row', padding: 14, gap: 12 },
    poster: { width: 56, height: 84, borderRadius: 8 },
    posterFallback: { backgroundColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
    posterEmoji: { fontSize: 24 },
    cardInfo: { flex: 1, minWidth: 0, justifyContent: 'center', gap: 3 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 2 },
    sectionHeader: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 10,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 10,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontFamily: BrandFonts.syneBold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
    showTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, color: Brand.ink },
    episodeTitle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted },
    date: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.ink, marginTop: 2 },
    tagline: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, fontStyle: 'italic' },
    hostedBy: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 2 },
    cardActions: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    actionBtnDelete: { borderLeftWidth: 1, borderLeftColor: Brand.border },
    actionBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.trust },
    actionBtnTextDelete: { color: '#E84F4F' },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.four, gap: 8 },
    emptyEmoji: { fontSize: 44, marginBottom: 4 },
    emptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, color: Brand.ink },
    emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 14, color: Brand.muted, textAlign: 'center', lineHeight: 20 },
    createBtn: {
      marginTop: 8,
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 24,
    },
    createBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    // Edit sheet
    editBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    editSheet: {
      backgroundColor: Brand.paper,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: Spacing.three,
      paddingBottom: 36,
      maxHeight: '85%',
    },
    editGrabber: { width: 36, height: 4, borderRadius: 2, backgroundColor: Brand.border, alignSelf: 'center', marginBottom: 16 },
    editTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 20, color: Brand.ink, marginBottom: 4 },
    editShow: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted, marginBottom: 20 },
    fieldLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
      marginTop: 14,
    },
    fieldInput: {
      backgroundColor: Brand.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: Brand.border,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontFamily: BrandFonts.interRegular,
      fontSize: 15,
      color: Brand.ink,
    },
    fieldInputMulti: { minHeight: 72, textAlignVertical: 'top' },
    timeRow: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
    timeChip: {
      paddingVertical: 7,
      paddingHorizontal: 12,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    timeChipActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    timeChipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    timeChipTextActive: { color: '#fff' },
    saveBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 20,
    },
    saveBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
