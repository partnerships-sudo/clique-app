import type { LibraryItem } from './api';

export interface ProfileStats {
  streakDays: number;
  streakMessage: string;
  weekDays: { label: string; done: boolean }[];
  topCategories: { label: string; icon: string; color: string; count: number }[];
  topGenres: { name: string; count: number; color: string }[];
}

const CATEGORY_CONFIG = [
  { types: ['watch'], label: 'TV', icon: '📺', color: '#FF6B6B' },
  { types: ['play'], label: 'Games', icon: '🎮', color: '#5FD9FF' },
  { types: ['listen'], label: 'Music', icon: '🎵', color: '#9B95AC' },
  { types: ['podcast'], label: 'Podcasts', icon: '🎙️', color: '#C084FC' },
  { types: ['read'], label: 'Books', icon: '📚', color: '#5FA8FF' },
];

const GENRE_COLORS = ['#FF6B6B', '#C084FC', '#F4A340', '#5FA8FF', '#5FD9FF'];

export function computeProfileStats(items: LibraryItem[]): ProfileStats {
  const logged = items.filter((i) => i.status !== 'watchlist');

  // Streak: count consecutive days up to today that have a logged item
  const loggedDates = new Set(
    logged.map((i) => {
      const d = new Date(i.created_at);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    })
  );

  let streakDays = 0;
  const today = new Date();
  for (let offset = 0; offset < 365; offset++) {
    const d = new Date(today);
    d.setDate(today.getDate() - offset);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (loggedDates.has(key)) {
      streakDays++;
    } else if (offset > 0) {
      break;
    }
  }

  const streakMessage =
    streakDays >= 7
      ? "You're unstoppable! 🔥"
      : streakDays >= 3
      ? "Keep it up! You're on fire."
      : streakDays > 0
      ? 'Great start, keep going!'
      : 'Log something to start your streak!';

  // Week days (Sun–Sat, last 7 days)
  const DAY_LABELS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return { label: DAY_LABELS[d.getDay()], done: loggedDates.has(key) };
  });

  // Top categories
  const topCategories = CATEGORY_CONFIG.map((cat) => ({
    label: cat.label,
    icon: cat.icon,
    color: cat.color,
    count: logged.filter((i) => cat.types.includes(i.type)).length,
  })).sort((a, b) => b.count - a.count);

  // Top genres from sub field (best effort — sub often contains genre/year)
  const genreCounts: Record<string, number> = {};
  for (const item of logged) {
    if (item.media_type && item.media_type.length > 0 && item.media_type.length < 30) {
      genreCounts[item.media_type] = (genreCounts[item.media_type] ?? 0) + 1;
    }
  }
  const topGenres = Object.entries(genreCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count], i) => ({ name, count, color: GENRE_COLORS[i] ?? '#888' }));

  return { streakDays, streakMessage, weekDays, topCategories, topGenres };
}
