import NetInfo from '@react-native-community/netinfo';
import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryClient, onlineManager } from '@tanstack/react-query';
import { Alert } from 'react-native';

/**
 * Teach React Query what "online" means on a device.
 *
 * Without this it assumes the browser default — permanently online — so every
 * query fired while offline runs, fails, burns its retries and lands in an
 * error state. With it, queries pause while offline and resume on reconnect,
 * which also means the error states we show are genuine server errors rather
 * than "your train went into a tunnel".
 */
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected && (state.isInternetReachable ?? true));
  }),
);

/**
 * Turns a thrown value into something worth showing a person.
 *
 * Supabase/network failures surface as opaque strings ("Failed to fetch",
 * "Network request failed"), which tell the user nothing actionable, so those
 * are replaced with a connection message.
 */
function toUserMessage(error: unknown): string {
  const raw =
    error instanceof Error ? error.message : typeof error === 'string' ? error : '';

  if (/network request failed|failed to fetch|timeout|timed out|offline/i.test(raw)) {
    return 'Check your connection and try again.';
  }
  return raw && raw.length < 160 ? raw : 'Something went wrong. Please try again.';
}

/**
 * Every mutation reports failures here.
 *
 * Without this, a failed mutation was silent: react-query captures the error
 * internally, so a `.mutate()` whose caller never reads `isError` looked to the
 * user like the button simply did nothing — the common failure mode when the
 * network is slow or offline.
 *
 * This runs *in addition to* a mutation's own `onError` (that is how the
 * MutationCache works in react-query v5), not instead of it, so the existing
 * optimistic-update rollbacks still run and the user also gets told.
 *
 * Opt out for a mutation whose failure is genuinely not worth interrupting
 * someone for by setting `meta: { silentError: true }` on it.
 */
const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    Sentry.captureException(error);
    if (mutation.meta?.silentError) return;
    Alert.alert('Something went wrong', toUserMessage(error));
  },
});

export const queryClient = new QueryClient({
  mutationCache,
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60_000,  // 5 minutes — prevents refetch every time you switch apps
      refetchOnWindowFocus: false,
    },
    mutations: {
      // Writes are not retried automatically: many are not idempotent (posting,
      // following, sending a message) and a silent retry could duplicate them.
      retry: 0,
    },
  },
});
