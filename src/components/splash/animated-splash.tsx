import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';

import { BrandFonts } from '@/constants/theme';

const NATIVE_SPLASH_BG = '#208AEF';
const DOT_COLOR = '#5B4FE8';

const LAYER_ENTER_DURATION = 550;
const LAYER_STAGGER = 220;
const WORD_DELAY = 900;
const WORD_DURATION = 380;
const DOT_DELAY = 1080;
const DOT_DURATION = 420;
const HOLD_UNTIL = 2250;
const FADE_OUT_DURATION = 380;
const TOTAL_DURATION = HOLD_UNTIL + FADE_OUT_DURATION;

const DIAMOND_POINTS = '90,0 180,32 90,64 0,32';
const LAYER_VERTICAL_STEP = 34;

type LayerConfig = {
  id: string;
  from: { x: number; y: number };
  rotateFrom: number;
  gradientFrom: string;
  gradientTo: string;
  stroke: string;
};

const LAYERS: LayerConfig[] = [
  {
    id: 'bottom',
    from: { x: 0, y: 130 },
    rotateFrom: 10,
    gradientFrom: '#E88A47',
    gradientTo: '#F0B27C',
    stroke: '#B05A1B',
  },
  {
    id: 'middle',
    from: { x: -150, y: 0 },
    rotateFrom: -12,
    gradientFrom: '#845BD6',
    gradientTo: '#D787BD',
    stroke: '#6E3C8C',
  },
  {
    id: 'top',
    from: { x: 0, y: -130 },
    rotateFrom: -10,
    gradientFrom: '#5544DE',
    gradientTo: '#7465E9',
    stroke: '#3D2FAE',
  },
];

function LogoLayer({ config, index }: { config: LayerConfig; index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * LAYER_STAGGER,
      withSpring(1, { damping: 11, stiffness: 120, mass: 0.7 })
    );
  }, [progress, index]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateX: (1 - progress.value) * config.from.x },
      { translateY: (1 - progress.value) * config.from.y },
      { rotate: `${(1 - progress.value) * config.rotateFrom}deg` },
    ],
  }));

  const stackedTop = (LAYERS.length - 1 - index) * LAYER_VERTICAL_STEP;

  return (
    <Animated.View style={[styles.layer, { top: stackedTop }, style]}>
      <Svg width={180} height={64} viewBox="0 0 180 64">
        <Defs>
          <LinearGradient id={`grad-${config.id}`} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={config.gradientFrom} />
            <Stop offset="1" stopColor={config.gradientTo} />
          </LinearGradient>
        </Defs>
        <Polygon
          points={DIAMOND_POINTS}
          fill={`url(#grad-${config.id})`}
          stroke={config.stroke}
          strokeWidth={3}
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
}

export function AnimatedSplash({ onFinish }: { onFinish: () => void }) {
  const player = useAudioPlayer(require('../../assets/sounds/splash-projector-reel.mp3'));
  const containerOpacity = useSharedValue(1);
  const wordOpacity = useSharedValue(0);
  const wordTranslateY = useSharedValue(10);
  const dotScale = useSharedValue(0);
  const dotTranslateY = useSharedValue(-36);

  useEffect(() => {
    player.play();

    wordOpacity.value = withDelay(WORD_DELAY, withTiming(1, { duration: WORD_DURATION, easing: Easing.out(Easing.cubic) }));
    wordTranslateY.value = withDelay(WORD_DELAY, withTiming(0, { duration: WORD_DURATION, easing: Easing.out(Easing.cubic) }));

    dotTranslateY.value = withDelay(DOT_DELAY, withSpring(0, { damping: 8, stiffness: 200, mass: 0.6 }));
    dotScale.value = withDelay(DOT_DELAY, withSpring(1, { damping: 8, stiffness: 200, mass: 0.6 }));

    containerOpacity.value = withSequence(
      withDelay(HOLD_UNTIL, withTiming(1, { duration: 0 })),
      withTiming(0, { duration: FADE_OUT_DURATION, easing: Easing.in(Easing.cubic) })
    );

    const timeout = setTimeout(() => {
      player.pause();
      runOnJS(onFinish)();
    }, TOTAL_DURATION);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const containerStyle = useAnimatedStyle(() => ({ opacity: containerOpacity.value }));
  const wordStyle = useAnimatedStyle(() => ({
    opacity: wordOpacity.value,
    transform: [{ translateY: wordTranslateY.value }],
  }));
  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dotTranslateY.value }, { scale: dotScale.value }],
  }));

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.stack}>
        {LAYERS.map((layer, index) => (
          <LogoLayer key={layer.id} config={layer} index={index} />
        ))}
      </View>
      <Animated.View style={[styles.wordRow, wordStyle]}>
        <Text style={styles.wordText}>cl</Text>
        <View style={styles.iWrap}>
          <Animated.View style={[styles.dot, dotStyle]} />
          <Text style={styles.wordText}>{'ı'}</Text>
        </View>
        <Text style={styles.wordText}>que</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: NATIVE_SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  stack: {
    width: 180,
    height: 64 + 2 * 34,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  layer: {
    position: 'absolute',
  },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 28,
  },
  wordText: {
    fontFamily: BrandFonts.interMedium,
    fontSize: 40,
    color: '#FFFFFF',
    letterSpacing: -0.8,
    lineHeight: 48,
  },
  iWrap: { position: 'relative', alignItems: 'center' },
  dot: {
    position: 'absolute',
    top: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DOT_COLOR,
  },
});
