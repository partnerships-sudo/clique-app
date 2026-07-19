export interface NewsShare {
  title: string;
  url: string;
}

/** Detects a news article share: two lines where the second is an https URL */
export function parseNewsShare(content: string): NewsShare | null {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return null;
  const url = lines[lines.length - 1].trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const title = lines.slice(0, lines.length - 1).join('\n').trim();
  if (!title) return null;
  return { title, url };
}
