import { type ReactNode, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

const BTN_WIDTH = 80;

function RightActions({
  progress,
  onArchive,
  onDelete,
  close,
}: {
  progress: Animated.AnimatedInterpolation<number>;
  onArchive: () => void;
  onDelete: () => void;
  close: () => void;
}) {
  const translateArchive = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [BTN_WIDTH * 2, 0],
  });
  const translateDelete = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [BTN_WIDTH, 0],
  });

  return (
    <View style={styles.actionsWrap}>
      <Animated.View style={{ transform: [{ translateX: translateArchive }] }}>
        <Pressable
          style={styles.archiveBtn}
          onPress={() => { close(); onArchive(); }}>
          <Text style={styles.btnText}>Archive</Text>
        </Pressable>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: translateDelete }] }}>
        <Pressable
          style={styles.deleteBtn}
          onPress={() => { close(); onDelete(); }}>
          <Text style={styles.btnText}>Delete</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export function SwipeableChatRow({
  children,
  onArchive,
  onDelete,
}: {
  children: ReactNode;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const swipeableRef = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={swipeableRef}
      friction={2}
      rightThreshold={40}
      renderRightActions={(progress) => (
        <RightActions
          progress={progress}
          onArchive={onArchive}
          onDelete={onDelete}
          close={() => swipeableRef.current?.close()}
        />
      )}>
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  actionsWrap: {
    flexDirection: 'row',
    width: BTN_WIDTH * 2,
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 6,
  },
  archiveBtn: {
    width: BTN_WIDTH - 6,
    height: '90%',
    backgroundColor: '#5B8DEF',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: BTN_WIDTH - 6,
    height: '90%',
    backgroundColor: '#E84F4F',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
