import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AuthLayout() {
  const scheme = useColorScheme();
  // ink is #0E0E10 in light, #F5F4F7 in dark (near-white!) — use paper instead
  // paper is #F7F6F2 in light, #121214 in dark — correct for each mode
  const bg = scheme === 'dark' ? '#121214' : '#F7F6F2';
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: bg },
      }}
    />
  );
}
