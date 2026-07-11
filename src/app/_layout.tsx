import 'react-native-url-polyfill/auto';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, type AppStateStatus, Platform, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

SplashScreen.preventAutoHideAsync();

import { AnimatedSplash } from '@/components/splash/animated-splash';
import { type BrandPalette } from '@/constants/theme';
import { useBrand } from '@/hooks/use-brand';
import { useSession } from '@/hooks/use-session';
import { queryClient } from '@/lib/query-client';
import { SessionProvider } from '@/providers/session-provider';

function RootNavigator() {
  const { session, isLoading } = useSession();
  const Brand = useBrand();

  if (isLoading) {
    return (
      <View style={loadingStyle(Brand)}>
        <ActivityIndicator color={Brand.trust} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="profile" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="push-notifications-settings" options={{ headerShown: false }} />
        <Stack.Screen name="collection-sharing-settings" options={{ headerShown: false }} />
        <Stack.Screen name="blocked-muted-accounts" options={{ headerShown: false }} />
        <Stack.Screen name="close-friends-settings" options={{ headerShown: false }} />
        <Stack.Screen
          name="log-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen name="chat-modal" options={{ headerShown: false }} />
        <Stack.Screen
          name="where-to-find-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="artist-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="news-article-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="content-detail-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="recommend-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.72],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen name="friend-profile-modal" options={{ headerShown: false }} />
        <Stack.Screen name="rate-modal" options={{ headerShown: false }} />
        <Stack.Screen name="new-chat-modal" options={{ headerShown: false }} />
        <Stack.Screen name="new-group-modal" options={{ headerShown: false }} />
        <Stack.Screen name="group-info-modal" options={{ headerShown: false }} />
        <Stack.Screen name="add-group-members-modal" options={{ headerShown: false }} />
        <Stack.Screen
          name="trending-users-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.55],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="collection-add-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.9],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen name="collection-scan-modal" options={{ headerShown: false }} />
        <Stack.Screen name="friend-collection-modal" options={{ headerShown: false }} />
        <Stack.Screen
          name="share-card-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="achievements-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="discover-people-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.95],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="profile-stats-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.92],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="collection-item-detail-modal"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.72],
            sheetGrabberVisible: true,
            headerShown: false,
          }}
        />
      </Stack.Protected>
    </Stack>
  );
}

function loadingStyle(Brand: BrandPalette) {
  return {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Brand.paper,
  };
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [introDone, setIntroDone] = useState(false);
  const [fontsLoaded] = useFonts({
    'Satoshi-Light': require('../assets/fonts/Satoshi-Light.otf'),
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.otf'),
    'Satoshi-Black': require('../assets/fonts/Satoshi-Black.otf'),
  });

  // Wait for the custom fonts (Satoshi weights, incl. the "clique" wordmark's
  // Black weight) to finish loading before hiding the splash screen —
  // otherwise the app can render one frame in the system fallback font,
  // which is a different width than Satoshi and clips/looks thinner until
  // the real font swaps in.
  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    function onAppStateChange(status: AppStateStatus) {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    }
    const subscription = AppState.addEventListener('change', onAppStateChange);
    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <SessionProvider>
            <RootNavigator />
          </SessionProvider>
        </QueryClientProvider>
      </ThemeProvider>
      {!introDone ? <AnimatedSplash onFinish={() => setIntroDone(true)} /> : null}
    </GestureHandlerRootView>
  );
}
