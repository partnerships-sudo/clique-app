import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

const EAS_PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID,
  });
  return token;
}

export async function syncPushToken(userId: string) {
  const token = await registerForPushNotificationsAsync();
  if (!token) return;

  await supabase.from('push_tokens').upsert({ user_id: userId, token }, { onConflict: 'user_id,token' });

  // Keeps the daily-nudge cron job (phase18) sending at 8pm in wherever this
  // device actually is, refreshed on every login/app-open in case the user
  // has traveled — cheap to re-send, and this never overwrites the other
  // notification_settings columns since they're omitted from the payload.
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      await supabase.from('notification_settings').upsert({ user_id: userId, timezone }, { onConflict: 'user_id' });
    }
  } catch {
    // Intl.DateTimeFormat should always be available in Hermes, but don't
    // let a timezone-sync hiccup block push token registration either way.
  }
}
