import { View } from 'react-native';

export function BookPageCurl({ size = 28 }: { size?: number }) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: size,
        height: size,
        borderBottomRightRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.15)',
      }}
      pointerEvents="none"
    />
  );
}
