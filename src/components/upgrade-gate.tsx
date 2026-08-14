import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandFonts, Spacing } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';

const TIER_COLORS: Record<number, string> = {
  1: '#A8B8C8', // Silver
  2: '#D4AF37', // Gold
};

const TIER_NAMES: Record<number, string> = {
  1: 'Silver',
  2: 'Gold',
};

type Props = {
  requiredTier: 1 | 2;
  title: string;
  description: string;
  /** If provided, renders children instead of the gate when tier is sufficient */
  children?: React.ReactNode;
  currentTier?: number;
};

export function UpgradeGate({ requiredTier, title, description, children, currentTier = 0 }: Props) {
  if (currentTier >= requiredTier) return <>{children}</>;

  const color = TIER_COLORS[requiredTier];
  const tierName = TIER_NAMES[requiredTier];

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: color + '18', borderColor: color + '40' }]}>
        <SymbolView name="checkmark.seal.fill" size={32} tintColor={color} type="monochrome" />
        <Text style={[styles.tierLabel, { color }]}>{tierName} feature</Text>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{description}</Text>

      <Pressable
        style={[styles.btn, { backgroundColor: color }]}
        onPress={() => { router.back(); router.push('/get-verified-modal'); }}>
        <Text style={styles.btnText}>Upgrade to {tierName}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    gap: 14,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
    marginBottom: 6,
  },
  tierLabel: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: '#111',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  desc: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 300,
  },
  btn: {
    marginTop: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
    color: '#fff',
    letterSpacing: 0.1,
  },
});
