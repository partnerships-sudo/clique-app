export interface WatchPartyInvitePayload {
  __watchparty: 1;
  id: string;
  title: string;
  poster: string | null;
  episode: string | null;
  date: string | null;
  time: string | null;
  tagline: string | null;
  hostName: string;
}

export function parseWatchPartyInvite(content: string): WatchPartyInvitePayload | null {
  if (!content.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed.__watchparty === 1 ? (parsed as WatchPartyInvitePayload) : null;
  } catch {
    return null;
  }
}

export function buildWatchPartyInvite(payload: Omit<WatchPartyInvitePayload, '__watchparty'>): string {
  return JSON.stringify({ __watchparty: 1, ...payload });
}
