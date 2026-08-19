import { useEffect, useState } from 'react';

import { addNetworkListener } from '@/lib/netinfo';

/**
 * Whether the device currently has no usable connection.
 *
 * `isConnected` alone is not enough: iOS reports a captive-portal wifi network
 * as connected long before it can reach anything. `isInternetReachable` is the
 * honest signal, but it starts as null while the first probe is in flight — so
 * treat null as online rather than flashing an offline banner on every launch.
 */
export function useIsOffline(): boolean {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return addNetworkListener((state) => {
      const reachable = state.isInternetReachable ?? true;
      setOffline(!state.isConnected || !reachable);
    });
  }, []);

  return offline;
}
