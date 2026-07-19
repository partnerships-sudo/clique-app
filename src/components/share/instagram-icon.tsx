import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

export function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44">
      <Defs>
        <LinearGradient id="igGrad" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0%" stopColor="#F9A825" />
          <Stop offset="30%" stopColor="#E1306C" />
          <Stop offset="60%" stopColor="#C13584" />
          <Stop offset="80%" stopColor="#833AB4" />
          <Stop offset="100%" stopColor="#5851DB" />
        </LinearGradient>
      </Defs>
      {/* Background rounded square */}
      <Rect x="0" y="0" width="44" height="44" rx="11" ry="11" fill="url(#igGrad)" />
      {/* Camera body */}
      <Rect x="9" y="9" width="26" height="26" rx="7" ry="7" fill="none" stroke="#fff" strokeWidth="2.8" />
      {/* Lens */}
      <Circle cx="22" cy="22" r="6" fill="none" stroke="#fff" strokeWidth="2.5" />
      {/* Dot top-right */}
      <Circle cx="31" cy="13" r="1.8" fill="#fff" />
    </Svg>
  );
}
