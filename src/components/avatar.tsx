import { Image, StyleSheet, Text, View } from 'react-native';

import { BrandFonts } from '@/constants/theme';

const PALETTE = [
  '#E8748A',
  '#5B4FE8',
  '#2E86AB',
  '#2D6A2D',
  '#E67E22',
  '#7D3C98',
  '#1A5276',
  '#1E8449',
  '#C0392B',
  '#D4A017',
];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

function initialsForName(name: string) {
  return name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function Avatar({
  name,
  size = 38,
  avatarUrl,
  ring,
}: {
  name: string;
  size?: number;
  avatarUrl?: string | null;
  ring?: string;
}) {
  const safeName = name || '?';

  const inner = avatarUrl ? (
    <Image
      source={{ uri: avatarUrl }}
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colorForName(safeName),
        },
      ]}>
      <Text style={[styles.initials, { fontSize: size / 2.6 }]}>{initialsForName(safeName)}</Text>
    </View>
  );

  if (ring) {
    return (
      <View
        style={{
          padding: 2,
          borderRadius: (size + 8) / 2,
          borderWidth: 2,
          borderColor: ring,
        }}>
        {inner}
      </View>
    );
  }

  return inner;
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontFamily: BrandFonts.syneBold,
  },
});
