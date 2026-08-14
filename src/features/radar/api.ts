/**
 * On the Radar — upcoming releases for Albums, Books, and Podcasts.
 *
 * Albums:  Spotify (client credentials flow, no user login needed)
 * Books:   Google Books API (with EXPO_PUBLIC_GOOGLE_BOOKS_KEY)
 * Podcasts: Podcast Index API
 */

import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';

const GOOGLE_BOOKS_KEY = process.env.EXPO_PUBLIC_GOOGLE_BOOKS_KEY ?? '';
const HARDCOVER_TOKEN = process.env.EXPO_PUBLIC_HARDCOVER_TOKEN ?? '';


// ── Albums ────────────────────────────────────────────────────────────────────

export interface UpcomingAlbum {
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  releaseDate: string;
  albumType: string | null;
}

async function fetchUpcomingAlbums(): Promise<UpcomingAlbum[]> {
  // Apple Music "most-played" RSS — public, no auth required.
  // Filter to albums released in the last 14 days so the list stays fresh.
  try {
    const res = await fetch(
      'https://rss.applemarketingtools.com/api/v2/us/music/most-played/50/albums.json',
    );
    if (!res.ok) return [];
    const data = await res.json() as { feed: { results: any[] } };
    const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return (data.feed?.results ?? [])
      .filter((a) => a.name && a.artistName && (a.releaseDate ?? '') >= cutoff)
      .map((a): UpcomingAlbum => ({
        id: a.id ?? a.name,
        title: a.name,
        artist: a.artistName,
        cover: a.artworkUrl100?.replace('100x100bb', '400x400bb') ?? null,
        releaseDate: a.releaseDate ?? '',
        albumType: a.kind ?? null,
      }));
  } catch (e) {
    console.warn('[radar/albums]', e);
    return [];
  }
}

export function useUpcomingAlbums() {
  return useQuery({
    queryKey: ['albums', 'upcoming'],
    queryFn: fetchUpcomingAlbums,
    staleTime: 30 * 60 * 1000,
  });
}

// ── Books ─────────────────────────────────────────────────────────────────────

export interface UpcomingBook {
  id: string;
  title: string;
  author: string;
  cover: string | null;
  publishDate: string;
  subject: string | null;
}

async function fetchUpcomingBooks(): Promise<UpcomingBook[]> {
  // Hardcover (Letterboxd for books) — sorted by reader count so most
  // anticipated titles bubble to the top.
  try {
    const today = new Date().toISOString().slice(0, 10);
    const query = `{
      books(
        where: { release_date: { _gte: "${today}" } }
        order_by: { users_count: desc }
        limit: 30
      ) {
        id
        title
        release_date
        image { url }
        contributions { author { name } }
      }
    }`;
    const res = await fetch('https://api.hardcover.app/v1/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${HARDCOVER_TOKEN}`,
      },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: { books?: any[] } };
    return (json.data?.books ?? [])
      .filter((b) => b.title && b.image?.url)
      .map((b): UpcomingBook => ({
        id: String(b.id),
        title: b.title,
        author: (b.contributions as { author: { name: string } }[])
          .slice(0, 2)
          .map((c) => c.author.name)
          .join(', '),
        cover: b.image?.url ?? null,
        publishDate: b.release_date ?? '',
        subject: null,
      }));
  } catch (e) {
    console.warn('[radar/books]', e);
    return [];
  }
}

export function useUpcomingBooks() {
  return useQuery({
    queryKey: ['books', 'upcoming'],
    queryFn: fetchUpcomingBooks,
    staleTime: 60 * 60 * 1000,
  });
}

// ── Podcasts ──────────────────────────────────────────────────────────────────

export interface UpcomingPodcast {
  id: number;
  title: string;
  author: string;
  cover: string | null;
  description: string | null;
  categories: string[];
}

async function fetchNewPodcasts(): Promise<UpcomingPodcast[]> {
  try {
    // Route through the podcast-index Supabase Edge Function so the
    // HMAC secret never touches the client bundle.
    const { data, error } = await supabase.functions.invoke('podcast-index', {
      body: { action: 'trending' },
    });
    if (error || !data) return [];
    return ((data.feeds ?? []) as any[])
      .filter((f) => f.title && f.artwork)
      .map((f): UpcomingPodcast => ({
        id: f.id,
        title: f.title,
        author: f.author ?? f.ownerName ?? '',
        cover: f.artwork ?? f.image ?? null,
        description: f.description ?? null,
        categories: Object.values(f.categories ?? {}) as string[],
      }));
  } catch {
    return [];
  }
}

export function useNewPodcasts() {
  return useQuery({
    queryKey: ['podcasts', 'trending'],
    queryFn: fetchNewPodcasts,
    staleTime: 30 * 60 * 1000,
  });
}
