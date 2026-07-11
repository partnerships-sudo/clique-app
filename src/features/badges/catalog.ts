import type { LibraryItem } from '@/features/library/api';

import { BEST_PICTURE_WINNERS } from './best-picture';
import {
  decadesCovered,
  isSequelTitle,
  longestDayStreak,
  maxGroupSize,
  maxInRollingWindow,
  maxSameDayCount,
  parseFirstSegment,
  parseYear,
  targetDecades,
} from './helpers';

export interface BadgeContext {
  items: LibraryItem[];
  reactionsTotal: number;
}

export interface BadgeDef {
  key: string;
  name: string;
  category: string;
  tier: 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Special' | 'Ultimate';
  icon: string;
  flavor: string;
  criteriaLabel: string;
  target: number;
  getProgress: (ctx: BadgeContext) => number;
}

function movies(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'watch' && i.media_type === 'movie');
}
function tvShows(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'watch' && i.media_type === 'tv');
}
function allWatch(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'watch');
}
function books(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'read');
}
function albums(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'listen');
}
function podcasts(items: LibraryItem[]) {
  return items.filter((i) => i.type === 'podcast');
}
function dates(items: LibraryItem[]) {
  return items.map((i) => i.created_at);
}
function localHour(iso: string) {
  return new Date(iso).getHours();
}

function weeklyMediaDietCoverage(items: LibraryItem[]): number {
  const relevant = items
    .filter((i) => (i.type === 'watch' && i.media_type === 'movie') || i.type === 'read' || i.type === 'listen' || i.type === 'podcast')
    .map((i) => ({ time: new Date(i.created_at).getTime(), cat: i.type === 'watch' ? 'movie' : i.type }))
    .sort((a, b) => a.time - b.time);
  const windowMs = 7 * 86400000;
  let best = 0;
  let start = 0;
  for (let end = 0; end < relevant.length; end++) {
    while (relevant[end].time - relevant[start].time > windowMs) start++;
    best = Math.max(best, new Set(relevant.slice(start, end + 1).map((x) => x.cat)).size);
  }
  return best;
}

