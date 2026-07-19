import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const ARCHIVE_KEY = 'clique:chat:archived';
const DELETE_KEY  = 'clique:chat:deleted';

type DeletedMap = Record<string, string>; // threadId → ISO timestamp

async function loadSet(key: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

async function saveSet(key: string, set: Set<string>) {
  await AsyncStorage.setItem(key, JSON.stringify([...set]));
}

async function loadDeletedMap(): Promise<DeletedMap> {
  try {
    const raw = await AsyncStorage.getItem(DELETE_KEY);
    return raw ? (JSON.parse(raw) as DeletedMap) : {};
  } catch {
    return {};
  }
}

async function saveDeletedMap(map: DeletedMap) {
  await AsyncStorage.setItem(DELETE_KEY, JSON.stringify(map));
}

export function useArchivedChats() {
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [deleted, setDeleted]   = useState<DeletedMap>({});
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    Promise.all([loadSet(ARCHIVE_KEY), loadDeletedMap()]).then(([a, d]) => {
      setArchived(a);
      setDeleted(d);
      setLoaded(true);
    });
  }, []);

  const archive = useCallback(async (threadId: string) => {
    setArchived((prev) => {
      const next = new Set(prev);
      next.add(threadId);
      saveSet(ARCHIVE_KEY, next);
      return next;
    });
  }, []);

  const unarchive = useCallback(async (threadId: string) => {
    setArchived((prev) => {
      const next = new Set(prev);
      next.delete(threadId);
      saveSet(ARCHIVE_KEY, next);
      return next;
    });
  }, []);

  // Soft-delete: store the ISO timestamp so the thread reappears when a
  // newer message arrives after this point.
  const softDelete = useCallback(async (threadId: string) => {
    const ts = new Date().toISOString();
    setDeleted((prev) => {
      const next = { ...prev, [threadId]: ts };
      saveDeletedMap(next);
      return next;
    });
    // Also remove from archive if it was there
    setArchived((prev) => {
      if (!prev.has(threadId)) return prev;
      const next = new Set(prev);
      next.delete(threadId);
      saveSet(ARCHIVE_KEY, next);
      return next;
    });
  }, []);

  // Returns true if a thread should be hidden (deleted but no new messages since)
  const isDeleted = useCallback(
    (threadId: string, lastMessageTime: string) => {
      const deletedAt = deleted[threadId];
      if (!deletedAt) return false;
      return lastMessageTime <= deletedAt;
    },
    [deleted],
  );

  return { archived, deleted, loaded, archive, unarchive, softDelete, isDeleted };
}
