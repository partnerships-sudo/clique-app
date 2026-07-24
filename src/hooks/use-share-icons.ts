import { useColorScheme } from '@/hooks/use-color-scheme';

const shareIcons = {
  light: {
    messages: require('@/assets/logos/messages_light.png'),
    mail:     require('@/assets/logos/mail_light.png'),
    airdrop:  require('@/assets/logos/airdrop_light.png'),
    whatsapp: require('@/assets/logos/whatsapp_App_Icon_Light_2026.png'),
  },
  dark: {
    messages: require('@/assets/logos/messages_dark.png'),
    mail:     require('@/assets/logos/mail_dark.png'),
    airdrop:  require('@/assets/logos/airdrop_dark.png'),
    whatsapp: require('@/assets/logos/whatsapp_App_Icon_Dark_2026.png'),
  },
} as const;

export type ShareIcons = typeof shareIcons.light;

export function useShareIcons(): ShareIcons {
  const scheme = useColorScheme();
  return scheme === 'dark' ? shareIcons.dark : shareIcons.light;
}
