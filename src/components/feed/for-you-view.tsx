import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { BecauseYouRow } from '@/components/feed/because-you-row';
import { BrandFonts, type BrandPalette, type EntryType } from '@/constants/theme';
import { useFollowingCollections } from '@/features/collection/api';
import { useBecauseYouRecs } from '@/features/feed/for-you';
import { compatColor, compatLabel } from '@/features/friends/compatibility';
import { useLibraryItems } from '@/features/library/api';
import { useBrand, useTypeColors } from '@/hooks/use-brand';
import type { Profile } from '@/features/follows/api';
import type { TrendingEntry } from '@/features/feed/trending';

const PAST_VERBS: Record<string, string> = {
  watch: 'watched', tv: 'watched', read: 'read',
  play: 'played', listen: 'listened to', podcast: 'listened to',
};

function openContent(item: { title: string; type: string; poster?: string | null; sub?: string | null; external_id?: string | null; media_type?: string | null }) {
  router.push({
    pathname: '/content-detail-modal',
    params: {
      title: item.title,
      type: item.type,
      poster: item.poster ?? undefined,
      sub: item.sub ?? undefined,
      externalId: item.external_id ?? undefined,
      mediaType: item.media_type ?? undefined,
    },
  });
}

// ── Top Match Hero ─────────────────────────────────────────────────────────────
function TopMatchHero({
  friend,
  compat,
  post,
  Brand,
}: {
  friend: Profile;
  compat: number;
  post: { title: string; type: string; poster: string | null; sub: string | null; external_id: string | null; media_type: string | null; user_rating: number | null; note: string | null };
  Brand: BrandPalette;
}) {
  const styles = useMemo(() => heroStyles(Brand), [Brand]);
  const name = friend.full_name || friend.username || 'Someone';
  const { label } = compatLabel(compat);
  const stars = post.user_rating ? '★'.repeat(post.user_rating) + '☆'.repeat(5 - post.user_rating) : null;

  return (
    <Pressable style={styles.card} onPress={() => openContent(post)}>
      {/* Banner */}
      <View style={styles.banner}>
        <Pressable
          style={styles.avatarWrap}
          onPress={(e) => { e.stopPropagation(); router.push({ pathname: '/friend-profile-modal', params: { userId: friend.id } }); }}>
          <Avatar name={name} size={36} avatarUrl={friend.avatar_url} />
        </Pressable>
        <View style={styles.bannerText}>
          <Text style={styles.bannerName} numberOfLines={1}>{name} · @{friend.username}</Text>
          <Text style={styles.bannerSub}>Your #1 compatibility match</Text>
        </View>
        <View style={styles.compatBadge}>
          <Text style={styles.compatBadgeText}>{compat}%</Text>
        </View>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {post.poster ? (
          <Image source={{ uri: post.poster }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterFallback]} />
        )}
        <View style={styles.info}>
          <Text style={[styles.title, { color: Brand.ink }]} numberOfLines={2}>{post.title}</Text>
          {post.sub ? <Text style={styles.meta} numberOfLines={1}>{post.sub}</Text> : null}
          {stars ? <Text style={styles.stars}>{stars}</Text> : null}
          {post.note ? (
            <Text style={styles.quote} numberOfLines={3}>&ldquo;{post.note}&rdquo;</Text>
          ) : null}
        </View>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <Pressable style={styles.btnPrimary} onPress={(e) => { e.stopPropagation(); router.push('/log-modal'); }}>
          <Text style={styles.btnPrimaryText}>+ Add to watchlist</Text>
        </Pressable>
        <Pressable
          style={styles.btnSecondary}
          onPress={(e) => { e.stopPropagation(); router.push({ pathname: '/content-room-modal', params: { externalId: post.external_id ?? '', mediaType: post.media_type ?? '', title: post.title, poster: post.poster ?? '' } }); }}>
          <Text style={styles.btnSecondaryText}>See lounge</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

// ── Watchlist nudge ────────────────────────────────────────────────────────────
function StillOnYourList({ Brand }: { Brand: BrandPalette }) {
  const { watchlist } = useLibraryItems();
  const styles = useMemo(() => wlStyles(Brand), [Brand]);

  const old = useMemo(() => {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return watchlist
      .filter((i) => new Date(i.created_at).getTime() < cutoff)
      .slice(0, 8);
  }, [watchlist]);

  if (old.length === 0) return null;

  function daysAgo(dateStr: string) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (days > 365) return `${Math.floor(days / 365)}y ago`;
    if (days > 30) return `${Math.floor(days / 30)}mo ago`;
    return `${days}d ago`;
  }

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>Still on your list</Text>
        <Text style={styles.sub}>Added a while ago</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {old.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.card, { borderColor: Brand.border }]}
            onPress={() => openContent(item)}>
            {item.poster ? (
              <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, { backgroundColor: Brand.tlight }]} />
            )}
            <View style={styles.badge}><Text style={styles.badgeText}>{daysAgo(item.created_at)}</Text></View>
            <View style={styles.info}>
              <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.itemAgo}>{daysAgo(item.created_at)}</Text>
              <Pressable
                style={styles.cta}
                onPress={(e) => { e.stopPropagation(); router.push('/log-modal'); }}>
                <Text style={styles.ctaText}>Log it →</Text>
              </Pressable>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ── More from your matches ─────────────────────────────────────────────────────
