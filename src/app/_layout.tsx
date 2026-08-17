import 'react-native-url-polyfill/auto';

import * as Sentry from '@sentry/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StripeProvider } from '@stripe/stripe-react-native';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { router, Stack, type ErrorBoundaryProps } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
// Do NOT call SplashScreen.preventAutoHideAsync() here.
// Expo Router calls _internal_preventAutoHideAsync on startup and
// _internal_maybeHideAsync when navigation is ready — interfering with that
// by setting userControlledAutoHideEnabled=true breaks the auto-hide chain.

import { BrandFonts, BrandLight } from '@/constants/theme';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
// import { configureRevenueCat } from '@/features/purchases/api'; // RevenueCat disabled
import { AppearanceProvider, useAppearance } from '@/providers/appearance-provider';

// Initialise Sentry as early as possible so it captures startup crashes.
// Add your DSN to .env as EXPO_PUBLIC_SENTRY_DSN — get it from:
// sentry.io → your project → Settings → Client Keys (DSN)
if (process.env.EXPO_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Capture 20% of traces in production; 100% is fine for early launch
    // while you're still finding issues.
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    // Attach user context (set after login — see SessionProvider)
    sendDefaultPii: false,
    // Release health — automatic session tracking
    enableAutoSessionTracking: true,
    // Don't spam Sentry while you're developing locally
    enabled: !__DEV__,
  });
}
import { SessionProvider } from '@/providers/session-provider';
import { ShakespearProvider } from '@/providers/shakespear-provider';

function RootNavigator() {
  const { scheme } = useAppearance();
  // Paper background adapts to the current colour scheme so form sheets
  // don't flash a hardcoded light colour in dark mode.
  const paper = scheme === 'dark' ? '#0F0E11' : '#F7F6F2';
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="profile" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="push-notifications-settings" options={{ headerShown: false }} />
      <Stack.Screen name="collection-sharing-settings" options={{ headerShown: false }} />
      <Stack.Screen name="blocked-muted-accounts" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-settings" options={{ headerShown: false }} />
      <Stack.Screen name="close-friends-settings" options={{ headerShown: false }} />
      <Stack.Screen name="log-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="edit-post-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.72], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="chat-modal" options={{ headerShown: false }} />
      <Stack.Screen name="where-to-find-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="artist-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="news-article-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="content-detail-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="recommend-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.72], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="post-share-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="list-share-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="list-comments-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="friend-profile-modal" options={{ headerShown: false }} />
      <Stack.Screen name="taste-detail-modal" options={{ headerShown: false }} />
      <Stack.Screen name="rate-modal" options={{ headerShown: false }} />
      <Stack.Screen name="new-chat-modal" options={{ headerShown: false }} />
      <Stack.Screen name="new-group-modal" options={{ headerShown: false }} />
      <Stack.Screen name="group-info-modal" options={{ headerShown: false }} />
      <Stack.Screen name="add-group-members-modal" options={{ headerShown: false }} />
      <Stack.Screen name="collection-add-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="collection-scan-modal" options={{ headerShown: false }} />
      <Stack.Screen name="friend-collection-modal" options={{ headerShown: false }} />
      <Stack.Screen name="share-card-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="achievements-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="discover-people-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.95], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="stories-modal" options={{ headerShown: false }} />
      <Stack.Screen name="notifications-modal" options={{ headerShown: false }} />
      <Stack.Screen name="party-detail-modal" options={{ headerShown: false }} />
      <Stack.Screen name="archived-chats-modal" options={{ headerShown: false }} />
      <Stack.Screen name="post-reactions-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="post-comments-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="news-share-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.85], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="account-info" options={{ headerShown: false }} />
      <Stack.Screen name="privacy-policy" options={{ headerShown: false }} />
      <Stack.Screen name="episode-progress-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.45], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="book-progress-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.5], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="premiere-modal" options={{ headerShown: false }} />
      <Stack.Screen name="premiere-waiting-room" options={{ headerShown: false }} />
      <Stack.Screen name="premiere-live" options={{ headerShown: false }} />
      <Stack.Screen name="profile-stats-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="yearly-wrapped-modal" options={{ headerShown: false }} />
      <Stack.Screen name="rate-watchlist-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="collection-item-detail-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.72], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="export-library-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.55], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="import-library-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.42, 0.75], sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: paper } }} />
      <Stack.Screen name="get-verified-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.9, 1.0], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="create-list-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.6], sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: paper } }} />
      <Stack.Screen name="create-discussion-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [1.0], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="discussion-detail-modal" options={{ headerShown: false }} />
      <Stack.Screen name="content-room-modal" options={{ headerShown: false }} />
      <Stack.Screen name="pick-for-list-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.92], sheetGrabberVisible: true, headerShown: false }} />
      <Stack.Screen name="list-detail-modal" options={{ headerShown: false, contentStyle: { backgroundColor: paper } }} />
      <Stack.Screen name="add-to-list-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.75], sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: paper } }} />
      <Stack.Screen name="create-screening-room-modal" options={{ presentation: 'formSheet', sheetAllowedDetents: [0.85], sheetGrabberVisible: true, headerShown: false, contentStyle: { backgroundColor: paper } }} />
      <Stack.Screen name="screening-room-analytics-modal" options={{ headerShown: false }} />
      <Stack.Screen name="watch-party-analytics-modal" options={{ headerShown: false }} />
      <Stack.Screen name="trivia-setup-modal" options={{ headerShown: false }} />
      <Stack.Screen name="screening-room-live" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="premiere-replay" options={{ headerShown: false }} />
      <Stack.Screen name="saved-discussions-modal" options={{ headerShown: false }} />
    </Stack>
  );
}

