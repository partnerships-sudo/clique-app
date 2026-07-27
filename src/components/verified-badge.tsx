import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

interface Props {
  tier: number;
  size?: number;
}

const TIER_COLOR: Record<number, string> = {
  1: '#5B8DEF',
  2: '#8B5CF6',
  3: '#D4AF37',
};

export function VerifiedBadge({ tier, size = 14 }: Props) {
  if (tier < 1) return null;
  const color = TIER_COLOR[tier] ?? '#5B8DEF';
  return (
    <View style={styles.wrap}>
      <SymbolView
        name="checkmark.seal.fill"
        size={size}
        tintColor={color}
        type="monochrome"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
});
