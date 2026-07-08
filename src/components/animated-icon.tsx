import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

const RING_CONFIG = [
  { size: 160, color: 'rgba(124,58,237,0.55)', delay: 0 },
  { size: 210, color: 'rgba(124,58,237,0.28)', delay: 70 },
  { size: 260, color: 'rgba(124,58,237,0.12)', delay: 140 },
];

function Ring({
  scale,
  opacity,
  size,
  borderColor,
}: {
  scale: ReturnType<typeof useSharedValue<number>>;
  opacity: ReturnType<typeof useSharedValue<number>>;
  size: number;
  borderColor: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View style={[styles.ring, { width: size, height: size, borderColor }, style]} />;
}

export function AnimatedSplashOverlay() {
  const [visible, setVisible] = useState(true);

  const overlayOpacity = useSharedValue(1);
  const btnScale = useSharedValue(1);

  const r1Scale = useSharedValue(0.92);
  const r1Opacity = useSharedValue(0);
  const r2Scale = useSharedValue(0.92);
  const r2Opacity = useSharedValue(0);
  const r3Scale = useSharedValue(0.92);
  const r3Opacity = useSharedValue(0);
  const rings = [
    { scale: r1Scale, opacity: r1Opacity },
    { scale: r2Scale, opacity: r2Opacity },
    { scale: r3Scale, opacity: r3Opacity },
  ];

  useEffect(() => {
    function fireClick() {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }

    const PRESS_DELAY = 500;
    const PRESS_DURATION = 120;
    const HOLD = 300;
    const RELEASE_DURATION = 420;
    const RIPPLE_DURATION = 2700;

    // Button: quick press down, satisfying elastic bounce back
    btnScale.value = withDelay(
      PRESS_DELAY,
      withSequence(
        withTiming(0.86, { duration: PRESS_DURATION, easing: Easing.out(Easing.quad) }),
        withDelay(HOLD, withTiming(1, { duration: RELEASE_DURATION, easing: Easing.elastic(1.1) })),
      ),
    );

    // Fire haptic + sound via plain setTimeout — no worklet needed
    const clickTimer = setTimeout(fireClick, PRESS_DELAY + PRESS_DURATION);

    // Rings: pulse in on press, ripple outward and fade on release
    RING_CONFIG.forEach(({ delay }, i) => {
      const { scale, opacity } = rings[i];
      scale.value = withDelay(
        PRESS_DELAY + delay,
        withSequence(
          withTiming(1.05, { duration: 260, easing: Easing.out(Easing.quad) }),
          withDelay(HOLD, withTiming(1.4, { duration: RIPPLE_DURATION, easing: Easing.out(Easing.cubic) })),
        ),
      );
      opacity.value = withDelay(
        PRESS_DELAY + delay,
        withSequence(
          withTiming(1, { duration: 160 }),
          withTiming(0.55, { duration: 200 }),
          withDelay(HOLD, withTiming(0, { duration: RIPPLE_DURATION })),
        ),
      );
    });

    const totalRunTime = PRESS_DELAY + PRESS_DURATION + HOLD + RIPPLE_DURATION;
    overlayOpacity.value = withDelay(
      totalRunTime - 200,
      withTiming(0, { duration: 580 }),
    );

    // Guaranteed dismiss via setTimeout — never stays stuck
    const dismissTimer = setTimeout(() => setVisible(false), totalRunTime + 400);

    return () => {
      clearTimeout(clickTimer);
      clearTimeout(dismissTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const btnStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnScale.value }] }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.backgroundSolidColor, overlayStyle]}>
      <View style={styles.ringWrap}>
        {RING_CONFIG.map((cfg, i) => (
          <Ring key={cfg.size} scale={rings[i].scale} opacity={rings[i].opacity} size={cfg.size} borderColor={cfg.color} />
        ))}
        <Animated.View style={[styles.btnCircle, btnStyle]}>
          <Text style={styles.btnLabel}>clq</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

export function AnimatedIcon() {
  return (
    <View style={styles.iconContainer}>
      <Image style={styles.glow} source={require('@/assets/images/logo-glow.png')} />
      <View style={styles.background} />
      <View style={styles.imageContainer}>
        <Image style={styles.image} source={require('@/assets/images/expo-logo.png')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    width: 201,
    height: 201,
    position: 'absolute',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
    zIndex: 100,
  },
  image: {
    position: 'absolute',
    width: 76,
    height: 71,
  },
  background: {
    borderRadius: 40,
    experimental_backgroundImage: `linear-gradient(180deg, #3C9FFE, #0274DF)`,
    width: 128,
    height: 128,
    position: 'absolute',
  },
  backgroundSolidColor: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  ringWrap: {
    width: 260,
    height: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1.5,
  },
  btnCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#6d28d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabel: {
    fontWeight: '900',
    fontSize: 28,
    color: '#fff',
    letterSpacing: -0.5,
  },
});