function RootLayoutInner() {
  const { scheme: colorScheme } = useAppearance();
  const [fontsLoaded] = useFonts({
    'Satoshi-Light': require('../assets/fonts/Satoshi-Light.otf'),
    'Satoshi-Regular': require('../assets/fonts/Satoshi-Regular.otf'),
    'Satoshi-Medium': require('../assets/fonts/Satoshi-Medium.otf'),
    'Satoshi-Bold': require('../assets/fonts/Satoshi-Bold.otf'),
    'Satoshi-Black': require('../assets/fonts/Satoshi-Black.otf'),
  });
  // RevenueCat disabled — re-enable when products are configured in App Store Connect
  // useEffect(() => {
  //   supabase.auth.getSession().then(({ data: { session } }) => {
  //     configureRevenueCat(session?.user?.id);
  //   });
  //   const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
  //     configureRevenueCat(session?.user?.id);
  //   });
  //   return () => subscription.unsubscribe();
  // }, []);


  // Defer notification navigation until the router is ready (avoids cold-start crash)
  const pendingNotification = useRef<Parameters<Parameters<typeof Notifications.addNotificationResponseReceivedListener>[0]>[0] | null>(null);
  const routerReady = useRef(false);

  async function handleNotificationResponse(response: Parameters<Parameters<typeof Notifications.addNotificationResponseReceivedListener>[0]>[0]) {
    // Deduplicate: skip notifications we've already navigated to (prevents
    // re-firing on cold start after an app update)
    const id = response.notification.request.identifier;
    try {
      const raw = await AsyncStorage.getItem('handled_notif_ids');
      const handled: string[] = raw ? JSON.parse(raw) : [];
      if (handled.includes(id)) return;
      const updated = [...handled, id].slice(-100);
      await AsyncStorage.setItem('handled_notif_ids', JSON.stringify(updated));
    } catch { /* storage failure — still process the notification */ }

    const data = response.notification.request.content.data;
    if (data?.type === 'watch_party_invite') {
      router.push({ pathname: '/(tabs)/friends', params: { tab: 'attending' } });
    } else if (data?.type === 'badge') {
      router.push('/achievements-modal');
    } else if (data?.type === 'dm' && data?.friendId) {
      let friendName = (data.friendName as string | undefined) ?? '';
      let friendAvatar = (data.friendAvatar as string | undefined) ?? '';
      if (!friendName) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, avatar_url')
          .eq('id', data.friendId as string)
          .single();
        friendName = profile?.full_name ?? profile?.username ?? 'Unknown';
        friendAvatar = profile?.avatar_url ?? '';
      }
      router.push({ pathname: '/chat-modal', params: { friendId: data.friendId as string, friendName, friendAvatar } });
    } else if (data?.type === 'rating_reminder' && data?.postId) {
      const { data: post } = await supabase
        .from('posts')
        .select('title, type, poster')
        .eq('id', data.postId as string)
        .single();
      if (post) {
        router.push({ pathname: '/log-modal', params: { intent: 'log', prefillTitle: post.title, prefillType: post.type, prefillPoster: post.poster ?? '' } });
      } else {
        router.push('/notifications-modal');
      }
    }
  }

  useEffect(() => {
    // Mark router as ready and flush any notification that arrived before mount
    routerReady.current = true;
    if (pendingNotification.current) {
      handleNotificationResponse(pendingNotification.current);
      pendingNotification.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      if (!routerReady.current) {
        // Cold start — defer until layout is mounted
        pendingNotification.current = response;
        return;
      }
      handleNotificationResponse(response);
    });
    return () => sub.remove();
  }, []);

  function handleDeepLink(url: string) {
    // Password reset: thecliqueapp://reset-password#access_token=...
    if (url.includes('reset-password')) {
      router.push('/reset-password');
      return;
    }
    // Matches both:
    //   thecliqueapp://premiere/{id}
    //   https://vaultedmediagroup.com/premiere/{id}
    const match = url.match(/\/premiere\/([a-zA-Z0-9_-]+)/);
    if (match) {
      const premiereId = match[1];
      router.push({ pathname: '/premiere-waiting-room', params: { id: premiereId } });
    }
  }

  useEffect(() => {
    // Cold start: app opened via a link
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    // Foreground: link opened while app is running
    const sub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url));
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY!}
        urlScheme="thecliqueapp">
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <QueryClientProvider client={queryClient}>
            <SessionProvider>
              <ShakespearProvider>
                <RootNavigator />
              </ShakespearProvider>
            </SessionProvider>
          </QueryClientProvider>
        </ThemeProvider>
        {/* AnimatedSplash disabled */}
      </StripeProvider>
    </GestureHandlerRootView>
  );
}

