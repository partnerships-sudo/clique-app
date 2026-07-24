import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';

interface Props {
  tier: number;
  size?: number;
}

export function VerifiedBadge({ tier, size = 14 }: Props) {
  if (tier < 1) return null;
  return (
    <View style={styles.wrap}>
      <SymbolView
        name="checkmark.seal.fill"
        size={size}
        tintColor="#1D9BF0"
        type="monochrome"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { justifyContent: 'center' },
});
