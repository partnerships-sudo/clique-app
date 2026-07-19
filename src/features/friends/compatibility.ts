import type { Post } from '@/features/feed/api';

export function computeCompatibility(myPosts: Post[], friendPosts: Post[]): number {
  if (!myPosts.length || !friendPosts.length) return Math.floor(Math.random() * 20) + 55;

  let score = 40;

  const myTitles = myPosts.map((p) => p.title.toLowerCase());
  const friendTitles = friendPosts.map((p) => p.title.toLowerCase());
  const sharedTitles = myTitles.filter((t) => friendTitles.includes(t)).length;
  score += sharedTitles * 20;

  const myTypes = new Set(myPosts.map((p) => p.type));
  const friendTypes = new Set(friendPosts.map((p) => p.type));
  const sharedTypes = [...myTypes].filter((t) => friendTypes.has(t)).length;
  score += sharedTypes * 8;

  const myRatings = new Map<string, number>();
  myPosts.forEach((p) => {
    if (p.rating) myRatings.set(p.title.toLowerCase(), p.rating);
  });
  friendPosts.forEach((p) => {
    const mine = p.rating ? myRatings.get(p.title.toLowerCase()) : undefined;
    if (p.rating && mine) {
      const diff = Math.abs(p.rating - mine);
      if (diff === 0) score += 5;
      else if (diff === 1) score += 3;
    }
  });

  const myNetworks = new Set(
    myPosts.map((p) => (p.sub ?? '').split('·')[0].trim().toLowerCase()).filter(Boolean),
  );
  friendPosts.forEach((p) => {
    const net = (p.sub ?? '').split('·')[0].trim().toLowerCase();
    if (net && myNetworks.has(net)) score += 4;
  });

  if (sharedTypes >= 3) score += 5;
  if (sharedTypes >= 4) score += 5;

  return Math.min(99, Math.max(20, score));
}

export function compatColor(n: number) {
  return n >= 90 ? '#E84F4F' : n >= 75 ? '#5B4FE8' : n >= 60 ? '#4F9CE8' : '#9E9E9E';
}

export function compatEmoji(n: number) {
  return n >= 90 ? '🔥' : n >= 75 ? '✨' : n >= 60 ? '👍' : '🤔';
}

export function compatLabel(n: number): { emoji: string; label: string } {
  if (n >= 80) return { emoji: '🎬', label: 'Movie Soulmate' };
  if (n >= 60) return { emoji: '📺', label: 'TV Twin' };
  if (n >= 40) return { emoji: '🤔', label: 'Curious Minds' };
  return { emoji: '😀', label: 'Fun Seeker' };
}
