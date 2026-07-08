import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tm_ep_checkpoints';

export interface EpisodeCheckpoint {
  season: number;
  episode: number;
  updatedAt: string; // ISO timestamp — used as the spoiler-line cutoff for free-form messages
  finished?: boolean; // true = user is fully caught up, no divider shown
}

export function isAhead(
  message: { ep_season?: number | null; ep_episode?: number | null },
  checkpoint: EpisodeCheckpoint,
) {
  if (checkpoint.finished) return false;
  if (message.ep_season == null || message.ep_episode == null) return false;
  if (message.ep_season > checkpoint.season) return true;
  return message.ep_season === checkpoint.season && message.ep_episode > checkpoint.episode;
}

export function useEpisodeCheckpoint(title: string | null) {
  const [checkpoints, setCheckpoints] = useState<Record<string, EpisodeCheckpoint>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setCheckpoints(JSON.parse(raw));
      })
      .finally(() => setLoaded(true));
  }, []);

  const setCheckpoint = useCallback(
    (forTitle: string, checkpoint: EpisodeCheckpoint) => {
      setCheckpoints((prev) => {
        const next = { ...prev, [forTitle]: checkpoint };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  return {
    loaded,
    checkpoint: title ? checkpoints[title] : undefined,
    setCheckpoint,
  };
}
