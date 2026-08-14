import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/hooks/use-session';
import { useBrand } from '@/hooks/use-brand';

export default function Index() {
  const { session, isLoading } = useSession();
  const Brand = useBrand();

  if (isLoading) {
    // Blank paper-coloured view — no spinner, no blue flash.
    return <View style={{ flex: 1, backgroundColor: Brand.paper }} />;
  }

  return <Redirect href={session ? '/(tabs)' : '/(auth)'} />;
}
