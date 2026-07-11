import type { StyleProp, TextStyle } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export type RatingIconStyle = 'stars' | 'hotdogs' | 'popcorn';

export const RATING_ICON_OPTIONS: { value: RatingIconStyle; emoji: string; label: string }[] = [
  { value: 'stars', emoji: '⭐', label: 'Stars' },
  { value: 'hotdogs', emoji: '🌭', label: 'Hotdogs' },
  { value: 'popcorn', emoji: '🍿', label: 'Popcorn' },
];

const ICON_BY_STYLE: Record<RatingIconStyle, string> = {
  stars: '★',
  hotdogs: '🌭',
  popcorn: '🍿',
};

// ── Shared star-rendering helpers ─────────────────────────────────────────────

const STAR_EMPTY_COLOR = '#D0D0D0';

function FullStar({ size, color }: { size: number; color: string }) {
  return <Text style={{ fontSize: size, color, lineHeight: size * 1.2 }}>★</Text>;
}

function EmptyStar({ size }: { size: number }) {
  return <Text style={{ fontSize: size, color: STAR_EMPTY_COLOR, lineHeight: size * 1.2 }}>★</Text>;
}

// Renders the left-half of a filled star over an empty star — no native SVG
// needed, just an overflow clip on the fill layer.
function HalfStar({ size, color }: { size: number; color: string }) {
  return (
    <View style={{ width: size, height: size * 1.2 }}>
      <Text style={{ fontSize: size, color: STAR_EMPTY_COLOR, lineHeight: size * 1.2, position: 'absolute' }}>
        ★
      </Text>
      <View style={{ width: size * 0.5, overflow: 'hidden', position: 'absolute' }}>
        <Text style={{ fontSize: size, color, lineHeight: size * 1.2 }}>★</Text>
      </View>
    </View>
  );
}

function starStateAt(n: number, rating: number): 'full' | 'half' | 'empty' {
  if (n <= Math.floor(rating)) return 'full';
  if (n === Math.ceil(rating) && rating % 1 !== 0) return 'half';
  return 'empty';
}

// ── Display component ─────────────────────────────────────────────────────────

export function RatingIcons({
  rating,
  iconStyle,
  textStyle,
}: {
  rating: number;
  iconStyle: RatingIconStyle | null | undefined;
  textStyle?: StyleProp<TextStyle>;
}) {
  const style = iconStyle ?? 'stars';
  const flat = StyleSheet.flatten(textStyle) ?? {};
  const size: number = (flat.fontSize as number | undefined) ?? 13;
  const color: string = (flat.color as string | undefined) ?? '#F4A340';
  const outerLayout = { marginTop: flat.marginTop, marginBottom: flat.marginBottom };

  if (style === 'stars') {
    return (
      <View style={[displayStyles.row, outerLayout]}>
        {[1, 2, 3, 4, 5].map((n) => {
          const state = starStateAt(n, rating);
          return (
            <View key={n}>
              {state === 'full' ? (
                <FullStar size={size} color={color} />
              ) : state === 'half' ? (
                <HalfStar size={size} color={color} />
              ) : (
                <EmptyStar size={size} />
              )}
            </View>
          );
        })}
      </View>
    );
  }

  const icon = ICON_BY_STYLE[style];
  return (
    <View style={[displayStyles.row, outerLayout]}>
      {[1, 2, 3, 4, 5].map((n) => {
        const state = starStateAt(n, rating);
        const opacity = state === 'full' ? 1 : state === 'half' ? 0.55 : 0.25;
        return (
          <Text key={n} style={[flat, { opacity }]}>
            {icon}
          </Text>
        );
      })}
    </View>
  );
}

// ── Picker component ──────────────────────────────────────────────────────────

export function RatingPicker({
  value,
  iconStyle,
  onChange,
  size = 32,
}: {
  value: number;
  iconStyle: RatingIconStyle | null | undefined;
  onChange: (value: number) => void;
  size?: number;
}) {
  const style = iconStyle ?? 'stars';
  const icon = ICON_BY_STYLE[style];
  const slotSize = size + 20;
  const color = '#F4A340';

  function handlePress(n: number) {
    if (value === n) onChange(n - 0.5);        // full → half-step down
    else if (value === n - 0.5) onChange(0);   // half → clear
    else onChange(n);                           // anything else → fill to n
  }

  return (
    <View style={pickerStyles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => handlePress(n)}
          style={{ width: slotSize, height: slotSize, alignItems: 'center', justifyContent: 'center' }}>
          {style === 'stars' ? (
            (() => {
              const state = starStateAt(n, value);
              return state === 'full' ? (
                <FullStar size={size} color={color} />
              ) : state === 'half' ? (
                <HalfStar size={size} color={color} />
              ) : (
                <EmptyStar size={size} />
              );
            })()
          ) : (
            <Text style={{ fontSize: size, opacity: n <= value ? 1 : n - 0.5 === value ? 0.55 : 0.3 }}>
              {icon}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const displayStyles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 1 },
});

const pickerStyles = StyleSheet.create({
  row: { flexDirection: 'row' },
});
