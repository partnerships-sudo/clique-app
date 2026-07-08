import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const DELETE_WIDTH = 84;
const OPEN_THRESHOLD = -DELETE_WIDTH / 2;

export function SwipeableRow({
  children,
  onDelete,
  enabled = true,
}: {
  children: ReactNode;
  onDelete: () => void;
  enabled?: boolean;
}) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-10, 10])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      translateX.value = Math.min(0, Math.max(-DELETE_WIDTH, e.translationX));
    })
    .onEnd(() => {
      translateX.value = withSpring(translateX.value < OPEN_THRESHOLD ? -DELETE_WIDTH : 0, {
        damping: 20,
        stiffness: 220,
      });
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  function handleDelete() {
    translateX.value = withSpring(0, { damping: 20, stiffness: 220 });
    onDelete();
  }

  if (!enabled) return <>{children}</>;

  return (
    <View style={styles.container}>
      <View style={styles.deleteAction}>
        <Pressable style={styles.deleteBtn} onPress={handleDelete} hitSlop={8}>
          <Text style={styles.deleteBtnText}>Delete</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <Animated.View style={rowStyle}>{children}</Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'relative' },
  deleteAction: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: DELETE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    backgroundColor: '#E84F4F',
    borderRadius: 14,
    width: DELETE_WIDTH - 12,
    height: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
