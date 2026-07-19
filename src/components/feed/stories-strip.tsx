import { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useCloseFriendIds } from '@/features/close-friends/api';
import type { StoryPost } from '@/features/close-friends/posts';
import { useSeenStoryIds } from '@/features/stories/views';
import { useSession } from '@/hooks/use-session';

export function CloseFriendsButton({
  posts,
  onPress,
}: {
  posts: StoryPost[];
  onPress: () => void;
}) {
  const { user } = useSession();
  const { data: seenIds = [] } = useSeenStoryIds();
  const { data: closeFriendIds } = useCloseFriendIds();
  const hasCloseFriends = closeFriendIds ? closeFriendIds.size > 0 : false;
  const hasNew = hasCloseFriends && posts.some((p) => p.user_id !== user?.id && !seenIds.includes(p.id));

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  function showTooltip() {
    setTooltipVisible(true);
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setTooltipVisible(false));
  }

  function handlePress() {
    if (!hasCloseFriends) {
      showTooltip();
    } else {
      onPress();
    }
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={handlePress} hitSlop={8} style={styles.wrap}>
        <View style={[styles.ring, !hasNew && styles.ringSeen]}>
          <View style={styles.inner}>
            <Text style={[styles.star, !hasNew && styles.starSeen]}>
              {hasNew ? '★' : '☆'}
            </Text>
          </View>
        </View>
      </Pressable>
      {tooltipVisible && (
        <Animated.View style={[styles.tooltip, { opacity }]}>
          <Text style={styles.tooltipText}>Add close friends to see their stories</Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start' },
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSeen: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#9CA3AF',
  },
  inner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { fontSize: 16, color: '#059669' },
  starSeen: { color: '#9CA3AF' },
  tooltip: {
    position: 'absolute',
    top: 48,
    left: 0,
    backgroundColor: '#1C1830',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 200,
    zIndex: 100,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
});
