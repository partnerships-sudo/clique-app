/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

/**
 * TrustMe brand identity. Light/dark variants live side by side here; use the
 * `useBrand()` / `useTypeColors()` hooks (src/hooks/use-brand.ts) to read the
 * one that matches the active system color scheme — never import these
 * objects directly in component styles.
 */
export const BrandLight = {
  ink: '#0E0E10',
  paper: '#F7F6F2',
  trust: '#5B4FE8',
  tlight: '#EAE8FF',
  warm: '#F4A340',
  muted: '#9E9E9E',
  border: '#E2E0DA',
  card: '#FFFFFF',
} as const;

export const BrandDark = {
  ink: '#F5F4F7',
  paper: '#121214',
  trust: '#8C82FF',
  tlight: '#2A2750',
  warm: '#FFB35C',
  muted: '#9A98A0',
  border: '#2C2B30',
  card: '#1C1C1F',
} as const;

export type BrandPalette = Record<keyof typeof BrandLight, string>;

export const TypeColorsLight = {
  watch: { color: '#E84F4F', bg: '#FFEDED', icon: '📺', label: 'Watching' },
  read: { color: '#4F9CE8', bg: '#EDF4FF', icon: '📖', label: 'Reading' },
  play: { color: '#4FE87B', bg: '#EDFFF3', icon: '🎮', label: 'Playing' },
  listen: { color: '#E8A84F', bg: '#FFF6ED', icon: '🎧', label: 'Listening' },
  podcast: { color: '#A855F7', bg: '#F5EEFF', icon: '🎙', label: 'Podcast' },
} as const;

export const TypeColorsDark = {
  watch: { color: '#FF6B6B', bg: '#3A2020', icon: '📺', label: 'Watching' },
  read: { color: '#6CB2FF', bg: '#1E2C3D', icon: '📖', label: 'Reading' },
  play: { color: '#5FFF96', bg: '#1A3324', icon: '🎮', label: 'Playing' },
  listen: { color: '#FFC069', bg: '#3A2A18', icon: '🎧', label: 'Listening' },
  podcast: { color: '#C084FC', bg: '#2E2140', icon: '🎙', label: 'Podcast' },
} as const;

export type TypeColorPalette = Record<
  keyof typeof TypeColorsLight,
  { color: string; bg: string; icon: string; label: string }
>;

export type EntryType = keyof typeof TypeColorsLight;

export const BrandFonts = {
  syneSemiBold: 'Satoshi-Bold',
  syneBold: 'Satoshi-Bold',
  syneExtraBold: 'Satoshi-Black',
  interLight: 'Satoshi-Light',
  interRegular: 'Satoshi-Regular',
  interMedium: 'Satoshi-Medium',
  poppinsMedium: 'Satoshi-Medium',
  poppinsExtraBold: 'Satoshi-Black',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