export const BADGE_CATALOG: BadgeDef[] = [
  // ── Movies ──────────────────────────────────────────────
  {
    key: 'first_reel', name: 'First Reel', category: 'Movies', tier: 'Starter', icon: '🎬',
    flavor: 'Every cinephile starts somewhere.', criteriaLabel: 'Log 1 movie', target: 1,
    getProgress: (ctx) => movies(ctx.items).length,
  },
  {
    key: 'movie_buff', name: 'Movie Buff', category: 'Movies', tier: 'Bronze', icon: '🎞️',
    flavor: 'You know your way around a watchlist.', criteriaLabel: 'Log 50 movies', target: 50,
    getProgress: (ctx) => movies(ctx.items).length,
  },
  {
    key: 'movie_maniac', name: 'Movie Maniac', category: 'Movies', tier: 'Silver', icon: '🍿',
    flavor: 'Popcorn is basically a food group now.', criteriaLabel: 'Log 250 movies', target: 250,
    getProgress: (ctx) => movies(ctx.items).length,
  },
  {
    key: 'movie_master', name: 'Movie Master', category: 'Movies', tier: 'Gold', icon: '🏆',
    flavor: "The credits roll, but you're still here.", criteriaLabel: 'Log 500 movies', target: 500,
    getProgress: (ctx) => movies(ctx.items).length,
  },
  {
    key: 'cinephile', name: 'Cinephile', category: 'Movies', tier: 'Platinum', icon: '⭐',
    flavor: 'A true student of the screen.', criteriaLabel: 'Log 1,000 movies', target: 1000,
    getProgress: (ctx) => movies(ctx.items).length,
  },
  {
    key: 'marathoner', name: 'Marathoner', category: 'Movies', tier: 'Special', icon: '🏃',
    flavor: 'Sleep is for people who finished their watchlist.', criteriaLabel: 'Log 5 movies in one day', target: 5,
    getProgress: (ctx) => maxSameDayCount(dates(movies(ctx.items))),
  },
  {
    key: 'sequel_sucker', name: 'Sequel Sucker', category: 'Movies', tier: 'Special', icon: '🔢',
    flavor: "You paid for the whole saga, you're gonna watch the whole saga.",
    criteriaLabel: 'Log 3 movies that look like sequels', target: 3,
    getProgress: (ctx) => movies(ctx.items).filter((m) => isSequelTitle(m.title)).length,
  },
  {
    key: 'award_season', name: 'Award Season', category: 'Movies', tier: 'Special', icon: '🏅',
    flavor: 'Critically acclaimed, personally verified.', criteriaLabel: 'Log 10 Best Picture winners', target: 10,
    getProgress: (ctx) =>
      movies(ctx.items).filter((m) => BEST_PICTURE_WINNERS.includes(m.title.trim().toLowerCase())).length,
  },
  {
    key: 'decade_diver', name: 'Decade Diver', category: 'Movies', tier: 'Special', icon: '🕰️',
    flavor: 'Time traveler with a remote control.',
    criteriaLabel: 'Log a movie from every decade since 1950', target: targetDecades().length,
    getProgress: (ctx) =>
      decadesCovered(movies(ctx.items).map((m) => parseYear(m.sub)).filter((y): y is number => y !== null)).size,
  },
  {
    key: 'one_sitting_wonder', name: 'One-Sitting Wonder', category: 'Movies', tier: 'Special', icon: '✍️',
    flavor: 'Bladder of steel.', criteriaLabel: 'Write a 100+ character review for something you watched', target: 1,
    getProgress: (ctx) => (allWatch(ctx.items).some((i) => (i.note?.length ?? 0) >= 100) ? 1 : 0),
  },

  // ── TV ──────────────────────────────────────────────────
  {
    key: 'binge_starter', name: 'Binge Starter', category: 'TV', tier: 'Starter', icon: '▶️',
    flavor: 'The first of many late nights.', criteriaLabel: 'Mark your first TV show as Finished', target: 1,
    getProgress: (ctx) => tvShows(ctx.items).filter((t) => t.status === 'finished').length,
  },
  {
    key: 'couch_potato', name: 'Couch Potato', category: 'TV', tier: 'Bronze', icon: '🛋️',
    flavor: 'The remote knows your thumbprint.', criteriaLabel: 'Log 25 TV shows', target: 25,
    getProgress: (ctx) => tvShows(ctx.items).length,
  },
  {
    key: 'series_slayer', name: 'Series Slayer', category: 'TV', tier: 'Gold', icon: '⚔️',
    flavor: "You don't watch shows, you conquer them.", criteriaLabel: 'Log 100 TV shows', target: 100,
    getProgress: (ctx) => tvShows(ctx.items).length,
  },
  {
    key: 'finale_fanatic', name: 'Finale Fanatic', category: 'TV', tier: 'Special', icon: '🎭',
    flavor: 'You stuck around to see how it ends.', criteriaLabel: 'Mark 10 TV shows as Finished', target: 10,
    getProgress: (ctx) => tvShows(ctx.items).filter((t) => t.status === 'finished').length,
  },
  {
    key: 'cliffhanger_club', name: 'Cliffhanger Club', category: 'TV', tier: 'Special', icon: '🧗',
    flavor: "It's not ghosting, it's 'on hold.'", criteriaLabel: 'Leave a show on Watching for 30+ days', target: 30,
    getProgress: (ctx) => {
      const watching = tvShows(ctx.items).filter((t) => t.status === 'watching');
      const maxAgeDays = watching.reduce((best, t) => {
        const age = (Date.now() - new Date(t.created_at).getTime()) / 86400000;
        return Math.max(best, age);
      }, 0);
      return Math.floor(maxAgeDays);
    },
  },
  {
    key: 'pilot_hoarder', name: 'Pilot Hoarder', category: 'TV', tier: 'Special', icon: '✈️',
    flavor: 'Commitment issues, but make it content.', criteriaLabel: "Start 20 shows you haven't finished", target: 20,
    getProgress: (ctx) => tvShows(ctx.items).filter((t) => t.status !== 'finished').length,
  },
  {
    key: 'weekend_binger', name: 'Weekend Binger', category: 'TV', tier: 'Special', icon: '📅',
    flavor: 'What weekend plans?', criteriaLabel: 'Log 3 TV shows within 48 hours', target: 3,
    getProgress: (ctx) => maxInRollingWindow(dates(tvShows(ctx.items)), 2),
  },

  // ── Documentaries (repurposed: thoughtful-viewer review tiers) ──
  {
    key: 'curious_mind', name: 'Curious Mind', category: 'Documentaries', tier: 'Starter', icon: '🔍',
    flavor: 'Asking the big questions, one doc at a time.', criteriaLabel: "Write reviews for 10 things you've watched", target: 10,
    getProgress: (ctx) => allWatch(ctx.items).filter((i) => !!i.note?.trim()).length,
  },
  {
    key: 'fact_finder', name: 'Fact Finder', category: 'Documentaries', tier: 'Bronze', icon: '🔎',
    flavor: 'You cite sources in casual conversation now.', criteriaLabel: "Write reviews for 50 things you've watched", target: 50,
    getProgress: (ctx) => allWatch(ctx.items).filter((i) => !!i.note?.trim()).length,
  },
  {
    key: 'true_story_junkie', name: 'True Story Junkie', category: 'Documentaries', tier: 'Gold', icon: '📚',
    flavor: 'Reality is stranger than fiction, and you love it.', criteriaLabel: "Write reviews for 100 things you've watched", target: 100,
    getProgress: (ctx) => allWatch(ctx.items).filter((i) => !!i.note?.trim()).length,
  },
  {
    key: 'true_crime_detective', name: 'True Crime Detective', category: 'Documentaries', tier: 'Special', icon: '🕵️',
    flavor: "You've got theories. Many, many theories.", criteriaLabel: "Rate 15 things you've watched a perfect 5 stars", target: 15,
    getProgress: (ctx) => allWatch(ctx.items).filter((i) => i.rating === 5).length,
  },

  // ── Books ───────────────────────────────────────────────
  {
    key: 'bookworm', name: 'Bookworm', category: 'Books', tier: 'Starter', icon: '🐛',
    flavor: 'The spine bends, the mind expands.', criteriaLabel: 'Log 25 books', target: 25,
    getProgress: (ctx) => books(ctx.items).length,
  },
  {
    key: 'page_turner', name: 'Page Turner', category: 'Books', tier: 'Bronze', icon: '📖',
    flavor: 'Your TBR pile has a TBR pile.', criteriaLabel: 'Log 100 books', target: 100,
    getProgress: (ctx) => books(ctx.items).length,
  },
  {
    key: 'bibliophile', name: 'Bibliophile', category: 'Books', tier: 'Silver', icon: '📚',
    flavor: 'Bookstores recognize you by name.', criteriaLabel: 'Log 500 books', target: 500,
    getProgress: (ctx) => books(ctx.items).length,
  },
  {
    key: 'library_legend', name: 'Library Legend', category: 'Books', tier: 'Gold', icon: '🏛️',
    flavor: 'You are the reason libraries exist.', criteriaLabel: 'Log 1,000 books', target: 1000,
    getProgress: (ctx) => books(ctx.items).length,
  },
  {
    key: 'speed_reader', name: 'Speed Reader', category: 'Books', tier: 'Special', icon: '⚡',
    flavor: 'Eyes like lightning.', criteriaLabel: 'Log 5 books in one week', target: 5,
    getProgress: (ctx) => maxInRollingWindow(dates(books(ctx.items)), 7),
  },
  {
    key: 'chunky_reads', name: 'Chunky Reads', category: 'Books', tier: 'Special', icon: '💪',
    flavor: 'You lift, too — just books.', criteriaLabel: 'Write a 100+ character review for a book', target: 1,
    getProgress: (ctx) => (books(ctx.items).some((b) => (b.note?.length ?? 0) >= 100) ? 1 : 0),
  },
  {
    key: 'series_completionist', name: 'Series Completionist', category: 'Books', tier: 'Special', icon: '📗',
    flavor: 'No loose ends, no unfinished sagas.', criteriaLabel: 'Log 3+ books by the same author', target: 3,
    getProgress: (ctx) => maxGroupSize(books(ctx.items).map((b) => parseFirstSegment(b.sub))),
  },
  {
    key: 'genre_hopper', name: 'Genre Hopper', category: 'Books', tier: 'Special', icon: '🧭',
    flavor: "Never met a genre you didn't like.", criteriaLabel: 'Log books from 10 different authors', target: 10,
    getProgress: (ctx) => new Set(books(ctx.items).map((b) => parseFirstSegment(b.sub)).filter(Boolean)).size,
  },

  // ── Music ───────────────────────────────────────────────
  {
    key: 'first_spin', name: 'First Spin', category: 'Music', tier: 'Starter', icon: '💿',
    flavor: 'The needle drops, the journey begins.', criteriaLabel: 'Log 1 album', target: 1,
    getProgress: (ctx) => albums(ctx.items).length,
  },
  {
    key: 'vinyl_voyager', name: 'Vinyl Voyager', category: 'Music', tier: 'Bronze', icon: '🎵',
    flavor: 'Your playlist has range.', criteriaLabel: 'Log 100 albums', target: 100,
    getProgress: (ctx) => albums(ctx.items).length,
  },
  {
    key: 'audiophile', name: 'Audiophile', category: 'Music', tier: 'Gold', icon: '🎧',
    flavor: "You hear things other people don't.", criteriaLabel: 'Log 500 albums', target: 500,
    getProgress: (ctx) => albums(ctx.items).length,
  },
  {
    key: 'on_repeat', name: 'On Repeat', category: 'Music', tier: 'Special', icon: '🔁',
    flavor: "It's not a phase, it's a lifestyle.", criteriaLabel: 'Log the same album 10 times', target: 10,
    getProgress: (ctx) => maxGroupSize(albums(ctx.items).map((a) => a.title)),
  },
  {
    key: 'concert_goer', name: 'Concert Goer', category: 'Music', tier: 'Special', icon: '🎤',
    flavor: 'Ears still ringing, worth it.', criteriaLabel: 'Log 5 albums in a single week', target: 5,
    getProgress: (ctx) => maxInRollingWindow(dates(albums(ctx.items)), 7),
  },
  {
    key: 'deep_cuts', name: 'Deep Cuts', category: 'Music', tier: 'Special', icon: '📦',
    flavor: 'You knew them before the hit single.', criteriaLabel: 'Log 5 albums by the same artist', target: 5,
    getProgress: (ctx) => maxGroupSize(albums(ctx.items).map((a) => parseFirstSegment(a.sub))),
  },

  // ── Podcasts ────────────────────────────────────────────
  {
    key: 'ear_candy', name: 'Ear Candy', category: 'Podcasts', tier: 'Starter', icon: '🎙️',
    flavor: 'Tuning in, one episode at a time.', criteriaLabel: 'Log 25 podcast episodes', target: 25,
    getProgress: (ctx) => podcasts(ctx.items).length,
  },
  {
    key: 'podcast_pro', name: 'Podcast Pro', category: 'Podcasts', tier: 'Gold', icon: '🎚️',
    flavor: '2x speed is your natural pace.', criteriaLabel: 'Log 250 podcast episodes', target: 250,
    getProgress: (ctx) => podcasts(ctx.items).length,
  },
  {
    key: 'loyal_listener', name: 'Loyal Listener', category: 'Podcasts', tier: 'Special', icon: '❤️',
    flavor: 'Same voice, every week, no complaints.', criteriaLabel: 'Log 50 episodes of the same show', target: 50,
    getProgress: (ctx) => maxGroupSize(podcasts(ctx.items).map((p) => p.title)),
  },

  // ── Streaks ─────────────────────────────────────────────
  {
    key: 'consistency_king_queen', name: 'Consistency King/Queen', category: 'Streaks', tier: 'Special', icon: '🔥',
    flavor: 'A week of showing up.', criteriaLabel: 'Log something every day for 7 days', target: 7,
    getProgress: (ctx) => longestDayStreak(dates(ctx.items)),
  },
  {
    key: 'habit_former', name: 'Habit Former', category: 'Streaks', tier: 'Special', icon: '🔥',
    flavor: "It's officially a habit now.", criteriaLabel: '30-day logging streak', target: 30,
    getProgress: (ctx) => longestDayStreak(dates(ctx.items)),
  },
  {
    key: 'unstoppable', name: 'Unstoppable', category: 'Streaks', tier: 'Special', icon: '👑',
    flavor: 'Triple digits. Untouchable.', criteriaLabel: '100-day logging streak', target: 100,
    getProgress: (ctx) => longestDayStreak(dates(ctx.items)),
  },

  // ── Cross-Media ─────────────────────────────────────────
  {
    key: 'renaissance_fan', name: 'Renaissance Fan', category: 'Cross-Media', tier: 'Special', icon: '🎨',
    flavor: 'A well-rounded media diet.', criteriaLabel: 'Log a movie, book, album, and podcast in one week', target: 4,
    getProgress: (ctx) => weeklyMediaDietCoverage(ctx.items),
  },
  {
    key: 'night_owl', name: 'Night Owl', category: 'Cross-Media', tier: 'Special', icon: '🦉',
    flavor: 'The best content happens after dark.', criteriaLabel: 'Log 10 entries after midnight', target: 10,
    getProgress: (ctx) => ctx.items.filter((i) => localHour(i.created_at) >= 0 && localHour(i.created_at) < 4).length,
  },
  {
    key: 'early_bird', name: 'Early Bird', category: 'Cross-Media', tier: 'Special', icon: '🌅',
    flavor: 'Up before the world, watchlist in hand.', criteriaLabel: 'Log 10 entries before 7am', target: 10,
    getProgress: (ctx) => ctx.items.filter((i) => localHour(i.created_at) >= 4 && localHour(i.created_at) < 7).length,
  },
  {
    key: 'explorer', name: 'Explorer', category: 'Cross-Media', tier: 'Special', icon: '🗺️',
    flavor: 'Every corner of the map, covered.', criteriaLabel: 'Log content across all 5 media types', target: 5,
    getProgress: (ctx) => new Set(ctx.items.map((i) => i.type)).size,
  },

  // ── Social ──────────────────────────────────────────────
  {
    key: 'critic_in_training', name: 'Critic in Training', category: 'Social', tier: 'Starter', icon: '✏️',
    flavor: 'Your opinions are now on the record.', criteriaLabel: 'Write 25 reviews/ratings', target: 25,
    getProgress: (ctx) => ctx.items.filter((i) => i.rating !== null).length,
  },
  {
    key: 'top_critic', name: 'Top Critic', category: 'Social', tier: 'Gold', icon: '⭐',
    flavor: 'People check your ratings before they commit.', criteriaLabel: 'Write 100 reviews/ratings', target: 100,
    getProgress: (ctx) => ctx.items.filter((i) => i.rating !== null).length,
  },
  {
    key: 'taste_maker', name: 'Taste Maker', category: 'Social', tier: 'Special', icon: '📣',
    flavor: "Your taste is somebody else's roadmap.", criteriaLabel: 'Get 50 reactions on your posts', target: 50,
    getProgress: (ctx) => ctx.reactionsTotal,
  },
];

export const COMPLETIONIST_BADGE: BadgeDef = {
  key: 'completionist', name: 'Completionist', category: 'Meta', tier: 'Ultimate', icon: '🏆',
  flavor: "There is nothing left to unlock. You've seen it all.",
  criteriaLabel: 'Earn every other badge', target: BADGE_CATALOG.length,
  // Real progress for this one is computed specially in useBadges() from the
  // earned-count of every other badge — this is never called directly.
  getProgress: () => 0,
};

export const BADGE_CATEGORIES = [
  'Movies', 'TV', 'Documentaries', 'Books', 'Music', 'Podcasts', 'Streaks', 'Cross-Media', 'Social', 'Meta',
] as const;

export const TIER_COLORS: Record<BadgeDef['tier'], string> = {
  Starter: '#6EE7B7',
  Bronze: '#CD7F32',
  Silver: '#B0B8C1',
  Gold: '#F5C518',
  Platinum: '#7DD3FC',
  Special: '#A855F7',
  Ultimate: '#F43F5E',
};
