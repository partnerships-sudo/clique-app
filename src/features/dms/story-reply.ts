export interface StoryReplyPayload {
  __storyReply: 1;
  title: string;
  type: string;
  sub?: string;
  poster?: string;
  rating?: number;
  author?: string;
  text: string;
}

export function parseStoryReply(content: string): StoryReplyPayload | null {
  if (!content.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(content);
    return parsed.__storyReply === 1 ? (parsed as StoryReplyPayload) : null;
  } catch {
    return null;
  }
}

export function encodeStoryReply(payload: Omit<StoryReplyPayload, '__storyReply'>): string {
  return JSON.stringify({ __storyReply: 1, ...payload });
}

export function storyReplyPreviewText(p: StoryReplyPayload): string {
  return `↩ Story reply: ${p.text || p.title}`;
}
