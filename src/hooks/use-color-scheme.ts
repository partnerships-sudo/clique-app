import { useAppearance } from '@/providers/appearance-provider';

export function useColorScheme(): 'light' | 'dark' {
  return useAppearance().scheme;
}
