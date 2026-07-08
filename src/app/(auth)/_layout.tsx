import { Stack } from 'expo-router';

import { useBrand } from '@/hooks/use-brand';

export default function AuthLayout() {
  const Brand = useBrand();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Brand.ink },
      }}
    />
  );
}
