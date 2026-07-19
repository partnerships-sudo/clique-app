import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { useBadges } from '@/features/badges/api';
import { BADGE_CATALOG } from '@/features/badges/catalog';

const catalogMap = new Map(BADGE_CATALOG.map((b) => [b.key, b]));

export function useBadgeNotifier() {
  const { newlyEarned, syncNewlyEarned } = useBadges();
  const syncRef = useRef(syncNewlyEarned);
  syncRef.current = syncNewlyEarned;

  useEffect(() => {
    if (!newlyEarned.length) return;

    // Persist to DB
    syncRef.current();

    // Fire a local notification per badge, staggered slightly so they don't stack instantly
    newlyEarned.forEach((key, i) => {
      const badge = catalogMap.get(key);
      if (!badge) return;
      Notifications.scheduleNotificationAsync({
        content: {
          title: `${badge.icon} Badge Unlocked: ${badge.name}`,
          body: badge.flavor,
          data: { type: 'badge', badgeKey: key },
        },
        trigger: i === 0 ? null : { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: i * 2 },
      });
    });
  }, [newlyEarned.join(',')]);
}
