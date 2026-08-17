import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePremiere, usePremiereMessages, usePremiereMembers, useTrackReplayView } from '@/features/premieres/api';
import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

function formatTime(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatEndedDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function PremiereReplay() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);

  const { data: premiere } = usePremiere(id ?? null);
  const { data: messages = [] } = usePremiereMessages(id ?? null);
  const { data: members = [] } = usePremiereMembers(id ?? null);
  const trackReplay = useTrackReplayView();

  // Record this user as a replay viewer on mount
  useEffect(() => {
    if (id) trackReplay.mutate(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const [playing, setPlaying] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const prevVisibleCount = useRef(0);

  const totalMs = useMemo(
    () => (messages.length > 0 ? Math.max(...messages.map((m) => m.relative_ms ?? 0)) + 3000 : 0),
    [messages],
  );

  // Timer — starts/stops based on playing state
  useEffect(() => {
    if (!playing) return;
    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 500);
    }, 500);
    return () => clearInterval(interval);
  }, [playing]);

  // Stop at end
  useEffect(() => {
    if (playing && totalMs > 0 && elapsedMs >= totalMs) {
      setPlaying(false);
    }
  }, [elapsedMs, totalMs, playing]);

  // Auto-scroll when a new message appears
  const visibleCount = messages.filter((m) => m.relative_ms !== null && m.relative_ms <= elapsedMs).length;
  useEffect(() => {
    if (visibleCount > prevVisibleCount.current) {
      prevVisibleCount.current = visibleCount;
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [visibleCount]);

  const visibleMessages = messages.filter((m) => m.relative_ms !== null && m.relative_ms <= elapsedMs);

  const episodeSub = premiere
    ? `S${premiere.season_number}E${premiere.episode_number}${premiere.episode_name ? ` · ${premiere.episode_name}` : ''}`
    : '';

  const progress = totalMs > 0 ? Math.min(elapsedMs / totalMs, 1) : 0;
  const barRef = useRef<View>(null);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>{premiere?.show_title ?? 'Watch Party'}</Text>
          <Text style={styles.headerSub} numberOfLines={1}>
            {episodeSub}{premiere?.ended_at ? `  ·  ${formatEndedDate(premiere.ended_at)}` : ''}
          </Text>
        </View>
        {premiere?.show_poster ? (
          <Image source={{ uri: premiere.show_poster }} style={styles.headerPoster} cachePolicy="memory-disk" recyclingKey={premiere.show_poster} />
        ) : <View style={styles.headerPoster} />}
      </View>

      {/* Members */}
      {members.length > 0 ? (
        <View style={styles.membersRow}>
          <Text style={styles.membersLabel}>🎬 Watch party with </Text>
          <Text style={styles.membersNames} numberOfLines={1}>
            {members.map((m) => m.full_name ?? m.username ?? 'Someone').join(', ')}
          </Text>
        </View>
      ) : null}

      {/* Playback controls — rendered BEFORE the list so layout can't push them off screen */}
      {messages.length > 0 ? (
        <View style={styles.controls}>
          <Text style={styles.timeLabel}>{formatTime(elapsedMs)}</Text>

          {/* Progress bar */}
          <View ref={barRef} style={styles.scrubBar}>
            <View style={[styles.scrubFill, { width: `${progress * 100}%` }]} />
            <View style={[styles.scrubThumb, { left: `${progress * 100}%` }]} />
          </View>

          <Text style={styles.timeLabel}>{formatTime(totalMs)}</Text>

          {/* Play / Pause */}
          <Pressable
            style={[styles.playBtn, { backgroundColor: playing ? '#22c55e' : '#A78BFA' }]}
            onPress={() => setPlaying((p) => !p)}>
            <Text style={styles.playBtnText}>{playing ? '⏸' : '▶'}</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Chat replay */}
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No chat messages were sent during this watch party.</Text>
        </View>
      ) : visibleMessages.length === 0 ? (
        <View style={styles.waitingWrap}>
          <Text style={styles.waitingText}>
            {playing ? '⏳ Waiting for messages…' : 'Press ▶ then start your show'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={visibleMessages}
          keyExtractor={(m) => m.id}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.avatarWrap}>
                {item.user_avatar_url ? (
                  <Image source={{ uri: item.user_avatar_url }} style={styles.avatar} cachePolicy="memory-disk" recyclingKey={item.user_avatar_url} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarFallbackText}>{(item.user_name?.[0] ?? '?').toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.bubble}>
                <View style={styles.bubbleHeader}>
                  <Text style={styles.userName}>{item.user_name}</Text>
                  {item.relative_ms !== null ? (
                    <Text style={styles.timestamp}>{formatTime(item.relative_ms)}</Text>
                  ) : null}
                </View>
                <Text style={styles.content}>{item.content}</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#0F0E17' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
      gap: 10,
    },
    backBtn: { minWidth: 48 },
    backText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#A78BFA' },
    headerCenter: { flex: 1 },
    headerTitle: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },
    headerSub: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
    headerPoster: { width: 36, height: 50, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.08)' },
    membersRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      backgroundColor: 'rgba(167,139,250,0.08)',
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    membersLabel: { fontFamily: BrandFonts.interRegular, fontSize: 13, color: 'rgba(255,255,255,0.5)' },
    membersNames: { flex: 1, fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#A78BFA' },
    list: { padding: 16, paddingBottom: 8, gap: 16 },
    empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    emptyText: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
    waitingWrap: { flex: 1, padding: 40, alignItems: 'center', justifyContent: 'center' },
    waitingText: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: 'rgba(255,255,255,0.4)', textAlign: 'center', lineHeight: 24 },
    row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
    avatarWrap: {},
    avatar: { width: 36, height: 36, borderRadius: 18 },
    avatarFallback: { backgroundColor: '#3B1F6E', justifyContent: 'center', alignItems: 'center' },
    avatarFallbackText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    bubble: { flex: 1 },
    bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
    userName: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#A78BFA' },
    timestamp: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: 'rgba(255,255,255,0.3)' },
    content: { fontFamily: BrandFonts.interRegular, fontSize: 15, color: 'rgba(255,255,255,0.88)', lineHeight: 22 },
    controls: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderTopWidth: 1,
      borderTopColor: 'rgba(255,255,255,0.08)',
      gap: 10,
    },
    timeLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12, color: 'rgba(255,255,255,0.4)', minWidth: 36 },
    scrubBar: {
      flex: 1,
      height: 4,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 2,
      position: 'relative',
      justifyContent: 'center',
    },
    scrubFill: {
      height: 4,
      backgroundColor: '#A78BFA',
      borderRadius: 2,
    },
    scrubThumb: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 7,
      backgroundColor: '#fff',
      top: -5,
      marginLeft: -7,
    },
    playBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: '#A78BFA',
      justifyContent: 'center',
      alignItems: 'center',
    },
    playBtnText: { fontSize: 18 },
  });
}
