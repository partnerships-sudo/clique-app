export interface RecPayload {
  __rec: 1;
  title: string;
  type: string;
  sub?: string;
  poster?: string;
  note?: string;
  extRating?: string;
  compatScore?: number;
}

const TYPE_EMOJI: Record<string, string> = {
  watch: '🎬',
  read: '📚',
  play: '🎮',
  listen: '🎵',
  podcast: '🎙️',
};

export function parseRec(content: string): RecPayload | null {
  if (!content.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed.__rec === 1 ? (parsed as RecPayload) : null;
  } catch {
    return null;
  }
}

export function recPreviewText(rec: RecPayload): string {
  return `${TYPE_EMOJI[rec.type] ?? '🔗'} ${rec.title}`;
}
