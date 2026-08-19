import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { QueryErrorState } from '@/components/query-error-state';

import { Avatar } from '@/components/avatar';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import {
  usePremiere,
  usePremiereMembers,
  useUpdateRsvp,
  type PremiereMember,
  type RsvpStatus,
} from '@/features/premieres/api';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

type GuestTab = 'attending' | 'maybe' | 'invited' | 'not_attending';

const TABS: { id: GuestTab; label: string }[] = [
  { id: 'attending', label: '✓ Going' },
  { id: 'maybe', label: '? Maybe' },
  { id: 'invited', label: '⏳ Awaiting' },
  { id: 'not_attending', label: '✕ Can\'t' },
];

function formatPartyDate(dateStr: string, timeStr: string | null): string {
  const date = new Date(dateStr + 'T00:00:00');
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return timeStr ? `${day} · ${timeStr}` : day;
}

function minutesUntil(dateStr: string, timeStr: string | null): number {
  const base = dateStr + (timeStr ? `T${timeStr}` : 'T00:00:00');
  return (new Date(base).getTime() - Date.now()) / 60000;
}

export default function PartyDetailModal() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { user } = useSession();
  const { data: premiere, isLoading, isError, refetch } = usePremiere(id ?? null);
  const { data: members = [] } = usePremiereMembers(id ?? null);
  const updateRsvp = useUpdateRsvp();

  const [guestTab, setGuestTab] = useState<GuestTab>('attending');

  const myStatus = members.find((m) => m.user_id === user?.id)?.rsvp_status ?? 'invited';
  const isHost = premiere?.host_user_id === user?.id;

  const canEnter = premiere?.status === 'waiting' || premiere?.status === 'live';

  const grouped = useMemo(() => {
    const map: Record<GuestTab, PremiereMember[]> = {
      attending: [],
      maybe: [],
      invited: [],
      not_attending: [],
    };
    for (const m of members) {
      const key = m.rsvp_status as GuestTab;
      if (map[key]) map[key].push(m);
    }
    return map;
  }, [members]);

  function tabLabel(tab: { id: GuestTab; label: string }) {
    const count = grouped[tab.id].length;
    return count > 0 ? `${tab.label} (${count})` : tab.label;
  }

  // A failed fetch leaves `premiere` undefined, which used to sit on the
  // spinner indefinitely rather than telling the user anything.
  if (isError || (!isLoading && !premiere)) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <QueryErrorState title="Couldn't load this premiere" onRetry={refetch} />
      </SafeAreaView>
    );
  }

  if (isLoading || !premiere) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator color={Brand.trust} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <SymbolView name="chevron.left" size={18} tintColor={Brand.muted} type="monochrome" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Watch Party</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Party card */}
        <View style={styles.card}>
          <View style={styles.cardTop}>
            {premiere.show_poster ? (
              <Image source={{ uri: premiere.show_poster }} style={styles.poster} contentFit="cover" recyclingKey={premiere.show_poster} />
            ) : (
              <View style={[styles.poster, styles.posterFallback]}>
                <Text style={styles.posterEmoji}>🎬</Text>
              </View>
            )}
            <View style={styles.cardInfo}>
              <Text style={styles.showTitle} numberOfLines={2}>{premiere.show_title}</Text>
              <Text style={styles.episodeLabel} numberOfLines={1}>
                S{premiere.season_number}E{premiere.episode_number} · {premiere.episode_name}
              </Text>
              {premiere.air_date ? (
                <Text style={styles.dateLabel}>
                  📅 {formatPartyDate(premiere.air_date, premiere.air_time ?? null)}
                </Text>
              ) : null}
              {premiere.tagline ? (
                <Text style={styles.tagline} numberOfLines={2}>"{premiere.tagline}"</Text>
              ) : null}
            </View>
          </View>

          {/* Host row */}
          <View style={styles.hostRow}>
            <Avatar
              name={premiere.host_name}
              size={28}
              avatarUrl={premiere.host_avatar_url ?? undefined}
            />
            <Text style={styles.hostLabel}>
              Hosted by <Text style={styles.hostName}>{premiere.host_name}</Text>
            </Text>
          </View>
        </View>

        {/* RSVP — only show if not host */}
        {!isHost && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your RSVP</Text>
            <View style={styles.rsvpRow}>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={updateRsvp.isPending}
                style={[styles.rsvpBtn, myStatus === 'attending' && { borderColor: Brand.trust, backgroundColor: Brand.tlight }, updateRsvp.isPending && { opacity: 0.5 }]}
                onPress={() => updateRsvp.mutate({ premiereId: premiere.id, status: 'attending' }, { onError: () => Alert.alert('Could not update RSVP', 'Check your connection and try again.') })}>
                <Text style={[styles.rsvpBtnText, { color: myStatus === 'attending' ? Brand.trust : Brand.muted }]}>✓ Going</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={updateRsvp.isPending}
                style={[styles.rsvpBtn, myStatus === 'maybe' && { borderColor: Brand.muted, backgroundColor: Brand.card }, updateRsvp.isPending && { opacity: 0.5 }]}
                onPress={() => updateRsvp.mutate({ premiereId: premiere.id, status: 'maybe' }, { onError: () => Alert.alert('Could not update RSVP', 'Check your connection and try again.') })}>
                <Text style={[styles.rsvpBtnText, { color: myStatus === 'maybe' ? Brand.ink : Brand.muted }]}>? Maybe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                disabled={updateRsvp.isPending}
                style={[styles.rsvpBtn, myStatus === 'not_attending' && { borderColor: '#E84F4F', backgroundColor: '#FEE2E2' }, updateRsvp.isPending && { opacity: 0.5 }]}
                onPress={() => updateRsvp.mutate({ premiereId: premiere.id, status: 'not_attending' }, { onError: () => Alert.alert('Could not update RSVP', 'Check your connection and try again.') })}>
                <Text style={[styles.rsvpBtnText, { color: myStatus === 'not_attending' ? '#E84F4F' : Brand.muted }]}>✕ Can't</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Guest list */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Guests</Text>

          {/* Guest tabs */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.guestTabScroll} contentContainerStyle={styles.guestTabRow}>
            {TABS.map((tab) => (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.7}
                style={[styles.guestTab, guestTab === tab.id && styles.guestTabActive]}
                onPress={() => setGuestTab(tab.id)}>
                <Text style={[styles.guestTabText, guestTab === tab.id && styles.guestTabTextActive]}>
                  {tabLabel(tab)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Guest rows */}
          {grouped[guestTab].length === 0 ? (
            <Text style={styles.emptyGuests}>Nobody here yet</Text>
          ) : (
            grouped[guestTab].map((m) => (
              <View key={m.user_id} style={styles.guestRow}>
                <Avatar
                  name={m.full_name ?? m.username ?? '?'}
                  size={36}
                  avatarUrl={m.avatar_url ?? undefined}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.guestName}>{m.full_name ?? m.username ?? 'Unknown'}</Text>
                  {m.username ? <Text style={styles.guestHandle}>@{m.username}</Text> : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Join button */}
      {canEnter && (
        <View style={styles.joinWrap}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.joinBtn}
            onPress={() => {
              router.back();
              router.push({ pathname: '/premiere-waiting-room', params: { id: premiere.id } });
            }}>
            <Text style={styles.joinBtnText}>
              {premiere.status === 'live' ? '🔴 Join Live' : 'Join Waiting Room'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 60 },
    backText: { fontFamily: BrandFonts.interMedium, fontSize: 14, color: Brand.muted },
    headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 16, color: Brand.ink },
    scroll: { padding: 16, gap: 16, paddingBottom: 40 },

    // Party card
    card: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: Brand.border,
      overflow: 'hidden',
    },
    cardTop: { flexDirection: 'row', gap: 12, padding: 14 },
    poster: { width: 72, height: 100, borderRadius: 10 },
    posterFallback: { backgroundColor: Brand.border, alignItems: 'center', justifyContent: 'center' },
    posterEmoji: { fontSize: 28 },
    cardInfo: { flex: 1, gap: 4, justifyContent: 'center' },
    showTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink },
    episodeLabel: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    dateLabel: { fontFamily: BrandFonts.interMedium, fontSize: 13, color: Brand.ink, marginTop: 2 },
    tagline: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, fontStyle: 'italic', marginTop: 2 },
    hostRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
    },
    hostLabel: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: Brand.muted },
    hostName: { fontFamily: BrandFonts.syneBold, color: Brand.ink },

    // RSVP
    section: {
      backgroundColor: Brand.card,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: Brand.border,
      padding: 14,
      gap: 12,
    },
    sectionLabel: {
      fontFamily: BrandFonts.syneBold,
      fontSize: 11,
      color: Brand.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    rsvpRow: { flexDirection: 'row', gap: 8 },
    rsvpBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: Brand.border,
      alignItems: 'center',
    },
    rsvpBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13 },

    // Guest list
    guestTabScroll: { flexGrow: 0 },
    guestTabRow: { flexDirection: 'row', gap: 8 },
    guestTab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: 20,
      borderWidth: 1.5,
      borderColor: Brand.border,
      backgroundColor: Brand.card,
    },
    guestTabActive: { backgroundColor: Brand.trust, borderColor: Brand.trust },
    guestTabText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.muted },
    guestTabTextActive: { color: '#fff' },
    emptyGuests: {
      fontFamily: BrandFonts.interRegular,
      fontSize: 13,
      color: Brand.muted,
      textAlign: 'center',
      paddingVertical: 16,
    },
    guestRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 6,
    },
    guestName: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.ink },
    guestHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted },

    // Join button
    joinWrap: {
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: Brand.border,
      backgroundColor: Brand.paper,
    },
    joinBtn: {
      backgroundColor: Brand.trust,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
    },
    joinBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 16, color: '#fff' },
  });
}
