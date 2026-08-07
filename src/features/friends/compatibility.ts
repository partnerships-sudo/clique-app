export interface CompatItem {
  title: string;
  type: string;
  rating: number | null;
  sub: string | null;
}

export function computeCompatibility(myPosts: CompatItem[], friendPosts: CompatItem[]): number {
  if (!myPosts.length || !friendPosts.length) return 40;

  // ── Title overlap: overlap coefficient — max 25 pts ──────────────────────
  // Uses the SMALLER library as denominator so large vs small libraries don't
  // get unfairly penalised. Sharing 5 out of the smaller person's 20 = 25%.
  const myTitleSet = new Set(myPosts.map((p) => p.title.toLowerCase()));
  const friendTitleSet = new Set(friendPosts.map((p) => p.title.toLowerCase()));
  let sharedTitles = 0;
  for (const t of myTitleSet) {
    if (friendTitleSet.has(t)) sharedTitles++;
  }
  const smallerLib = Math.min(myTitleSet.size, friendTitleSet.size);
  const overlapCoeff = smallerLib > 0 ? sharedTitles / smallerLib : 0;
  const titleScore = overlapCoeff * 25;

  // ── Media type diversity — max 20 pts ────────────────────────────────────
  const myTypes = new Set(myPosts.map((p) => p.type));
  const friendTypes = new Set(friendPosts.map((p) => p.type));
  let sharedTypes = 0;
  for (const t of myTypes) {
    if (friendTypes.has(t)) sharedTypes++;
  }
  const maxTypes = Math.max(myTypes.size, friendTypes.size);
  const typeScore = maxTypes > 0 ? (sharedTypes / maxTypes) * 20 : 0;

  // ── Rating alignment on shared titles — max 10 pts ───────────────────────
  const myRatings = new Map<string, number>();
  for (const p of myPosts) {
    if (p.rating) myRatings.set(p.title.toLowerCase(), p.rating);
  }
  let ratingPoints = 0;
  let ratingComparisons = 0;
  for (const p of friendPosts) {
    const mine = p.rating ? myRatings.get(p.title.toLowerCase()) : undefined;
    if (p.rating && mine) {
      ratingComparisons++;
      const diff = Math.abs(p.rating - mine);
      if (diff === 0) ratingPoints += 2;
      else if (diff <= 1) ratingPoints += 1;
    }
  }
  const ratingScore = ratingComparisons > 0
    ? Math.min(10, (ratingPoints / ratingComparisons) * 5)
    : 0;

  // ── Platform / network overlap — max 5 pts ───────────────────────────────
  const myNetworks = new Set(
    myPosts.map((p) => (p.sub ?? '').split('·')[0].trim().toLowerCase()).filter(Boolean),
  );
  const friendNetworks = new Set(
    friendPosts.map((p) => (p.sub ?? '').split('·')[0].trim().toLowerCase()).filter(Boolean),
  );
  let sharedNetworks = 0;
  for (const n of myNetworks) {
    if (friendNetworks.has(n)) sharedNetworks++;
  }
  const maxNetworks = Math.max(myNetworks.size, friendNetworks.size);
  const networkScore = maxNetworks > 0 ? Math.min(5, (sharedNetworks / maxNetworks) * 5) : 0;

  // Base 40 + max 60 from signals = 100, capped at 99
  const total = 40 + titleScore + typeScore + ratingScore + networkScore;
  return Math.min(99, Math.max(25, Math.round(total)));
}

export function compatColor(n: number) {
  return n >= 90 ? '#E84F4F' : n >= 75 ? '#5B4FE8' : n >= 60 ? '#4F9CE8' : '#9E9E9E';
}

export function compatEmoji(n: number) {
  return n >= 90 ? '🔥' : n >= 75 ? '✨' : n >= 60 ? '👍' : '🤔';
}

export function compatLabel(n: number): { emoji: string; label: string } {
  if (n >= 80) return { emoji: '', label: 'Movie Soulmate' };
  if (n >= 60) return { emoji: '', label: 'TV Twin' };
  if (n >= 40) return { emoji: '', label: 'Curious Minds' };
  return { emoji: '', label: 'Fun Seeker' };
}