function MoreFromMatches({
  friends,
  compatScores,
  loggedTitles,
  Brand,
}: {
  friends: Profile[];
  compatScores: Map<string, number>;
  loggedTitles: Set<string>;
  Brand: BrandPalette;
}) {
  const { data: followingCollections = [] } = useFollowingCollections();
  const styles = useMemo(() => moreStyles(Brand), [Brand]);

  const recs = useMemo(() => {
    const sorted = [...friends].sort((a, b) => (compatScores.get(b.id) ?? 0) - (compatScores.get(a.id) ?? 0));
    const result: { friend: Profile; compat: number; item: typeof followingCollections[number] }[] = [];

    for (const friend of sorted) {
      if (result.length >= 5) break;
      const compat = compatScores.get(friend.id) ?? 0;
      if (compat < 40) continue;
      const friendItems = followingCollections.filter((c) => c.user_id === friend.id && c.user_rating && c.user_rating >= 4);
      const pick = friendItems.find((c) => !loggedTitles.has(`${c.type}:${c.title.toLowerCase()}`));
      if (pick) result.push({ friend, compat, item: pick });
    }
    return result;
  }, [friends, compatScores, followingCollections, loggedTitles]);

  if (recs.length === 0) return null;

  return (
    <View>
      <View style={styles.head}>
        <Text style={styles.title}>More from your matches</Text>
        <Text style={styles.sub}>Based on compatibility</Text>
      </View>
      <View style={styles.list}>
        {recs.map(({ friend, compat, item }) => {
          const name = friend.full_name || friend.username || 'Someone';
          const color = compatColor(compat);
          const stars = item.user_rating ? '★'.repeat(item.user_rating) + '☆'.repeat(5 - item.user_rating) : null;
          return (
            <Pressable key={`${friend.id}:${item.title}`} style={[styles.card, { borderColor: Brand.border }]} onPress={() => openContent(item)}>
              <Avatar name={name} size={28} avatarUrl={friend.avatar_url} />
              {item.poster ? (
                <Image source={{ uri: item.poster }} style={styles.poster} resizeMode="cover" />
              ) : (
                <View style={[styles.poster, { backgroundColor: Brand.tlight }]} />
              )}
              <View style={styles.info}>
                <Text style={styles.who} numberOfLines={1}>
                  <Text style={{ color }}>{compat}% match</Text> · {name} loved this
                </Text>
                <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                {item.sub ? <Text style={styles.itemMeta} numberOfLines={1}>{item.sub}</Text> : null}
                {stars ? <Text style={styles.stars}>{stars}</Text> : null}
              </View>
              <Pressable
                style={styles.add}
                onPress={(e) => { e.stopPropagation(); router.push('/log-modal'); }}>
                <Text style={styles.addText}>+ Add</Text>
              </Pressable>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Main ForYouView ────────────────────────────────────────────────────────────
export function ForYouView({
  friends,
  compatScores,
  loggedTitles,
  becauseRows,
  forYouLoading,
}: {
  friends: Profile[];
  compatScores: Map<string, number>;
  loggedTitles: Set<string>;
  becauseRows: { seed: { title: string; type: string } | null; entries: TrendingEntry[] }[];
  forYouLoading: boolean;
}) {
  const Brand = useBrand();
  const { data: followingCollections = [] } = useFollowingCollections();

  // Find top match + their best unlogged, highly-rated item
  const topMatchData = useMemo(() => {
    const sorted = [...friends].sort((a, b) => (compatScores.get(b.id) ?? 0) - (compatScores.get(a.id) ?? 0));
    for (const friend of sorted) {
      const compat = compatScores.get(friend.id) ?? 0;
      if (compat < 50) break;
      const items = followingCollections
        .filter((c) => c.user_id === friend.id && (c.user_rating ?? 0) >= 4)
        .filter((c) => !loggedTitles.has(`${c.type}:${c.title.toLowerCase()}`));
      if (items.length > 0) {
        // Prefer item with a note
        const pick = items.find((i) => i.note) ?? items[0];
        return { friend, compat, post: pick };
      }
    }
    return null;
  }, [friends, compatScores, followingCollections, loggedTitles]);

  if (forYouLoading && becauseRows.length === 0 && !topMatchData) {
    return (
      <View style={{ marginTop: 40, alignItems: 'center' }}>
        <ActivityIndicator color={Brand.trust} />
      </View>
    );
  }

  if (!forYouLoading && becauseRows.length === 0 && !topMatchData) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, { color: Brand.ink }]}>Nothing here yet</Text>
        <Text style={[styles.emptySub, { color: Brand.muted }]}>
          Log a few movies, books, or albums and we'll build personalised picks for you.
        </Text>
        <Pressable style={[styles.emptyBtn, { backgroundColor: Brand.trust }]} onPress={() => router.push('/log-modal')}>
          <Text style={styles.emptyBtnText}>Log something →</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Top match hero */}
      {topMatchData && (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Text style={[styles.sectionTitle, { color: Brand.ink }]}>Your top match loved this</Text>
          </View>
          <TopMatchHero friend={topMatchData.friend} compat={topMatchData.compat} post={topMatchData.post} Brand={Brand} />
        </View>
      )}

      {/* 2. Because you logged rows */}
      {becauseRows.map(({ seed, entries }) => (
        <View key={`${seed!.type}:${seed!.title}`} style={styles.section}>
          <BecauseYouRow
            seedTitle={seed!.title}
            verb={PAST_VERBS[seed!.type] ?? 'logged'}
            entries={entries}
          />
        </View>
      ))}

      {/* 3. Still on your list */}
      <View style={styles.section}>
        <StillOnYourList Brand={Brand} />
      </View>

      {/* 4. More from your matches */}
      <View style={styles.section}>
        <MoreFromMatches friends={friends} compatScores={compatScores} loggedTitles={loggedTitles} Brand={Brand} />
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { gap: 0 },
  section: { marginBottom: 28 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, letterSpacing: -0.3 },
  empty: { marginTop: 60, alignItems: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 18, marginBottom: 8, textAlign: 'center' },
  emptySub: { fontFamily: BrandFonts.interRegular, fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 20 },
  emptyBtn: { borderRadius: 20, paddingVertical: 10, paddingHorizontal: 24 },
  emptyBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
});

function heroStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    card: { backgroundColor: Brand.card, borderWidth: 1, borderColor: Brand.border, borderRadius: 18, overflow: 'hidden' },
    banner: { backgroundColor: Brand.trust, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarWrap: { flexShrink: 0 },
    bannerText: { flex: 1, minWidth: 0 },
    bannerName: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: '#fff' },
    bannerSub: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    compatBadge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
    compatBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },
    body: { flexDirection: 'row', gap: 10, padding: 12 },
    poster: { width: 64, height: 90, borderRadius: 8, flexShrink: 0 },
    posterFallback: { backgroundColor: Brand.tlight },
    info: { flex: 1 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, lineHeight: 20, marginBottom: 3 },
    meta: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted, marginBottom: 4 },
    stars: { fontSize: 11, color: '#F5A623', letterSpacing: 1, marginBottom: 6 },
    quote: { fontFamily: BrandFonts.interRegular, fontStyle: 'italic', fontSize: 11, color: Brand.muted, backgroundColor: Brand.tlight, borderRadius: 8, padding: 7, lineHeight: 16 },
    footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingBottom: 12 },
    btnPrimary: { flex: 1, backgroundColor: Brand.trust, borderRadius: 20, paddingVertical: 9, alignItems: 'center' },
    btnPrimaryText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    btnSecondary: { flex: 1, backgroundColor: Brand.tlight, borderRadius: 20, paddingVertical: 9, alignItems: 'center' },
    btnSecondaryText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: Brand.trust },
  });
}

function wlStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink, letterSpacing: -0.3 },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted },
    card: { width: 130, backgroundColor: Brand.card, borderWidth: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' },
    poster: { width: 130, height: 86, },
    badge: { position: 'absolute', top: 7, left: 7, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 },
    badgeText: { fontFamily: BrandFonts.syneBold, fontSize: 8, color: '#fff', letterSpacing: 0.3 },
    info: { padding: 8 },
    itemTitle: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, color: Brand.ink, marginBottom: 2 },
    itemAgo: { fontFamily: BrandFonts.interRegular, fontSize: 9.5, color: Brand.muted, marginBottom: 6 },
    cta: { backgroundColor: Brand.tlight, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3, alignSelf: 'flex-start' },
    ctaText: { fontFamily: BrandFonts.syneBold, fontSize: 9.5, color: Brand.trust },
  });
}

function moreStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
    title: { fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink, letterSpacing: -0.3 },
    sub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, color: Brand.muted },
    list: { gap: 8 },
    card: { backgroundColor: Brand.card, borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
    poster: { width: 40, height: 56, borderRadius: 6, flexShrink: 0 },
    info: { flex: 1, minWidth: 0 },
    who: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted, marginBottom: 2 },
    itemTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
    itemMeta: { fontFamily: BrandFonts.interRegular, fontSize: 10, color: Brand.muted, marginTop: 1 },
    stars: { fontSize: 10, color: '#F5A623', marginTop: 2, letterSpacing: 0.5 },
    add: { backgroundColor: Brand.tlight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, flexShrink: 0 },
    addText: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.trust },
  });
}
