import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { Dimensions, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandFonts, type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const { height: SH } = Dimensions.get('window');
const HP = 10;

type ScreenType = 'feed' | 'chats' | 'friends' | 'news' | 'library';
type RefKey = 'tabs' | 'post' | 'action' | 'nav0' | 'nav1' | 'nav2' | 'nav3' | 'nav4';
type Rect = { x: number; y: number; width: number; height: number };

type StepDef = {
  refKey: RefKey;
  title: string;
  desc: string;
  screen: ScreenType;
  navActive: number;
  // 'bottom' = tooltip floats above bottom safe area
  // 'above-nav' = tooltip sits above the nav bar spotlight
  tooltipPos: 'bottom' | 'above-nav';
};

const STEPS: StepDef[] = [
  {
    refKey: 'tabs',
    title: 'Your Feed, your way',
    desc: 'Feed is people you follow. Circles shows what your inner and outer circles are watching, reading, and listening to most. Lounge is the whole community. For You is personalised picks based on your taste.',
    screen: 'feed',
    navActive: 0,
    tooltipPos: 'bottom',
  },
  {
    refKey: 'post',
    title: "Real takes, no spoilers",
    desc: "See what the people you follow are actually watching. React with an emoji, hide spoilers with one tap, or jump straight into the content chat for that title. Head over to the Lounge to connect with the wider community.",
    screen: 'feed',
    navActive: 0,
    tooltipPos: 'bottom',
  },
  {
    refKey: 'action',
    title: 'Share and save',
    desc: 'Tap ↗ to send it to a friend, add it to your watchlist, or log it once you\'ve watched, read or played it.',
    screen: 'feed',
    navActive: 0,
    tooltipPos: 'bottom',
  },
  {
    refKey: 'nav1',
    title: 'Chats & Watch Events',
    desc: "DM friends, start a group chat, and watch things together. Host a Watch Party to sync up in real time — chat, react, and share the moment live. Lounges let your audience hang out and keep the conversation going between events.",
    screen: 'chats',
    navActive: 1,
    tooltipPos: 'above-nav',
  },
  {
    refKey: 'nav2',
    title: 'Friends',
    desc: 'Find people you know or discover new ones. Your compatibility score shows how closely your taste lines up — the higher it is, the more you\'re likely to love the same things.',
    screen: 'friends',
    navActive: 2,
    tooltipPos: 'above-nav',
  },
  {
    refKey: 'nav3',
    title: 'News',
    desc: "What's buzzing, what's dropping soon, and what's pulling in at the box office — across film, TV, books, games and music.",
    screen: 'news',
    navActive: 3,
    tooltipPos: 'above-nav',
  },
  {
    refKey: 'nav4',
    title: 'Your Profile',
    desc: "Your Profile is your taste home base. See your activity feed, Watchlist, Collection, and Stats — plus your follow count and compatibility score with friends.",
    screen: 'library',
    navActive: 4,
    tooltipPos: 'above-nav',
  },
];

const NAV_TABS = [
  { sf: 'house.fill' as const, label: 'Feed' },
  { sf: 'message.fill' as const, label: 'Chats' },
  { sf: 'person.2.fill' as const, label: 'Friends' },
  { sf: 'newspaper.fill' as const, label: 'News' },
  { sf: 'person.crop.circle.fill' as const, label: 'Profile' },
];

const SCREEN_TITLE: Record<ScreenType, string> = {
  feed: 'Feed',
  chats: 'Chats',
  friends: 'Friends',
  news: 'News',
  library: 'Profile',
};

const FILTER_CHIPS = [
  { sf: 'square.grid.2x2' as const, label: 'All', active: true },
  { sf: 'movieclapper' as const, label: 'TV & Film', active: false },
  { sf: 'book.closed' as const, label: 'Books', active: false },
  { sf: 'gamecontroller' as const, label: 'Games', active: false },
  { sf: 'mic' as const, label: 'Podcasts', active: false },
  { sf: 'headphones' as const, label: 'Music', active: false },
];

// TMDB poster paths for well-known titles used in the tour mock screens
const POSTERS: Record<string, string> = {
  oppenheimer: 'https://image.tmdb.org/t/p/w342/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
  succession:  'https://image.tmdb.org/t/p/w342/7HW47XbkNQ5fiwQFYGWdw9gs144.jpg',
  nosferatu:   'https://image.tmdb.org/t/p/w342/5qGIxdEO841C0tdY8vKuTh8OgKL.jpg',
  tomorrow:    'https://image.tmdb.org/t/p/w342/gqAqtJ4P1ND00Ia8tNQ1fmLijHY.jpg',
  bear:        'https://image.tmdb.org/t/p/w342/sHFlbKS3WLqMnp9t2ghADIJFnuQ.jpg',
};

function MockPoster({
  posterKey,
  fallbackEmoji,
  style,
}: {
  posterKey: keyof typeof POSTERS;
  fallbackEmoji: string;
  style: object;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
      {!failed ? (
        <Image
          source={{ uri: POSTERS[posterKey] }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <Text style={{ fontSize: 22 }}>{fallbackEmoji}</Text>
      )}
    </View>
  );
}

function MockFilterChips({ Brand }: { Brand: BrandPalette }) {
  return (
    <View style={filterStyles.row}>
      {FILTER_CHIPS.map((chip) => (
        <View key={chip.label} style={filterStyles.item}>
          <View style={[
            filterStyles.tile,
            { backgroundColor: chip.active ? Brand.trust : Brand.card, borderColor: chip.active ? Brand.trust : Brand.border },
          ]}>
            <SymbolView name={chip.sf} size={28} tintColor={chip.active ? '#fff' : Brand.muted} type="monochrome" />
          </View>
          <Text style={[filterStyles.label, { color: chip.active ? Brand.trust : Brand.muted, fontFamily: chip.active ? BrandFonts.syneBold : BrandFonts.interMedium }]}>
            {chip.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const filterStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingLeft: 16, gap: 10, paddingVertical: 10 },
  item: { alignItems: 'center', gap: 7 },
  tile: {
    width: 61, height: 61, borderRadius: 16,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
  },
  label: { fontSize: 11 },
});

export function TourScreen({
  onComplete,
  onSkip,
}: {
  onComplete: () => void;
  onSkip: () => void;
}) {
  const Brand = useBrand();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const safeTop = insets.top || 44;
  const safeBottom = insets.bottom || 16;

  const [step, setStep] = useState(0);
  const [rects, setRects] = useState<Partial<Record<RefKey, Rect>>>({});

  const tabsRef = useRef<View>(null);
  const postRef = useRef<View>(null);
  const actionRef = useRef<View>(null);
  const nav0Ref = useRef<View>(null);
  const nav1Ref = useRef<View>(null);
  const nav2Ref = useRef<View>(null);
  const nav3Ref = useRef<View>(null);
  const nav4Ref = useRef<View>(null);

  const ALL_REFS: Record<RefKey, React.RefObject<View | null>> = {
    tabs: tabsRef,
    post: postRef,
    action: actionRef,
    nav0: nav0Ref,
    nav1: nav1Ref,
    nav2: nav2Ref,
    nav3: nav3Ref,
    nav4: nav4Ref,
  };

  function measureAll() {
    Object.entries(ALL_REFS).forEach(([key, ref]) => {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0) {
          setRects(prev => ({ ...prev, [key]: { x, y, width: w, height: h } }));
        }
      });
    });
  }

  // Re-measure whenever step changes so spotlight snaps to the right element
  useEffect(() => {
    const t = setTimeout(measureAll, 80);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function advance() {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else onComplete();
  }

  function goBack() {
    if (step > 0) setStep(s => s - 1);
  }

  const currentStep = STEPS[step];
  const raw = rects[currentStep.refKey];
  const h: Rect | null = raw
    ? { x: raw.x - HP, y: raw.y - HP, width: raw.width + HP * 2, height: raw.height + HP * 2 }
    : null;

  // Tooltip always anchors to the bottom; nav steps sit above the nav bar
  const NAV_BAR_HEIGHT = 56;
  function tooltipStyle(): ViewStyle {
    if (currentStep.tooltipPos === 'above-nav') {
      return {
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: safeBottom + NAV_BAR_HEIGHT + 24,
      };
    }
    return { position: 'absolute', left: 16, right: 16, bottom: safeBottom + 16 };
  }

  function measureRef(key: RefKey, ref: React.RefObject<View | null>) {
    return () => {
      ref.current?.measureInWindow((x, y, w, h) => {
        if (w > 0) setRects(prev => ({ ...prev, [key]: { x, y, width: w, height: h } }));
      });
    };
  }

  return (
    <View style={styles.root} onLayout={() => setTimeout(measureAll, 200)}>

      {/* ── Mock Header ── */}
      <View style={[styles.mockHeader, { paddingTop: safeTop + 10 }]}>
        {currentStep.screen === 'feed' ? (
          <>
            <View style={styles.mockAvatar}>
              <Text style={styles.mockAvatarText}>★</Text>
            </View>
            <Text style={[styles.mockLogoText, { color: Brand.trust }]}>clique</Text>
            <View style={styles.mockHeaderRight}>
              <SymbolView name="bell" size={22} tintColor={Brand.ink} type="monochrome" />
              <View style={[styles.mockAvatar, { borderWidth: 2, borderColor: Brand.trust }]}>
                <Text style={styles.mockAvatarText}>YO</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {currentStep.screen === 'chats' ? (
              <>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mockHeaderTitle}>Chats</Text>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12, color: Brand.muted, marginTop: 1 }}>Your conversations</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={[styles.chatArchivedBtn, { borderColor: Brand.border }]}>
                    <Text style={[styles.chatArchivedText, { color: Brand.ink }]}>Archived</Text>
                  </View>
                  <SymbolView name="square.and.pencil" size={20} tintColor={Brand.ink} type="monochrome" />
                </View>
              </>
            ) : (
              <Text style={styles.mockHeaderTitle}>{SCREEN_TITLE[currentStep.screen]}</Text>
            )}
            {currentStep.screen === 'friends' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <View style={[styles.friendInviteBtn, { backgroundColor: Brand.trust }]}>
                  <Text style={styles.friendInviteBtnText}>+ Invite</Text>
                </View>
                <SymbolView name="person.badge.plus" size={22} tintColor={Brand.muted} type="monochrome" />
              </View>
            )}
            {currentStep.screen === 'library' && (
              <SymbolView name="plus" size={20} tintColor={Brand.ink} type="monochrome" />
            )}
            {currentStep.screen === 'news' && (
              <SymbolView name="slider.horizontal.3" size={20} tintColor={Brand.ink} type="monochrome" />
            )}
          </>
        )}
      </View>

      {/* ── Screen Content ── */}
      <View style={styles.contentArea}>

        {/* FEED — steps 0, 1, 2 */}
        {currentStep.screen === 'feed' && (
          <>
            <View
              ref={tabsRef}
              collapsable={false}
              onLayout={measureRef('tabs', tabsRef)}
              style={styles.feedTabsWrap}>
              {[
                { label: 'Feed', sf: 'house' as const },
                { label: 'Circles', sf: 'person.2' as const },
                { label: 'Lounge', sf: 'globe' as const },
                { label: 'For You', sf: 'sparkles' as const },
              ].map((t, i) => (
                <View key={t.label} style={[styles.feedTab, i === 0 && styles.feedTabActive]}>
                  <SymbolView name={t.sf} size={24} tintColor={i === 0 ? Brand.trust : Brand.muted} type="monochrome" />
                  <Text style={[styles.feedTabText, i === 0 && styles.feedTabTextActive]}>{t.label}</Text>
                  {i === 0 && <View style={styles.feedTabLine} />}
                </View>
              ))}
            </View>

            {/* NowBanner */}
            <View style={[styles.nowBanner, { backgroundColor: Brand.tlight }]}>
              <View style={styles.nowLeft}>
                <Text style={[styles.nowLabel, { color: Brand.trust }]}>YOU'RE WATCHING</Text>
                <Text style={[styles.nowTitle, { color: Brand.ink }]}>Oppenheimer</Text>
                <View style={[styles.nowBtn, { backgroundColor: Brand.trust }]}>
                  <Text style={styles.nowBtnText}>+ Log something</Text>
                </View>
              </View>
              <MockPoster posterKey="oppenheimer" fallbackEmoji="🎬" style={[styles.nowPoster, { backgroundColor: Brand.trust }]} />
            </View>

            {/* FilterChips */}
            <MockFilterChips Brand={Brand} />

            {/* Section label */}
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabelText, { color: Brand.muted }]}>FRIEND ACTIVITY</Text>
              <View style={[styles.sectionLabelLine, { backgroundColor: Brand.border }]} />
            </View>

            {/* Primary post card — matches real PostCard layout */}
            <View
              ref={postRef}
              collapsable={false}
              onLayout={measureRef('post', postRef)}
              style={[styles.postCard, { flexDirection: 'row', gap: 10 }]}>
              {/* Large poster on left */}
              <MockPoster posterKey="oppenheimer" fallbackEmoji="🎬" style={[styles.poster, { backgroundColor: '#1a1a2e' }]} />
              {/* Content on right */}
              <View style={{ flex: 1, minWidth: 0 }}>
                {/* Meta row: avatar · @handle · WATCHING pill · time */}
                <View style={styles.postMeta}>
                  <View style={styles.postAvatar}>
                    <Text style={styles.postAvatarText}>SH</Text>
                  </View>
                  <Text style={[styles.postHandle, { color: Brand.muted }]} numberOfLines={1}>@sherlockh</Text>
                  <View style={styles.postPill}>
                    <Text style={styles.postPillText}>WATCHING</Text>
                  </View>
                  <Text style={[styles.postTime, { color: Brand.muted }]}>2h</Text>
                </View>
                <Text style={[styles.postTitle, { color: Brand.ink }]}>Oppenheimer</Text>
                <Text style={[styles.postSub, { color: Brand.muted }]}>Film · 2023 · Drama · History</Text>
                <Text style={[styles.postNote, { color: Brand.muted }]} numberOfLines={2}>
                  {'“Deduced the ending in 12 minutes. Still kept me up for 3 days.”'}
                </Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4].map(i => (
                    <SymbolView key={i} name="star.fill" size={11} tintColor="#F4A340" type="monochrome" />
                  ))}
                  <SymbolView name="star.leadinghalf.filled" size={11} tintColor="#F4A340" type="monochrome" />
                </View>
                {/* Emoji reactions */}
                <View style={styles.emojiRow}>
                  {(['🔥 12', '💯 5'] as const).map(label => (
                    <View key={label} style={[styles.emojiPill, { borderColor: Brand.border }]}>
                      <Text style={[styles.emojiPillText, { color: Brand.ink }]}>{label}</Text>
                    </View>
                  ))}
                  <View style={[styles.emojiAddBtn, { borderColor: Brand.border }]}>
                    <Text style={[styles.emojiAddText, { color: Brand.muted }]}>+</Text>
                  </View>
                </View>
                {/* Actions row */}
                <View style={styles.actionsRow}>
                  <View style={[styles.metooBtn, { backgroundColor: Brand.tlight }]}>
                    <Text style={[styles.metooText, { color: Brand.trust }]}>✦ Me too! 3</Text>
                  </View>
                  <View
                    ref={actionRef}
                    collapsable={false}
                    onLayout={measureRef('action', actionRef)}
                    style={styles.actionBtn}>
                    <Text style={[styles.actionBtnText, { color: Brand.muted }]}>↗</Text>
                  </View>
                  <View style={styles.actionBtn}>
                    <SymbolView name="bubble.right" size={16} tintColor={Brand.muted} type="monochrome" />
                  </View>
                </View>
              </View>
            </View>

            {/* Second card — dimmed */}
            <View style={[styles.postCard, { flexDirection: 'row', gap: 10, opacity: 0.35 }]}>
              <MockPoster posterKey="succession" fallbackEmoji="📺" style={[styles.poster, { backgroundColor: '#1e2e1a' }]} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.postMeta}>
                  <View style={[styles.postAvatar, { backgroundColor: '#5c3317' }]}>
                    <Text style={styles.postAvatarText}>WP</Text>
                  </View>
                  <Text style={[styles.postHandle, { color: Brand.muted }]}>@winniepooh</Text>
                  <View style={[styles.postPill, { backgroundColor: Brand.tlight }]}>
                    <Text style={[styles.postPillText, { color: Brand.trust }]}>FINISHED</Text>
                  </View>
                  <Text style={[styles.postTime, { color: Brand.muted }]}>5h</Text>
                </View>
                <Text style={[styles.postTitle, { color: Brand.ink }]}>Succession</Text>
                <Text style={[styles.postSub, { color: Brand.muted }]}>TV Series · HBO · 2023</Text>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map(i => (
                    <SymbolView key={i} name="star.fill" size={11} tintColor="#F4A340" type="monochrome" />
                  ))}
                </View>
              </View>
            </View>
          </>
        )}

        {/* CHATS — step 3 */}
        {currentStep.screen === 'chats' && (
          <>
            {/* Chats / Requests mode tabs */}
            <View style={[styles.chatModeRow, { borderBottomColor: Brand.border }]}>
              <View style={styles.chatModeTab}>
                <Text style={[styles.chatModeTabText, styles.chatModeTabTextActive]}>Chats</Text>
                <View style={[styles.chatModeTabUnderline, { backgroundColor: Brand.trust }]} />
              </View>
              <View style={[styles.chatModeTab, { marginRight: 0 }]}>
                <Text style={styles.chatModeTabText}>Requests</Text>
              </View>
            </View>
            <View style={[styles.chatSearchRow, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
              <SymbolView name="magnifyingglass" size={15} tintColor={Brand.muted} type="monochrome" style={{ width: 16, height: 16, marginRight: 8 }} />
              <Text style={[styles.chatSearchText, { color: Brand.muted }]}>Search chats…</Text>
            </View>
            {[
              { img: require('../../../assets/avatars/sherlock.png'), name: 'Sherlock Holmes', time: '2h', msg: 'The game is afoot. Are you free tonight?', unread: 2 },
              { img: require('../../../assets/avatars/movienight.png'), name: 'Movie Night 🎬', time: '5h', msg: 'Winnie: Who\'s watching Nosferatu with me?', unread: 0 },
              { img: require('../../../assets/avatars/donquixote.png'), name: 'Don Quixote', time: '1d', msg: 'Did you see the Dune: Part 3 trailer?', unread: 0 },
            ].map((chat, i) => (
              <View key={i} style={[styles.chatCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                <Image source={chat.img} style={[styles.chatCardIcon, { borderRadius: 22 }]} />
                <View style={styles.chatCardBody}>
                  <View style={styles.chatCardTitleRow}>
                    <Text style={[styles.chatCardTitle, { color: Brand.ink }]} numberOfLines={1}>{chat.name}</Text>
                    <Text style={[styles.chatCardTime, { color: Brand.muted }]}>{chat.time}</Text>
                  </View>
                  <Text style={[styles.chatCardPreview, { color: Brand.muted }]} numberOfLines={1}>{chat.msg}</Text>
                </View>
                {chat.unread > 0 && (
                  <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: Brand.trust, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontFamily: BrandFonts.syneBold }}>{chat.unread}</Text>
                  </View>
                )}
              </View>
            ))}
          </>
        )}

        {/* FRIENDS — step 4 */}
        {currentStep.screen === 'friends' && (
          <>
            {/* Tab bar: Following | Followers | Watch Parties */}
            <View style={[styles.friendTabRow, { borderBottomColor: Brand.border }]}>
              {[
                { label: 'Following 3', active: true },
                { label: 'Followers 3', active: false },
                { label: 'Watch Parties', active: false },
              ].map((t) => (
                <View key={t.label} style={styles.friendTabItem}>
                  <Text style={[styles.friendTabLabel, t.active && styles.friendTabLabelActive]}>{t.label}</Text>
                  {t.active && <View style={[styles.friendTabUnderline, { backgroundColor: Brand.trust }]} />}
                </View>
              ))}
            </View>
            <View style={[styles.friendInnerSearch, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
              <Text style={styles.friendListSearchIcon}>🔍</Text>
              <Text style={[styles.friendListSearchText, { color: Brand.muted }]}>Search…</Text>
            </View>
            {[
              { img: require('../../../assets/avatars/sherlock.png'), name: 'Sherlock Holmes', handle: 'sherlockh', compat: 99, color: '#E84F4F', label: 'Movie Soulmate', verified: true },
              { img: require('../../../assets/avatars/winnie.png'), name: 'Winnie the Pooh', handle: 'winniepooh', compat: 78, color: '#5B4FE8', label: 'TV Twin', verified: false },
              { img: require('../../../assets/avatars/donquixote.png'), name: 'Don Quixote', handle: 'donquixote', compat: 52, color: '#9E9E9E', label: 'Curious Minds', verified: false },
            ].map((f, i) => (
              <View key={i} style={[styles.friendCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                <View style={styles.friendIdentity}>
                  {/* Avatar with colored ring + % badge */}
                  <View style={{ position: 'relative' }}>
                    <View style={[styles.friendAvatarRing, { borderColor: f.color }]}>
                      <Image source={f.img} style={[styles.friendAvatar, { borderRadius: 22 }]} />
                    </View>
                    <View style={[styles.friendPctBadge, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                      <Text style={[styles.friendPctText, { color: f.color }]}>{f.compat}%</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={[styles.friendName, { color: Brand.ink }]} numberOfLines={1}>{f.name}</Text>
                      {f.verified && (
                        <SymbolView name="checkmark.seal.fill" size={14} tintColor={Brand.trust} type="monochrome" style={{ width: 14, height: 14 }} />
                      )}
                    </View>
                    <Text style={[styles.friendHandle, { color: Brand.muted }]}>@{f.handle}</Text>
                    <Text style={[styles.friendCompatLabel, { color: f.color }]}>{f.label}</Text>
                  </View>
                </View>
                <View style={[styles.friendChatBtn, { backgroundColor: Brand.tlight }]}>
                  <SymbolView name="bubble.left" size={16} tintColor={Brand.trust} type="monochrome" style={{ width: 18, height: 18 }} />
                </View>
              </View>
            ))}
          </>
        )}

        {/* PROFILE — step 5 */}
        {currentStep.screen === 'library' && (
          <>
            {/* Profile header row: avatar + info + gear */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, gap: 14 }}>
              {/* Avatar with ring + online dot */}
              <View style={{ position: 'relative' }}>
                <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, borderColor: Brand.trust, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  <Image source={require('../../../assets/avatars/sherlock.png')} style={{ width: 63, height: 63, borderRadius: 31 }} />
                </View>
                <View style={{ position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: '#22C55E', borderWidth: 2, borderColor: Brand.paper }} />
              </View>

              {/* Name block */}
              <View style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.muted }}>@yourhandle</Text>
                  <SymbolView name="checkmark.seal.fill" size={13} tintColor={Brand.trust} type="monochrome" style={{ width: 13, height: 13 }} />
                </View>
                <Text style={{ fontFamily: BrandFonts.syneExtraBold, fontSize: 17, color: Brand.ink, marginTop: 1 }}>Your Name</Text>
                {/* Follow counts */}
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
                  <Text style={{ fontFamily: BrandFonts.syneExtraBold, fontSize: 14, color: Brand.ink }}>
                    {'10 '}<Text style={{ fontFamily: BrandFonts.interRegular, color: Brand.muted, fontSize: 13 }}>Following</Text>
                  </Text>
                  <Text style={{ fontFamily: BrandFonts.syneExtraBold, fontSize: 14, color: Brand.ink }}>
                    {'10 '}<Text style={{ fontFamily: BrandFonts.interRegular, color: Brand.muted, fontSize: 13 }}>Followers</Text>
                  </Text>
                </View>
              </View>

              {/* Gear icon */}
              <SymbolView name="gearshape" size={22} tintColor={Brand.muted} type="monochrome" style={{ width: 22, height: 22, marginTop: 4 }} />
            </View>

            {/* Profile tabs: Feed | Lists | Collection | Stats */}
            <View style={[styles.libTabRow, { borderBottomColor: Brand.border }]}>
              {(['Feed', 'Lists', 'Collection', 'Stats'] as const).map((t, i) => (
                <View key={t} style={styles.libTab}>
                  <Text style={[styles.libTabText, i === 0 && styles.libTabTextActive]}>{t}</Text>
                  {i === 0 && <View style={[styles.libTabUnderline, { backgroundColor: Brand.trust }]} />}
                </View>
              ))}
            </View>

            {/* Filter chips + sort */}
            <MockFilterChips Brand={Brand} />
            <View style={styles.libSortRow}>
              <Text style={[styles.libSortLabel, { color: Brand.muted }]}>Sort by</Text>
              <View style={[styles.libSortBtnActive, { backgroundColor: Brand.ink, borderColor: Brand.ink }]}>
                <Text style={styles.libSortBtnActiveText}>Recent</Text>
              </View>
              <View style={[styles.libSortBtn, { borderColor: Brand.border }]}>
                <Text style={[styles.libSortBtnText, { color: Brand.muted }]}>A–Z</Text>
              </View>
            </View>

            {/* Feed cards */}
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[
                { pk: 'oppenheimer' as const, emoji: '🎬', bg: '#1a1a2e', title: 'Oppenheimer', sub: 'Film • 2023', stars: '★★★★★', review: '"One of the most overwhelming cinematic experiences I\'ve ever had."' },
                { pk: 'succession'  as const, emoji: '📺', bg: '#1e2e1a', title: 'Succession',  sub: 'TV Series • HBO • 2023', stars: '★★★★★', review: '"The ending absolutely destroyed me. Nothing else comes close."' },
                { pk: 'tomorrow'    as const, emoji: '📖', bg: '#1e2a3f', title: 'Tomorrow, and Tomorrow...', sub: 'Gabrielle Zevin • Novel', stars: '★★★★', review: '"Quietly devastating. I thought about it for weeks after."' },
                { pk: 'bear'        as const, emoji: '📺', bg: '#2e1a1a', title: 'The Bear', sub: 'TV Series • FX • 2022', stars: '★★★', review: '"Stressful in the best way possible."' },
              ].map((item, i) => (
                <View key={i} style={[styles.libCard, { backgroundColor: Brand.card, borderColor: Brand.border, flexDirection: 'column', gap: 8 }]}>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                    <MockPoster posterKey={item.pk} fallbackEmoji={item.emoji} style={[styles.libPoster, { backgroundColor: item.bg }]} />
                    <View style={styles.libBody}>
                      <Text style={[styles.libTitle, { color: Brand.ink }]} numberOfLines={1}>{item.title}</Text>
                      <Text style={[styles.libSub, { color: Brand.muted }]} numberOfLines={1}>{item.sub}</Text>
                      <Text style={{ color: '#F5A623', fontSize: 13, marginTop: 4 }}>{item.stars}</Text>
                    </View>
                  </View>
                  <Text style={{ fontFamily: BrandFonts.interRegular, fontSize: 12.5, color: Brand.muted, fontStyle: 'italic', lineHeight: 17 }} numberOfLines={2}>{item.review}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* NEWS — step 6 */}
        {currentStep.screen === 'news' && (
          <>
            <Text style={[styles.newsSub, { color: Brand.muted }]}>
              What's happening in film, TV, books, games and music
            </Text>
            <View style={[styles.newsTabRow, { borderBottomColor: Brand.border }]}>
              {['Headlines', 'Cinema'].map((t, i) => (
                <View key={t} style={styles.newsTab}>
                  <Text style={[styles.newsTabText, i === 0 && styles.newsTabTextActive]}>{t}</Text>
                  {i === 0 && <View style={[styles.newsTabUnderline, { backgroundColor: Brand.trust }]} />}
                </View>
              ))}
            </View>
            <MockFilterChips Brand={Brand} />
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              {[
                { pk: 'oppenheimer' as const, emoji: '🎬', bg: '#1a1a2e', section: 'FILM',       time: '2h ago', headline: "Nolan's next: a Cold War spy thriller set in 1960s Berlin",    trail: "The director confirmed the project after months of speculation, with filming set to begin this winter." },
                { pk: 'bear'        as const, emoji: '📺', bg: '#1e2e1a', section: 'TELEVISION', time: '5h ago', headline: 'The Last of Us season 3 confirmed — begins filming this fall', trail: "HBO has greenlit a third season following the record-breaking success of season two." },
                { pk: 'tomorrow'    as const, emoji: '📖', bg: '#1e2a3f', section: 'BOOKS',      time: '1d ago', headline: "Zadie Smith's new novel is the read of the summer",           trail: "An ambitious, tender, and frequently hilarious story about family, identity and loss." },
              ].map((article, i) => (
                <View key={i} style={[styles.newsCard, { backgroundColor: Brand.card, borderColor: Brand.border }]}>
                  <MockPoster posterKey={article.pk} fallbackEmoji={article.emoji} style={[styles.newsThumb, { backgroundColor: article.bg }]} />
                  <View style={styles.newsBody}>
                    <View style={styles.newsMetaRow}>
                      <View style={[styles.newsPill, { backgroundColor: Brand.tlight }]}>
                        <Text style={[styles.newsPillText, { color: Brand.trust }]}>{article.section}</Text>
                      </View>
                      <Text style={[styles.newsTime, { color: Brand.muted }]}>{article.time}</Text>
                    </View>
                    <Text style={[styles.newsHeadline, { color: Brand.ink }]} numberOfLines={2}>{article.headline}</Text>
                    <Text style={[styles.newsTrail, { color: Brand.muted }]} numberOfLines={2}>{article.trail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

      </View>

      {/* ── Bottom Nav (always present) ── */}
      <View style={[styles.bottomNav, { paddingBottom: safeBottom + 8 }]}>
        {NAV_TABS.map((tab, i) => {
          const navRefs = [nav0Ref, nav1Ref, nav2Ref, nav3Ref, nav4Ref];
          const isActive = i === currentStep.navActive;
          const key = `nav${i}` as RefKey;
          return (
            <View
              key={tab.label}
              ref={navRefs[i]}
              collapsable={false}
              onLayout={measureRef(key, navRefs[i])}
              style={styles.navTab}>
              <SymbolView
                name={tab.sf}
                size={22}
                tintColor={isActive ? Brand.trust : Brand.muted}
                type="monochrome"
              />
              <Text style={[styles.navLabel, isActive && { color: Brand.trust }]}>
                {tab.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* ── Spotlight overlay ── */}
      {h && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={[styles.dim, { top: 0, left: 0, right: 0, height: h.y }]} />
          <View style={[styles.dim, { top: h.y + h.height, left: 0, right: 0, bottom: 0 }]} />
          <View style={[styles.dim, { top: h.y, left: 0, width: h.x, height: h.height }]} />
          <View style={[styles.dim, { top: h.y, left: h.x + h.width, right: 0, height: h.height }]} />
          <View style={[styles.spotBorder, { top: h.y, left: h.x, width: h.width, height: h.height }]} />
        </View>
      )}

      {/* ── Tooltip card ── */}
      <View style={[styles.tooltip, tooltipStyle()]}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View key={i} style={[styles.dot, i === step && styles.dotActive]} />
          ))}
        </View>
        <Text style={styles.tooltipTitle}>{currentStep.title}</Text>
        <Text style={styles.tooltipDesc}>{currentStep.desc}</Text>
        <View style={styles.btnRow}>
          {step > 0 ? (
            <Pressable style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backBtnText}>← Back</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable style={styles.nextBtn} onPress={advance}>
            <Text style={styles.nextBtnText}>{step === STEPS.length - 1 ? 'Done' : 'Next →'}</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Skip — top left in safe area ── */}
      <Pressable
        style={[styles.skipBtn, { top: Math.max(10, safeTop - 32) }]}
        onPress={onSkip}
        hitSlop={12}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>

    </View>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: Brand.paper },

    mockHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    mockHeaderTitle: {
      fontFamily: BrandFonts.syneExtraBold,
      fontSize: 26,
      color: Brand.ink,
      letterSpacing: -0.5,
    },
    mockLogoText: { fontFamily: BrandFonts.syneExtraBold, fontSize: 22, letterSpacing: -0.5 },
    mockHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    mockAvatar: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: Brand.trust,
      alignItems: 'center', justifyContent: 'center',
    },
    mockAvatarText: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: '#fff' },

    contentArea: { flex: 1 },

    // Feed
    feedTabsWrap: {
      flexDirection: 'row',
      paddingBottom: 14,
      marginBottom: 12,
      borderBottomWidth: 1,
      borderBottomColor: Brand.border,
    },
    feedTab: { alignItems: 'center', gap: 5, flex: 1, paddingTop: 4, paddingBottom: 6, position: 'relative' },
    feedTabActive: {},
    feedTabText: { fontFamily: BrandFonts.interMedium, fontSize: 11, color: Brand.muted },
    feedTabTextActive: { fontFamily: BrandFonts.syneBold, color: Brand.trust },
    feedTabLine: {
      position: 'absolute', bottom: 0, left: '20%', right: '20%',
      height: 2.5, backgroundColor: Brand.trust, borderRadius: 2,
    },
    // Now banner
    nowBanner: {
      borderRadius: 20, minHeight: 150, marginHorizontal: 16,
      marginBottom: 22, overflow: 'hidden', flexDirection: 'row',
    },
    nowLeft: { flex: 1, paddingVertical: 18, paddingLeft: 18, paddingRight: 14, justifyContent: 'center' },
    nowLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1, marginBottom: 6 },
    nowTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 21, lineHeight: 25, marginBottom: 14 },
    nowBtn: { borderRadius: 24, paddingVertical: 11, paddingHorizontal: 18, alignSelf: 'flex-start' as const },
    nowBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
    nowPoster: { width: 150, alignItems: 'center', justifyContent: 'center', borderTopLeftRadius: 56 },

    // Section label
    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 14 },
    sectionLabelText: { fontFamily: BrandFonts.syneBold, fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: 1 },
    sectionLabelLine: { flex: 1, height: 1 },

    postCard: {
      backgroundColor: Brand.card,
      borderWidth: 1, borderColor: Brand.border, borderRadius: 16,
      padding: 12, marginHorizontal: 16, marginTop: 0,
    },
    poster: { width: 90, height: 135, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    posterEmoji: { fontSize: 30 },
    postMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5, flexWrap: 'wrap' as const },
    postAvatar: {
      width: 22, height: 22, borderRadius: 11,
      backgroundColor: '#1a1a2e',
      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    postAvatarText: { fontFamily: BrandFonts.syneBold, fontSize: 7, color: '#fff' },
    postHandle: { fontFamily: BrandFonts.interMedium, fontSize: 11, flexShrink: 1 },
    postPill: {
      backgroundColor: '#FFEDED', borderRadius: 6,
      paddingHorizontal: 5, paddingVertical: 2,
    },
    postPillText: { fontFamily: BrandFonts.syneBold, fontSize: 9, color: '#E84F4F' },
    postTime: { fontFamily: BrandFonts.interRegular, fontSize: 10, marginLeft: 'auto' as const },
    postTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 14, marginBottom: 2 },
    postSub: { fontFamily: BrandFonts.interRegular, fontSize: 10.5, marginBottom: 4 },
    postNote: { fontFamily: BrandFonts.interRegular, fontSize: 11, lineHeight: 15, marginBottom: 5 },
    stars: { flexDirection: 'row', gap: 2, marginBottom: 6 },
    emojiRow: { flexDirection: 'row', gap: 5, alignItems: 'center', marginBottom: 7 },
    emojiPill: {
      borderWidth: 1, borderRadius: 20,
      paddingHorizontal: 7, paddingVertical: 3,
    },
    emojiPillText: { fontFamily: BrandFonts.syneBold, fontSize: 10 },
    emojiAddBtn: {
      width: 22, height: 22, borderRadius: 11,
      borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    },
    emojiAddText: { fontFamily: BrandFonts.syneBold, fontSize: 13, lineHeight: 16 },
    actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metooBtn: {
      flex: 1, borderRadius: 20, paddingVertical: 5,
      alignItems: 'center' as const,
    },
    metooText: { fontFamily: BrandFonts.syneBold, fontSize: 11 },
    actionBtn: {
      width: 30, height: 30, borderRadius: 15,
      alignItems: 'center', justifyContent: 'center',
    },
    actionBtnText: { fontSize: 16 },

    // Reactions
    reactionsRow: { flexDirection: 'row', gap: 5, marginTop: 8, flexWrap: 'wrap' as const },
    reactionPill: {
      flexDirection: 'row', alignItems: 'center', gap: 3,
      borderWidth: 1, borderRadius: 20, paddingVertical: 3, paddingHorizontal: 7,
    },
    reactionEmoji: { fontSize: 11 },
    reactionCount: { fontSize: 10, fontFamily: BrandFonts.syneBold },

    // Watch Party banner
    watchPartyBanner: {
      flexDirection: 'row', alignItems: 'center', gap: 10,
      borderRadius: 14, marginHorizontal: 16, marginBottom: 10,
      padding: 12,
    },
    watchPartyEmoji: { fontSize: 22 },
    watchPartyTitle: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
    watchPartySub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
    watchPartyChevron: { color: '#fff', fontSize: 20, opacity: 0.7 },

    // Verified badge
    verifiedBadge: {
      width: 14, height: 14, borderRadius: 7,
      alignItems: 'center', justifyContent: 'center',
    },
    verifiedTick: { color: '#fff', fontSize: 8, fontFamily: BrandFonts.syneBold },

    // Chats
    chatArchivedBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
    chatArchivedText: { fontFamily: BrandFonts.syneBold, fontSize: 13 },
    chatPlusBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    chatPlusText: { color: '#fff', fontSize: 20, fontFamily: BrandFonts.syneBold, lineHeight: 24 },
    chatModeRow: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 16, marginBottom: 8 },
    chatModeTab: { paddingBottom: 11, paddingTop: 2, marginRight: 24, position: 'relative' },
    chatModeTabInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    chatModeTabText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.muted },
    chatModeTabTextActive: { fontFamily: BrandFonts.syneExtraBold, color: Brand.ink },
    chatModeTabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, borderRadius: 1 },
    chatModeBadge: {
      minWidth: 18, height: 18, borderRadius: 9,
      backgroundColor: Brand.border,
      alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
    },
    chatModeBadgeActive: { backgroundColor: Brand.trust },
    chatModeBadgeText: { color: Brand.muted, fontSize: 9.5, fontFamily: BrandFonts.syneBold },
    chatModeBadgeTextActive: { color: '#fff' },
    chatSearchRow: {
      flexDirection: 'row', alignItems: 'center',
      marginHorizontal: 16, marginBottom: 8,
      borderWidth: 1, borderRadius: 14, paddingLeft: 14, paddingRight: 14,
    },
    chatSearchEmoji: { fontSize: 14, marginRight: 8 },
    chatSearchText: { flex: 1, paddingVertical: 12, fontFamily: BrandFonts.interRegular, fontSize: 14.5 },
    chatCard: {
      borderWidth: 1, borderRadius: 16, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginBottom: 10,
    },
    chatCardIcon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    chatCardBody: { flex: 1, minWidth: 0 },
    chatCardTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    chatCardTitle: { flex: 1, fontFamily: BrandFonts.syneExtraBold, fontSize: 15 },
    chatCardTime: { fontFamily: BrandFonts.interRegular, fontSize: 11.5, marginLeft: 8 },
    chatCardPreview: { fontFamily: BrandFonts.interRegular, fontSize: 13 },
    chatCardPreviewUser: { fontFamily: BrandFonts.interMedium },

    // Friends header extras
    friendInviteBtn: { borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14 },
    friendInviteBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },

    // Friends tabs — three tabs so font size is slightly smaller
    friendTabRow: {
      flexDirection: 'row', marginHorizontal: 16,
      borderBottomWidth: 1, marginBottom: 12,
    },
    friendTabItem: { paddingBottom: 11, paddingTop: 2, marginRight: 14, position: 'relative' },
    friendTabLabel: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
    friendTabLabelActive: { fontFamily: BrandFonts.syneExtraBold, color: Brand.ink },
    friendTabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2 },

    // Friends inner search
    friendInnerSearch: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      marginHorizontal: 16, marginBottom: 10,
      borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9,
    },
    friendListSearchIcon: { fontSize: 14 },
    friendListSearchText: { fontFamily: BrandFonts.interRegular, fontSize: 14.5 },

    // Friend cards
    friendCard: {
      marginHorizontal: 16, marginBottom: 12,
      borderWidth: 1, borderRadius: 18, padding: 14,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    friendIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
    friendAvatar: {
      width: 46, height: 46, borderRadius: 23,
      alignItems: 'center', justifyContent: 'center',
    },
    friendAvatarRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
    friendPctBadge: { position: 'absolute', bottom: -2, right: -4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 4, paddingVertical: 1 },
    friendPctText: { fontFamily: BrandFonts.syneBold, fontSize: 9 },
    friendAvatarText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: '#fff' },
    friendName: { fontFamily: BrandFonts.syneBold, fontSize: 15.5 },
    friendHandle: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, marginTop: 2 },
    friendCompatLabel: { fontFamily: BrandFonts.syneBold, fontSize: 11.5, marginTop: 4 },
    friendChatBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

    // Library tabs
    libTabRow: {
      flexDirection: 'row', paddingHorizontal: 16,
      borderBottomWidth: 1, borderBottomColor: Brand.border,
    },
    libTab: { paddingBottom: 11, paddingTop: 2, marginRight: 24, position: 'relative' },
    libTabText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.muted },
    libTabTextActive: { fontFamily: BrandFonts.syneExtraBold, color: Brand.ink },
    libTabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2, borderRadius: 1 },

    // Library
    libSortRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6 },
    libSortLabel: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, marginRight: 2 },
    libSortBtnActive: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
    libSortBtnActiveText: { fontFamily: BrandFonts.syneBold, fontSize: 12, color: '#fff' },
    libSortBtn: { borderWidth: 1.5, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
    libSortBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 12 },
    libCard: {
      borderRadius: 16, borderWidth: 1, padding: 14,
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    },
    libPoster: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    libBody: { flex: 1, minWidth: 0 },
    libTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 15, marginBottom: 2 },
    libSub: { fontFamily: BrandFonts.interRegular, fontSize: 12.5, marginBottom: 6 },
    libMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    libBadge: { borderRadius: 20, paddingVertical: 3, paddingHorizontal: 9 },
    libBadgeText: { fontFamily: BrandFonts.syneBold, fontSize: 10, lineHeight: 14 },
    libDate: { fontFamily: BrandFonts.interRegular, fontSize: 12 },
    libShareIcon: { marginLeft: 'auto' as const, fontSize: 14 },

    // News
    newsSub: { fontFamily: BrandFonts.interRegular, fontSize: 13, marginHorizontal: 16, marginBottom: 12 },
    newsTabRow: { flexDirection: 'row' as const, paddingHorizontal: 16, borderBottomWidth: 1, marginBottom: 8 },
    newsTab: { paddingBottom: 11, paddingTop: 2, marginRight: 24, position: 'relative' as const },
    newsTabText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.muted },
    newsTabTextActive: { fontFamily: BrandFonts.syneExtraBold, color: Brand.ink },
    newsTabUnderline: { position: 'absolute' as const, bottom: -1, left: 0, right: 0, height: 2, borderRadius: 1 },
    newsCard: {
      borderWidth: 1, borderRadius: 16, padding: 12,
      flexDirection: 'row', gap: 12, alignItems: 'flex-start',
    },
    newsThumb: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    newsBody: { flex: 1, minWidth: 0 },
    newsMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    newsPill: { borderRadius: 20, paddingVertical: 2, paddingHorizontal: 8 },
    newsPillText: { fontFamily: BrandFonts.syneBold, fontSize: 10, letterSpacing: 0.5 },
    newsTime: { fontFamily: BrandFonts.interRegular, fontSize: 11.5 },
    newsHeadline: { fontFamily: BrandFonts.syneBold, fontSize: 14.5, color: Brand.ink, marginBottom: 3 },
    newsTrail: { fontFamily: BrandFonts.interRegular, fontSize: 12.8, lineHeight: 17 },

    // Bottom nav
    bottomNav: {
      flexDirection: 'row',
      borderTopWidth: 1, borderTopColor: Brand.border,
      backgroundColor: Brand.paper, paddingTop: 10,
    },
    navTab: { flex: 1, alignItems: 'center', gap: 3 },
    navLabel: { fontFamily: BrandFonts.syneBold, fontSize: 10, color: Brand.muted },

    // Spotlight
    dim: { position: 'absolute', backgroundColor: 'rgba(0,0,0,0.45)' },
    spotBorder: {
      position: 'absolute',
      borderWidth: 2, borderColor: Brand.trust, borderRadius: 14,
    },

    // Tooltip
    tooltip: {
      backgroundColor: Brand.card,
      borderRadius: 20, padding: 20,
      borderWidth: 1, borderColor: Brand.border,
      shadowColor: '#000', shadowOpacity: 0.18,
      shadowRadius: 24, shadowOffset: { width: 0, height: 6 },
      elevation: 10,
    },
    dots: { flexDirection: 'row', gap: 5, marginBottom: 12 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: Brand.border },
    dotActive: { width: 14, backgroundColor: Brand.trust },
    tooltipTitle: {
      fontFamily: BrandFonts.syneExtraBold, fontSize: 18,
      color: Brand.ink, marginBottom: 6,
    },
    tooltipDesc: {
      fontFamily: BrandFonts.interRegular, fontSize: 14,
      color: Brand.muted, lineHeight: 20, marginBottom: 16,
    },
    btnRow: {
      flexDirection: 'row', alignItems: 'center',
      justifyContent: 'space-between', gap: 10,
    },
    backBtn: {
      paddingVertical: 13, paddingHorizontal: 16,
      borderRadius: 12, borderWidth: 1, borderColor: Brand.border,
    },
    backBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 14, color: Brand.muted },
    nextBtn: {
      flex: 1, backgroundColor: Brand.trust,
      borderRadius: 12, paddingVertical: 13, alignItems: 'center',
    },
    nextBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: '#fff' },

    // Skip
    skipBtn: {
      position: 'absolute', left: 20,
      paddingHorizontal: 14, paddingVertical: 7,
      borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.28)',
    },
    skipText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: '#fff' },
  });
}
