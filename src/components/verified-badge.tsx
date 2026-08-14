import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

interface Props {
  tier: number;
  size?: number;
}

const TIER_COLOR: Record<number, string> = {
  1: '#A8B8C8', // Silver
  2: '#D4AF37', // Gold
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
