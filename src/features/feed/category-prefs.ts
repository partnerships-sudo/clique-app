import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import type { EntryType } from '@/constants/theme';

const STORAGE_KEY = 'clique_hidden_feed_categories';

/**
 * Which content types the user has long-press-removed from the feed's filter
 * row. Persisted locally (not per-account server state) — this is a personal
 * "I don't care about this type" preference, not something to sync/share.
 */
export function useHiddenCategories() {
  const [hidden, setHidden] = useState<Set<EntryType>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setHidden(new Set(JSON.parse(raw) as EntryType[]));
      })
      .finally(() => setLoaded(true));
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
