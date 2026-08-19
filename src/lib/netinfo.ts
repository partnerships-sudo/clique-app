import { TurboModuleRegistry } from 'react-native';

/**
 * NetInfo, but safe to load into a binary built before the native module
 * existed.
 *
 * `@react-native-community/netinfo` throws at module scope when its native
 * module is absent. Wrapping the `require` in try/catch is NOT enough: Metro's
 * `guardedLoadModule` reports a module-load failure as a fatal error before the
 * exception reaches the catch, so the app still red-screens.
 *
 * So the native module is probed first, and the package is only required when
 * it is actually there. `TurboModuleRegistry.get` returns null rather than
 * throwing when a module is missing (unlike `getEnforcing`), and works under
 * both bridgeless and the old bridge.
 *
 * With no native module we report "online" once and stay quiet — the behaviour
 * that existed before NetInfo was added, so nothing regresses on an old build.
 */

type Listener = (state: { isConnected: boolean; isInternetReachable: boolean | null }) => void;

function loadNetInfo() {
  // Probing costs nothing and cannot throw.
  if (TurboModuleRegistry.get('RNCNetInfo') == null) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@react-native-community/netinfo').default;
  } catch {
    return null;
  }
}

const netInfo = loadNetInfo();

export const isNetInfoAvailable = netInfo != null;

/**
 * Subscribe to connectivity changes. Returns an unsubscribe function, matching
 * NetInfo's own contract so callers need not know which path they got.
 */
export function addNetworkListener(listener: Listener): () => void {
  if (!netInfo) {
    listener({ isConnected: true, isInternetReachable: true });
    return () => {};
  }

  return netInfo.addEventListener((state: any) => {
    listener({
      isConnected: !!state.isConnected,
      isInternetReachable: state.isInternetReachable,
    });
  });
}
