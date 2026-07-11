import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** The classic Instagram glyph (rounded-square camera + lens + flash dot), redrawn as a
 * vector so it renders crisply at any size without bundling a raster asset. */
export function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="igGradient" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FFDD55" />
          <Stop offset="25%" stopColor="#FF543E" />
          <Stop offset="55%" stopColor="#C837AB" />
          <Stop offset="100%" stopColor="#5851DB" />
        </LinearGradient>
      </Defs>
      <Rect x="2" y="2" width="44" height="44" rx="12" fill="url(#igGradient)" />
      <Rect
        x="12"
        y="12"
        width="24"
        height="24"
        rx="7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
      />
      <Path
        d="M24 17.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
      />
      <Path d="M32 14a1.7 1.7 0 1 0 0 3.4 1.7 1.7 0 0 0 0-3.4z" fill="#fff" />
    </Svg>
  );
}
