import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { EntryType } from '@/constants/theme';

const STORAGE_KEY = 'clique_hidden_feed_categories';

const ALL_FEED_TYPES: EntryType[] = ['watch', 'read', 'play', 'listen', 'podcast'];

// 'tv' from onboarding maps to the 'watch' EntryType (Movies + TV are combined).
function toEntryTypes(contentTypes: string[]): EntryType[] {
  const mapped = contentTypes.map((t) => (t === 'tv' ? 'watch' : t) as EntryType);
  return [...new Set(mapped)].filter((t) => ALL_FEED_TYPES.includes(t));
}

/**
 * Which content types the user has long-press-removed from the feed's filter
 * row. On first load, seeds from the profile's onboarding picks (types NOT
 * chosen are hidden by default). After that, the user controls it locally.
 */
export function useHiddenCategories(profileContentTypes?: string[]) {
  const [hidden, setHidden] = useState<Set<EntryType>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          setHidden(new Set(JSON.parse(raw) as EntryType[]));
        } else if (profileContentTypes && profileContentTypes.length > 0) {
          // First launch: hide types the user didn't pick during onboarding.
          const preferred = new Set(toEntryTypes(profileContentTypes));
          const initial = new Set(ALL_FEED_TYPES.filter((t) => !preferred.has(t)));
          setHidden(initial);
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...initial])).catch(() => {});
        }
      })
      .finally(() => setLoaded(true));
  // Run once on mount — profileContentTypes is only used for the initial seed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hideCategory = useCallback((type: EntryType) => {
    setHidden((prev) => {
      if (prev.has(type)) return prev;
      const next = new Set(prev).add(type);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  const showCategory = useCallback((type: EntryType) => {
    setHidden((prev) => {
      if (!prev.has(type)) return prev;
      const next = new Set(prev);
      next.delete(type);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);

  return { loaded, hidden, hideCategory, showCategory };
}
