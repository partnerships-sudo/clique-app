import type { NetInfoState } from '@react-native-community/netinfo';

/**
 * NetInfo, but safe to import into a binary that was built before the native
 * module was added.
 *
 * `@react-native-community/netinfo` throws at import time when
 * `NativeModule.RNCNetInfo` is null, which is exactly what happens when Metro
 * pushes new JS to an older native build — the whole app red-screens on a
 * feature that is only meant to be an enhancement.
 *
 * When the native side is missing we report "online" and never emit again.
 * That is the pre-existing behaviour: React Query assumed permanent
 * connectivity before this module existed, so nothing regresses.
 */

type Listener = (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void;

let netInfo: typeof import('@react-native-community/netinfo').default | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  netInfo = require('@react-native-community/netinfo').default;
} catch {
  netInfo = null;
}

export const isNetInfoAvailable = netInfo != null;

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function, matching
 * NetInfo's own contract so callers do not need to care which path they got.
 */
export function addNetworkListener(listener: Listener): () => void {
  if (!netInfo) {
    // Report online once so anything gated on this does not sit in a
    // permanent "offline" state, then stay quiet.
    listener({ isConnected: true, isInternetReachable: true });
    return () => {};
  }

  return netInfo.addEventListener((state: NetInfoState) => {
    listener({
      isConnected: !!state.isConnected,
      isInternetReachable: state.isInternetReachable,
    });
  });
}
