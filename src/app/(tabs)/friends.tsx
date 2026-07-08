import { useMemo } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FriendCard } from '@/components/friends/friend-card';
import { FriendRequestCard } from '@/components/friends/friend-request-card';
import { SuggestedUserCard } from '@/components/friends/suggested-user-card';
import { UserSearch } from '@/components/friends/user-search';
import { BrandFonts, Spacing, type BrandPalette } from '@/constants/theme';
import { useFeedPosts } from '@/features/feed/api';
import {
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  useFriendRequests,
  useFriends,
  useSendFriendRequest,
  useSuggestedFriends,
  type Profile,
} from '@/features/friends/api';
import { computeCompatibility } from '@/features/friends/compatibility';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';

export default function FriendsScreen() {
  const { user } = useSession();
  const Brand = useBrand();
  const styles = useMemo(() => createStyles(Brand), [Brand]);
  const { data: friends, isLoading, isFetching, refetch } = useFriends();
  const { data: requests } = useFriendRequests();
  const { data: suggestions } = useSuggestedFriends();
  const { allPosts } = useFeedPosts('all');
  const acceptRequest = useAcceptFriendRequest();
  const declineRequest = useDeclineFriendRequest();
  const sendRequest = useSendFriendRequest();

  const myPosts = allPosts.filter((p) => p.user_id === user?.id);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <FlatList
        contentContainerStyle={styles.content}
        data={friends ?? []}
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
            <View style={styles.findRow}>
              <Pressable
                style={styles.findBtn}
                onPress={() =>
                  Alert.alert('Find friends via Facebook', 'Coming soon — this will let you find friends already on the clique through your Facebook account.')
                }>
                <Text style={styles.findBtnIcon}>📘</Text>
                <Text style={styles.findBtnText}>Facebook</Text>
              </Pressable>
              <Pressable
                style={styles.findBtn}
                onPress={() =>
                  Alert.alert('Find friends via Contacts', 'Coming soon — this will match your phone contacts against people already on the clique.')
                }>
                <Text style={styles.findBtnIcon}>📱</Text>
                <Text style={styles.findBtnText}>Contacts</Text>
              </Pressable>
            </View>
            <UserSearch />
            {requests?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  👋 Friend Requests <Text style={styles.countBadge}>{requests.length}</Text>
                </Text>
                {requests.map((request) => (
                  <FriendRequestCard
                    key={request.friendshipId}
                    request={request}
                    onAccept={() =>
                      acceptRequest.mutate(request, {
                        onError: (err) => Alert.alert('Could not accept request', err.message),
                      })
                    }
                    onDecline={() =>
                      declineRequest.mutate(request.friendshipId, {
                        onError: (err) => Alert.alert('Could not decline request', err.message),
                      })
                    }
                  />
                ))}
              </View>
            ) : null}
            {suggestions?.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>People you may know</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestRow}>
                  {suggestions.map((profile) => (
                    <SuggestedUserCard
                      key={profile.id}
                      profile={profile}
                      mutualCount={profile.mutualCount}
                      isAdding={sendRequest.isPending && sendRequest.variables === profile.id}
                      onAdd={() => sendRequest.mutate(profile.id)}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}
            <Text style={styles.sectionLabel}>
              Your friends{friends?.length ? ` ${friends.length}` : ''}
            </Text>
          </View>
        }
        renderItem={({ item }: { item: Profile }) => {
          const friendPosts = allPosts.filter((p) => p.user_id === item.id);
          return <FriendCard profile={item} compatibility={computeCompatibility(myPosts, friendPosts)} />;
        }}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={styles.empty}>
              No friends yet — search above to find people on TrustMe.
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function createStyles(Brand: BrandPalette) {
  return StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Brand.paper },
  content: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, paddingBottom: Spacing.six },
  findRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.three },
  findBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: Brand.card,
    borderWidth: 1,
    borderColor: Brand.border,
    borderRadius: 14,
    paddingVertical: 11,
  },
  findBtnIcon: { fontSize: 15 },
  findBtnText: { fontFamily: BrandFonts.syneBold, fontSize: 13, color: Brand.ink },
  section: { marginBottom: Spacing.two },
  suggestRow: { gap: 10, paddingBottom: 4 },
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
