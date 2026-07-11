export function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Longest run of consecutive calendar days with at least one log — computed
 * historically (not just the current streak) so a badge earned in the past
 * stays earned even if the streak later breaks. */
export function longestDayStreak(isoDates: string[]): number {
  const days = [...new Set(isoDates.map(toDateKey))].sort();
  if (!days.length) return 0;
  let best = 1;
  let current = 1;
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((new Date(days[i]).getTime() - new Date(days[i - 1]).getTime()) / 86400000);
    if (diff === 1) {
      current += 1;
      best = Math.max(best, current);
    } else if (diff > 1) {
      current = 1;
    }
  }
  return best;
}

export function maxSameDayCount(isoDates: string[]): number {
  const counts = new Map<string, number>();
  for (const iso of isoDates) {
    const key = toDateKey(iso);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

/** Largest number of timestamps that fall within any rolling window of
 * `windowDays` days of each other. */
export function maxInRollingWindow(isoDates: string[], windowDays: number): number {
  const sorted = isoDates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  const windowMs = windowDays * 86400000;
  let best = 0;
  let start = 0;
  for (let end = 0; end < sorted.length; end++) {
    while (sorted[end] - sorted[start] > windowMs) start++;
    best = Math.max(best, end - start + 1);
  }
  return best;
}

export function maxGroupSize(values: (string | null)[]): number {
  const counts = new Map<string, number>();
  for (const v of values) {
    if (!v) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return Math.max(0, ...counts.values());
}

export function parseYear(sub: string | null): number | null {
  const match = sub?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

/** First "·"-separated segment of a search-result subtitle — the author for
 * books, the artist for albums. */
export function parseFirstSegment(sub: string | null): string | null {
  if (!sub) return null;
  const first = sub.split('·')[0]?.trim();
  return first && first !== 'Unknown' ? first : null;
}

export function isSequelTitle(title: string): boolean {
  return /\b([2-9]|10|ii|iii|iv|v|vi|vii|viii|part\s*\d)\b/i.test(title);
}

export function targetDecades(): number[] {
  const current = Math.floor(new Date().getFullYear() / 10) * 10;
  const decades: number[] = [];
  for (let d = 1950; d <= current; d += 10) decades.push(d);
  return decades;
}

export function decadesCovered(years: number[]): Set<number> {
  return new Set(years.filter((y) => y >= 1950).map((y) => Math.floor(y / 10) * 10));
}