function RootLayout() {
  return (
    <AppearanceProvider>
      <RootLayoutInner />
    </AppearanceProvider>
  );
}

/**
 * App-wide crash screen. Expo Router renders this instead of unmounting the
 * whole tree when a render throws, so a bug in one screen no longer takes the
 * app down to a blank screen with no way back.
 *
 * `retry()` remounts the failed segment, which recovers from transient errors
 * (a malformed API response, a missing field) without an app restart.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <View style={errorStyles.container}>
      <Text style={errorStyles.emoji}>🫠</Text>
      <Text style={errorStyles.title}>This screen hit a snag</Text>
      <Text style={errorStyles.body}>
        Something went wrong rendering this page. It's been reported — try again below.
      </Text>
      {__DEV__ ? <Text style={errorStyles.detail}>{error.message}</Text> : null}
      <Pressable
        style={errorStyles.retryBtn}
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Try loading this screen again">
        <Text style={errorStyles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
    backgroundColor: BrandLight.paper,
  },
  emoji: { fontSize: 44 },
  title: {
    fontFamily: BrandFonts.syneExtraBold,
    fontSize: 20,
    color: BrandLight.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: BrandLight.muted,
    textAlign: 'center',
  },
  detail: {
    fontFamily: BrandFonts.interRegular,
    fontSize: 11,
    color: BrandLight.muted,
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: BrandLight.trust,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 28,
  },
  retryText: {
    fontFamily: BrandFonts.syneBold,
    fontSize: 15,
    color: '#fff',
  },
});

export default Sentry.wrap(RootLayout);
