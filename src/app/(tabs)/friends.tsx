import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
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
            {/* Header row */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Friends</Text>
              <View style={styles.headerActions}>
                <Pressable style={styles.inviteBtn} onPress={() => setInviteSheetVisible(true)}>
                  <Text style={styles.inviteBtnText}>+ Invite</Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => router.push('/discover-people-modal')}>
                  <SymbolView name="person.badge.plus" size={22} tintColor={Brand.muted} style={{ width: 26, height: 24 }} />
                </Pressable>
                <Pressable hitSlop={8} onPress={() => router.push('/settings')}>
                  <SymbolView name="gearshape" size={22} tintColor={Brand.muted} style={{ width: 24, height: 24 }} />
                </Pressable>
              </View>
            </View>

            {/* Following / Followers underline tabs */}
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
            </View>

            {/* Inner search */}
            <UserSearch ref={searchRef} />

            {/* Follow requests */}
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

            {/* Suggested follows */}
            {visibleSuggestions.length ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionLabelInline}>People you may know</Text>
                  <Pressable hitSlop={8} onPress={() => Alert.alert('People you may know', 'More suggestions coming soon.')}>
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
          const friendPosts = allPosts.filter((p) => p.user_id === item.id);
          const compat = computeCompatibility(myPosts, friendPosts);
          const activePost = [...friendPosts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
          return (
            <FriendCard
              profile={item}
              compatibility={compat}
              hasUnread={unreadFriendIds.has(item.id)}
              currentlyWatching={activePost}
              isTopMatch={index === 0 && tab === 'following'}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  headerTitle: { fontFamily: BrandFonts.syneExtraBold, fontSize: 28, color: Brand.ink },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  inviteBtn: { backgroundColor: Brand.trust, borderRadius: 50, paddingVertical: 9, paddingHorizontal: 18 },
  inviteBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13.5, color: '#fff' },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Brand.border, marginBottom: 14 },
  tabBtn: { paddingVertical: 10, paddingHorizontal: 4, marginRight: 20 },
  tabBtnActive: { borderBottomWidth: 2.5, borderBottomColor: Brand.trust },
  tabBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 15, color: Brand.muted },
  tabBtnTextActive: { color: Brand.ink },
  section: { marginBottom: Spacing.two },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabelInline: { fontFamily: BrandFonts.syneBold, fontSize: 11, color: Brand.muted, textTransform: 'uppercase', letterSpacing: 1 },
  seeAll: { fontFamily: BrandFonts.syneBold, fontSize: 12.5, color: Brand.trust },
  suggestRow: { paddingBottom: 4 },
  empty: { textAlign: 'center', paddingVertical: 40, paddingHorizontal: 20, color: Brand.muted, fontFamily: BrandFonts.interRegular, fontSize: 13.6 },
  });
}
