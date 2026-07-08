import { Badge, Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

import { useUnreadChatsCount } from '@/features/chats/api';
import { useBrand } from '@/hooks/use-brand';

export default function AppTabs() {
  const Brand = useBrand();
  const unreadChats = useUnreadChatsCount();

  return (
    <NativeTabs
      backgroundColor={Brand.paper}
      tintColor={Brand.trust}
      disableTransparentOnScrollEdge>

      <NativeTabs.Trigger name="index">
        <Label>Feed</Label>
        <Icon sf="house.fill" />
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

      <NativeTabs.Trigger name="library">
        <Label>Library</Label>
        <Icon sf="books.vertical.fill" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="news">
        <Label>News</Label>
        <Icon sf="newspaper.fill" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
