export interface CompatItem {
  title: string;
  type: string;
  rating: number | null;
  sub: string | null;
}

export interface CompatDetail {
  total: number;
  // Component scores (raw, before base-40 is added)
  titleScore: number;   // 0–25
  typeScore: number;    // 0–20
  ratingScore: number;  // 0–10
  networkScore: number; // 0–5
  // Insights
  sharedTitles: string[];                                          // titles both logged
  bothLoved: { title: string; myRating: number; theirRating: number }[]; // both ≥ 4 stars
  theyLove: { title: string; type: string; rating: number }[];    // their best, you haven't logged
  youLove: { title: string; type: string; rating: number }[];     // your best, they haven't logged
  sharedTypes: string[];
  sharedCount: number;
  topType: string | null; // most-shared media type
}

export function computeDetailedCompatibility(myPosts: CompatItem[], friendPosts: CompatItem[]): CompatDetail {
  if (!myPosts.length || !friendPosts.length) {
    return { total: 40, titleScore: 0, typeScore: 0, ratingScore: 0, networkScore: 0,
      sharedTitles: [], bothLoved: [], theyLove: [], youLove: [], sharedTypes: [], sharedCount: 0, topType: null };
  }

  const myTitleMap = new Map<string, CompatItem>();
  for (const p of myPosts) myTitleMap.set(p.title.toLowerCase(), p);

  const friendTitleMap = new Map<string, CompatItem>();
  for (const p of friendPosts) friendTitleMap.set(p.title.toLowerCase(), p);

  // ── Shared titles ─────────────────────────────────────────────────────────
  const sharedTitles: string[] = [];
  const bothLoved: { title: string; myRating: number; theirRating: number }[] = [];
  for (const [key, mine] of myTitleMap) {
    const theirs = friendTitleMap.get(key);
    if (theirs) {
      sharedTitles.push(mine.title);
      if ((mine.rating ?? 0) >= 4 && (theirs.rating ?? 0) >= 4) {
        bothLoved.push({ title: mine.title, myRating: mine.rating!, theirRating: theirs.rating! });
      }
    }
  }
  bothLoved.sort((a, b) => Math.abs(a.myRating - a.theirRating) - Math.abs(b.myRating - b.theirRating));

  // ── Titles they love that I haven't logged ────────────────────────────────
  const theyLove = friendPosts
    .filter((p) => !myTitleMap.has(p.title.toLowerCase()) && (p.rating ?? 0) >= 3.5)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10)
    .map((p) => ({ title: p.title, type: p.type, rating: p.rating! }));

  // ── Titles I love that they haven't logged ────────────────────────────────
  const youLove = myPosts
    .filter((p) => !friendTitleMap.has(p.title.toLowerCase()) && (p.rating ?? 0) >= 3.5)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 10)
    .map((p) => ({ title: p.title, type: p.type, rating: p.rating! }));

  // ── Title overlap score ───────────────────────────────────────────────────
  const smallerLib = Math.min(myTitleMap.size, friendTitleMap.size);
  const overlapCoeff = smallerLib > 0 ? sharedTitles.length / smallerLib : 0;
  const titleScore = overlapCoeff * 25;

  // ── Media type score ──────────────────────────────────────────────────────
  const myTypes = new Set(myPosts.map((p) => p.type));
  const friendTypes = new Set(friendPosts.map((p) => p.type));
  const sharedTypesSet = new Set<string>();
  for (const t of myTypes) { if (friendTypes.has(t)) sharedTypesSet.add(t); }
  const sharedTypes = [...sharedTypesSet];
  const maxTypes = Math.max(myTypes.size, friendTypes.size);
  const typeScore = maxTypes > 0 ? (sharedTypes.length / maxTypes) * 20 : 0;

  // Top shared media type by volume
  const typeVolume = new Map<string, number>();
  for (const p of [...myPosts, ...friendPosts]) {
    if (sharedTypesSet.has(p.type)) typeVolume.set(p.type, (typeVolume.get(p.type) ?? 0) + 1);
  }
  const topType = sharedTypes.length
    ? [...typeVolume.entries()].sort((a, b) => b[1] - a[1])[0][0]
    : null;

  // ── Rating alignment ──────────────────────────────────────────────────────
  const myRatings = new Map<string, number>();
  for (const p of myPosts) { if (p.rating) myRatings.set(p.title.toLowerCase(), p.rating); }
  let ratingPoints = 0, ratingComparisons = 0;
  for (const p of friendPosts) {
    const mine = p.rating ? myRatings.get(p.title.toLowerCase()) : undefined;
    if (p.rating && mine) {
      ratingComparisons++;
      const diff = Math.abs(p.rating - mine);
      if (diff === 0) ratingPoints += 2;
      else if (diff <= 1) ratingPoints += 1;
    }
  }
  const ratingScore = ratingComparisons > 0 ? Math.min(10, (ratingPoints / ratingComparisons) * 5) : 0;

  // ── Platform / network score ──────────────────────────────────────────────
  const myNetworks = new Set(myPosts.map((p) => (p.sub ?? '').split('·')[0].trim().toLowerCase()).filter(Boolean));
  const friendNetworks = new Set(friendPosts.map((p) => (p.sub ?? '').split('·')[0].trim().toLowerCase()).filter(Boolean));
  let sharedNetworks = 0;
  for (const n of myNetworks) { if (friendNetworks.has(n)) sharedNetworks++; }
  const maxNetworks = Math.max(myNetworks.size, friendNetworks.size);
  const networkScore = maxNetworks > 0 ? Math.min(5, (sharedNetworks / maxNetworks) * 5) : 0;

  const total = Math.min(99, Math.max(25, Math.round(40 + titleScore + typeScore + ratingScore + networkScore)));

  return { total, titleScore, typeScore, ratingScore, networkScore,
    sharedTitles, bothLoved, theyLove, youLove, sharedTypes, sharedCount: sharedTitles.length, topType };
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
