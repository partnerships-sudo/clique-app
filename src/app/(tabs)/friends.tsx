import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
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
  useDeclineFollowRequest,
  useFollow,
  useFollowRequests,
  useFollowers,
  useFollowing,
  useSuggestedFollows,
  type Profile,
} from '@/features/follows/api';
import { computeCompatibility } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

type FollowListTab = 'following' | 'followers';

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
  const { threads: dmThreads } = useDmThreads();
  const acceptRequest = useAcceptFollowRequest();
  const declineRequest = useDeclineFollowRequest();
  const follow = useFollow();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [inviteSheetVisible, setInviteSheetVisible] = useState(false);

  const listRef = useRef<FlatList>(null);
  const searchRef = useRef<UserSearchHandle>(null);

  const list = tab === 'following' ? following : followers;
  const isLoading = tab === 'following' ? followingLoading : followersLoading;
  const isFetching = tab === 'following' ? followingFetching : followersFetching;
  const refetch = tab === 'following' ? refetchFollowing : refetchFollowers;

  const myPosts = allPosts.filter((p) => p.user_id === user?.id);
  const visibleSuggestions = (suggestions ?? []).filter((s) => !dismissedIds.has(s.id));
  const unreadFriendIds = new Set((dmThreads ?? []).filter((t) => t.isUnread).map((t) => t.friendId));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        ref={listRef}
        contentContainerStyle={styles.content}
        data={list ?? []}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && !isLoading}
            onRefresh={refetch}
            tintColor={Brand.trust}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTitleCol}>
                <Text style={styles.headerTitle}>Friends</Text>
                <Text style={styles.headerSubtitle}>The more friends, the better the experience.</Text>
              </View>
              <View style={styles.headerActions}>
                <Pressable style={styles.headerIconBtn} hitSlop={6} onPress={() => setInviteSheetVisible(true)}>
                  <Text style={styles.headerIconGlyph}>👤</Text>
                  <View style={styles.headerIconPlusBadge}>
                    <Text style={styles.headerIconPlusText}>+</Text>
                  </View>
                </Pressable>
                <Pressable style={styles.headerIconBtn} hitSlop={6} onPress={() => router.push('/settings')}>
                  <Text style={styles.headerIconGlyph}>⚙</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.findRow}>
              <Pressable
                style={styles.findBtn}
                onPress={() =>
                  Alert.alert('Find friends via Facebook', 'Coming soon — this will let you find friends already on Clique through your Facebook account.')
                }>
                <View style={[styles.findBtnIconWrap, { backgroundColor: '#1877F2' }]}>
                  <Text style={styles.findBtnIcon}>f</Text>
                </View>
                <View style={styles.findBtnText}>
                  <Text style={styles.findBtnTitle}>Connect Facebook</Text>
                  <Text style={styles.findBtnSub}>Find your friends</Text>
                </View>
              </Pressable>
              <Pressable
                style={styles.findBtn}
                onPress={() =>
                  Alert.alert('Find friends via Contacts', 'Coming soon — this will match your phone contacts against people already on Clique.')
                }>
                <View style={[styles.findBtnIconWrap, { backgroundColor: Brand.trust }]}>
                  <Text style={styles.findBtnIcon}>👥</Text>
                </View>
                <View style={styles.findBtnText}>
                  <Text style={styles.findBtnTitle}>Sync Contacts</Text>
                  <Text style={styles.findBtnSub}>Find your contacts</Text>
                </View>
              </Pressable>
            </View>

            <UserSearch ref={searchRef} />

            {requests?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  👋 Follow Requests <Text style={styles.countBadge}>{requests.length}</Text>
                </Text>
                {requests.map((request) => (
                  <FriendRequestCard
                    key={request.followId}
                    request={request}
                    onAccept={() =>
                      acceptRequest.mutate(request, {
                        onError: (err) => Alert.alert('Could not accept request', err.message),
                      })
                    }
                    onDecline={() =>
                      declineRequest.mutate(request.followId, {
                        onError: (err) => Alert.alert('Could not decline request', err.message),
                      })
                    }
                  />
                ))}
              </View>
            ) : null}

            {visibleSuggestions.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabelInline}>People you may know</Text>
                  <Pressable
                    hitSlop={8}
                    onPress={() => Alert.alert('People you may know', 'More suggestions coming soon.')}>
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
                      onAdd={() =>
                        follow.mutate({ targetUserId: profile.id, isTargetPrivate: profile.is_private })
                      }
                      onDismiss={() => setDismissedIds((prev) => new Set(prev).add(profile.id))}
                    />
                  )}
                />
              </View>
            ) : null}

            <View style={styles.tabRow}>
              <Pressable
                style={[styles.tabBtn, tab === 'following' && styles.tabBtnActive]}
                onPress={() => setTab('following')}>
                <Text style={[styles.tabBtnText, tab === 'following' && styles.tabBtnTextActive]}>
                  Following{following?.length ? ` (${following.length})` : ''}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tabBtn, tab === 'followers' && styles.tabBtnActive]}
                onPress={() => setTab('followers')}>
                <Text style={[styles.tabBtnText, tab === 'followers' && styles.tabBtnTextActive]}>
                  Followers{followers?.length ? ` (${followers.length})` : ''}
                </Text>
              </Pressable>
            </View>
          </View>
        }
        renderItem={({ item }: { item: Profile }) => {
          const friendPosts = allPosts.filter((p) => p.user_id === item.id);
          return (
            <FriendCard
              profile={item}
              compatibility={computeCompatibility(myPosts, friendPosts)}
              hasUnread={unreadFriendIds.has(item.id)}
            />
          );
        }}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>
              {tab === 'following'
                ? "You're not following anyone yet — search above to find people on Clique."
                : 'No followers yet.'}
            </Text>
          ) : null
        }
      />
      <InviteSheet visible={inviteSheetVisible} onClose={() => setInviteSheetVisible(false)} />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.two, paddingBottom: Spacing.six },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  headerTitleCol: { flex: 1, minWidth: 0, marginRight: 12 },
  headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink },
  headerSubtitle: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 12.5,
    color: Brand.muted,
    marginTop: 4,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Brand.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconGlyph: { fontSize: 18, color: Brand.ink },
  headerIconPlusBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Brand.trust,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIconPlusText: { fontSize: 9, color: '#fff', fontFamily: BrandFonts.syneBold, lineHeight: 11 },
  findRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.three },
  findBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Brand.card,
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  findBtnIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  findBtnIcon: { fontSize: 17, color: '#fff', fontFamily: BrandFonts.syneExtraBold },
  findBtnText: { flex: 1, minWidth: 0 },
  findBtnTitle: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.ink },
  findBtnSub: { fontFamily: BrandFonts.interRegular, fontSize: 11, color: Brand.muted, marginTop: 1 },
  section: { marginBottom: Spacing.two },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabelInline: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  seeAll: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.trust },
  suggestRow: { paddingBottom: 4 },
  sectionLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 11,
    color: Brand.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  countBadge: {
    backgroundColor: '#E84F4F',
    color: '#fff',
    fontSize: 10,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    padding: 5,
    marginBottom: Spacing.three,
  },
  tabBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  tabBtnActive: { backgroundColor: Brand.ink },
  tabBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.muted },
  tabBtnTextActive: { color: '#fff' },
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
