import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const seenIds = new Set<string>();
let listener: (() => void) | null = null;

// Load persisted IDs once on startup
AsyncStorage.getItem('seen_story_ids')
  .then((raw) => { if (raw) (JSON.parse(raw) as string[]).forEach((id) => seenIds.add(id)); })
  .catch(() => {});

export function markStorySeen(id: string) {
  if (seenIds.has(id)) return;
  seenIds.add(id);
  listener?.();
  AsyncStorage.getItem('seen_story_ids')
    .then((raw) => {
      const ids: string[] = raw ? JSON.parse(raw) : [];
      ids.push(id);
      return AsyncStorage.setItem('seen_story_ids', JSON.stringify(ids));
    })
    .catch(() => {});
}

export function getSeenIds() {
  return seenIds;
}

// Hook used by the feed — re-renders whenever a story is marked seen
export function useSeenStoryIds() {
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    listener = () => forceUpdate((n) => n + 1);
    return () => { listener = null; };
  }, []);
  return seenIds;
}
