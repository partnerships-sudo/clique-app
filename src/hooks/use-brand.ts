import {
  BrandDark,
  BrandLight,
  TypeColorsDark,
  TypeColorsLight,
  type BrandPalette,
  type TypeColorPalette,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useBrand(): BrandPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? BrandDark : BrandLight;
}

export function useTypeColors(): TypeColorPalette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? TypeColorsDark : TypeColorsLight;
}
