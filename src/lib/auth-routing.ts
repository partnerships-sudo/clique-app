import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

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

  const done = await AsyncStorage.getItem(onboardingKey(userId));
  router.replace(done ? '/(tabs)' : '/onboarding');
}

export function onboardingKey(userId: string) {
  return `clique:onboarding:${userId}`;
}

export async function markOnboardingDone(userId: string) {
  await AsyncStorage.setItem(onboardingKey(userId), 'done');
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
