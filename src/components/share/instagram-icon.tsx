import { View } from 'react-native';

export function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: '#C837AB',
      }}
    />
  );
}
