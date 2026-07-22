import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useUnreadChatsCount } from '@/features/chats/api';
import { useUnreadCount } from '@/features/notifications/inbox';
import { useMyPresence } from '@/features/presence/api';
import { useBrand } from '@/hooks/use-brand';

export default function AppTabs() {
  const Brand = useBrand();
  const unreadChats = useUnreadChatsCount();
  const unreadNotifs = useUnreadCount();
  useMyPresence();

  return (
    <NativeTabs
      backgroundColor={Brand.paper}
      tintColor={Brand.trust}
      disableTransparentOnScrollEdge>

      <NativeTabs.Trigger name="index">
        <Label>Feed</Label>
        <Icon sf="house.fill" />
        <Badge hidden={unreadNotifs === 0}>{unreadNotifs > 0 ? String(unreadNotifs) : undefined}</Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chats">
        <Label>Chats</Label>
        <Icon sf="message.fill" />
        <Badge hidden={unreadChats.total === 0}>{unreadChats.total > 0 ? String(unreadChats.total) : undefined}</Badge>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="friends">
        <Label>Friends</Label>
        <Icon sf="person.2.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news">
        <Label>News</Label>
        <Icon sf="newspaper.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <Label>Profile</Label>
        <Icon sf="person.crop.circle.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
