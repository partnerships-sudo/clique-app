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

  if (style === 'stars') {
    return (
      <Text style={textStyle}>
        {'★'.repeat(rating)}
        {'☆'.repeat(5 - rating)}
      </Text>
    );
  }

  const icon = ICON_BY_STYLE[style];
  // Each icon is its own Text in a View row — opacity on nested Text inside
  // another Text is silently ignored on iOS, so we must use sibling Views.
  return (
    <View style={displayStyles.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={[textStyle, { opacity: i < rating ? 1 : 0.25 }]}>
          {icon}
        </Text>
      ))}
    </View>
  );
}

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

  return (
    <View style={pickerStyles.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => onChange(n === value ? 0 : n)}
          style={{ width: slotSize, height: slotSize, alignItems: 'center', justifyContent: 'center' }}>
          {style === 'stars' ? (
            <Text style={{ fontSize: size, color: '#F4A340' }}>{n <= value ? '★' : '☆'}</Text>
          ) : (
            <Text style={{ fontSize: size, opacity: n <= value ? 1 : 0.3 }}>{icon}</Text>
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
