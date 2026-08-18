import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { supabase } from './supabase';

/**
 * Where a user goes once a session exists.
 *
 * Both auth screens need this: the login screen creates accounts too, because
 * the Apple and Google buttons sign up first-time users. Routing straight to
 * the tabs from there used to skip onboarding entirely for anyone who tapped a
 * social button on the login tab instead of the signup tab.
 */
export async function routeAfterAuth(userId: string) {
  // A password-recovery deep link also produces a session. That user is on
  // their way to reset-password and must not be bounced into the app.
  if (isRecoveringPassword()) return;

  router.replace((await hasOnboarded(userId)) ? '/(tabs)' : '/onboarding');
}

/**
 * Completion lives on the profile so it survives a reinstall or a second
 * device. AsyncStorage is kept as a local cache so the common case doesn't wait
 * on a network round trip, and so a failed request doesn't re-onboard someone.
 */
async function hasOnboarded(userId: string): Promise<boolean> {
  const cached = await AsyncStorage.getItem(onboardingKey(userId)).catch(() => null);
  if (cached) return true;

  const { data, error } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle();

  // On error — network failure, or the onboarded_at migration not yet applied —
  // fall back to the previous local-flag-only behaviour. Returning true here
  // would silently skip onboarding for every new signup if the column is
  // missing, which is exactly the bug this change exists to fix.
  if (error) return false;

  if (data?.onboarded_at) {
    await AsyncStorage.setItem(onboardingKey(userId), 'done').catch(() => {});
    return true;
  }
  return false;
}

export function onboardingKey(userId: string) {
  return `clique:onboarding:${userId}`;
}

export async function markOnboardingDone(userId: string) {
  await AsyncStorage.setItem(onboardingKey(userId), 'done').catch(() => {});
  await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('id', userId);
}

// ── Password recovery ────────────────────────────────────────────────────────
//
// Module-level rather than React state: the deep link is handled in the root
// layout, but the flag has to be readable from the auth screens' session
// effects, which may run before any shared provider re-renders.

let recoveringPassword = false;

export function beginPasswordRecovery() {
  recoveringPassword = true;
}

export function endPasswordRecovery() {
  recoveringPassword = false;
}

export function isRecoveringPassword() {
  return recoveringPassword;
}
