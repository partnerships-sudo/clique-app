import type { EntryType } from '@/constants/theme';

export interface StoreLink {
  name: string;
  logo: string;
  logoUrl?: string;
  price: string;
  cta: string;
  color: string;
  url: string;
}

export interface WhereToFindConfig {
  emoji: string;
  label: string;
  gradient: [string, string];
  stores: StoreLink[];
}

export function getWhereToFindConfig(type: EntryType | 'cinema', title: string, externalId?: string): WhereToFindConfig {
  const q = encodeURIComponent(title);

  switch (type) {
    case 'watch':
      return {
        emoji: '📺',
        label: 'Where to watch',
        gradient: ['#0E0E10', '#1a1a2e'],
        stores: [
          { name: 'JustWatch', logo: '🎬', logoUrl: 'https://www.google.com/s2/favicons?domain=justwatch.com&sz=64', price: 'Shows every platform this is available on', cta: 'Find on JustWatch', color: '#0E0E10', url: `https://www.justwatch.com/us/search?q=${q}` },
          { name: 'Max', logo: '🟣', logoUrl: 'https://www.google.com/s2/favicons?domain=max.com&sz=64', price: 'HBO & Max Originals', cta: 'Search on Max', color: '#7C3AED', url: `https://www.max.com/search?q=${q}` },
          { name: 'Netflix', logo: '🔴', logoUrl: 'https://www.google.com/s2/favicons?domain=netflix.com&sz=64', price: 'Netflix Originals & more', cta: 'Search on Netflix', color: '#E50914', url: `https://www.netflix.com/search?q=${q}` },
          { name: 'Apple TV+', logo: '🍎', logoUrl: 'https://www.google.com/s2/favicons?domain=tv.apple.com&sz=64', price: 'Apple Originals', cta: 'Search on Apple TV', color: '#000000', url: `https://tv.apple.com/search?term=${q}` },
          { name: 'Amazon Prime Video', logo: '📦', logoUrl: 'https://www.google.com/s2/favicons?domain=primevideo.amazon.com&sz=64', price: 'Stream or rent/buy', cta: 'Search on Amazon', color: '#FF9900', url: `https://www.amazon.com/s?k=${q}&i=instant-video` },
        ],
      };
    case 'read':
      return {
        emoji: '📖',
        label: 'Where to buy',
        gradient: ['#1a1a2e', '#4F9CE8'],
        stores: [
          { name: 'Amazon', logo: '📦', logoUrl: 'https://www.google.com/s2/favicons?domain=amazon.com&sz=64', price: 'Hardcover & Kindle', cta: 'Buy on Amazon', color: '#FF9900', url: `https://www.amazon.com/s?k=${q}+book` },
          { name: 'Kindle', logo: '📱', logoUrl: 'https://www.google.com/s2/favicons?domain=kindle.amazon.com&sz=64', price: 'eBook', cta: 'Buy on Kindle', color: '#232F3E', url: `https://www.amazon.com/s?k=${q}&i=digital-text` },
          { name: 'Audible', logo: '🎧', logoUrl: 'https://www.google.com/s2/favicons?domain=audible.com&sz=64', price: 'Audiobook', cta: 'Listen on Audible', color: '#F7991C', url: `https://www.audible.com/search?keywords=${q}` },
          { name: 'Apple Books', logo: '🍎', logoUrl: 'https://www.google.com/s2/favicons?domain=books.apple.com&sz=64', price: 'eBook', cta: 'Buy on Apple Books', color: '#007AFF', url: `https://books.apple.com/search?term=${q}` },
          { name: 'Bookshop.org', logo: '🏠', logoUrl: 'https://www.google.com/s2/favicons?domain=bookshop.org&sz=64', price: 'Supports local bookshops', cta: 'Buy on Bookshop', color: '#E8A84F', url: `https://bookshop.org/search?keywords=${q}` },
        ],
      };
    case 'play':
      return {
        emoji: '🎮',
        label: 'Where to buy',
        gradient: ['#0a0a1a', '#4F1BE8'],
        stores: [
          { name: 'Steam', logo: '🖥', logoUrl: 'https://www.google.com/s2/favicons?domain=store.steampowered.com&sz=64', price: 'PC / Mac', cta: 'Find on Steam', color: '#1B2838', url: `https://store.steampowered.com/search/?term=${q}` },
          { name: 'PlayStation Store', logo: '🔵', logoUrl: 'https://www.google.com/s2/favicons?domain=store.playstation.com&sz=64', price: 'PS4 / PS5', cta: 'Find on PS Store', color: '#003791', url: `https://store.playstation.com/search/${q}` },
          { name: 'Xbox Store', logo: '🟢', logoUrl: 'https://www.google.com/s2/favicons?domain=xbox.com&sz=64', price: 'Xbox / Game Pass', cta: 'Find on Xbox', color: '#107C10', url: `https://www.xbox.com/search?q=${q}` },
          { name: 'Nintendo eShop', logo: '🔴', logoUrl: 'https://www.google.com/s2/favicons?domain=nintendo.com&sz=64', price: 'Switch', cta: 'Find on eShop', color: '#E4000F', url: `https://www.nintendo.com/search/#q=${q}` },
          { name: 'App Store', logo: '📱', logoUrl: 'https://www.google.com/s2/favicons?domain=apps.apple.com&sz=64', price: 'iOS / Android', cta: 'Find on App Store', color: '#007AFF', url: `https://apps.apple.com/search?term=${q}` },
        ],
      };
    case 'listen':
      return {
        emoji: '🎧',
        label: 'Stream & buy',
        gradient: ['#1a0a2e', '#1DB954'],
        stores: [
          { name: 'Spotify', logo: '🟢', logoUrl: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64', price: 'Stream free or premium', cta: 'Listen on Spotify', color: '#1DB954', url: externalId ? `https://open.spotify.com/album/${externalId}` : `https://open.spotify.com/search/${q}` },
          { name: 'Apple Music', logo: '🍎', logoUrl: 'https://www.google.com/s2/favicons?domain=music.apple.com&sz=64', price: 'Stream', cta: 'Listen on Apple Music', color: '#FC3C44', url: `https://music.apple.com/search?term=${q}` },
          { name: 'Amazon Music', logo: '📦', logoUrl: 'https://www.google.com/s2/favicons?domain=music.amazon.com&sz=64', price: 'Stream or buy', cta: 'Find on Amazon', color: '#FF9900', url: `https://music.amazon.com/search/${q}` },
          { name: 'Tidal', logo: '🌊', logoUrl: 'https://www.google.com/s2/favicons?domain=tidal.com&sz=64', price: 'Hi-fi streaming', cta: 'Listen on Tidal', color: '#000000', url: `https://listen.tidal.com/search?q=${q}` },
        ],
      };
    case 'podcast':
      return {
        emoji: '🎙',
        label: 'Where to listen',
        gradient: ['#0a1a2e', '#A855F7'],
        stores: [
          { name: 'Spotify', logo: '🟢', logoUrl: 'https://www.google.com/s2/favicons?domain=spotify.com&sz=64', price: 'Free', cta: 'Listen on Spotify', color: '#1DB954', url: externalId ? `https://open.spotify.com/show/${externalId}` : `https://open.spotify.com/search/${q}/podcasts` },
          { name: 'Apple Podcasts', logo: '🎙', logoUrl: 'https://www.google.com/s2/favicons?domain=podcasts.apple.com&sz=64', price: 'Free', cta: 'Listen on Apple', color: '#9B59B6', url: `https://podcasts.apple.com/search?term=${q}` },
          { name: 'YouTube', logo: '▶', logoUrl: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64', price: 'Free with video', cta: 'Watch on YouTube', color: '#FF0000', url: `https://www.youtube.com/results?search_query=${q}+podcast` },
          { name: 'Amazon Music', logo: '📦', logoUrl: 'https://www.google.com/s2/favicons?domain=music.amazon.com&sz=64', price: 'Free', cta: 'Listen on Amazon', color: '#FF9900', url: `https://music.amazon.com/search/${q}` },
        ],
      };
    case 'cinema':
      return {
        emoji: '🎟',
        label: 'Showtimes & tickets',
        gradient: ['#120508', '#6B1010'],
        stores: [
          { name: 'Google Showtimes', logo: '📍', logoUrl: 'https://www.google.com/s2/favicons?domain=google.com&sz=64', price: 'Local listings near you', cta: 'Find showtimes', color: '#4285F4', url: `https://www.google.com/search?q=${q}+showtimes` },
          { name: 'Fandango', logo: '🎟', logoUrl: 'https://www.google.com/s2/favicons?domain=fandango.com&sz=64', price: 'US theaters', cta: 'Buy on Fandango', color: '#FF6B00', url: `https://www.fandango.com/search?q=${q}` },
          { name: 'Atom Tickets', logo: '🔵', logoUrl: 'https://www.google.com/s2/favicons?domain=atomtickets.com&sz=64', price: 'US theaters — skip the line', cta: 'Buy on Atom', color: '#00ADEF', url: `https://www.atomtickets.com/movies/search?q=${q}` },
          { name: 'Odeon', logo: '🎬', logoUrl: 'https://www.google.com/s2/favicons?domain=odeon.co.uk&sz=64', price: 'UK cinemas', cta: 'Find on Odeon', color: '#1A1A1A', url: `https://www.odeon.co.uk/films/?search_term=${q}` },
          { name: 'Vue', logo: '🎦', logoUrl: 'https://www.google.com/s2/favicons?domain=myvue.com&sz=64', price: 'UK & European cinemas', cta: 'Find on Vue', color: '#1A1A1A', url: `https://www.myvue.com/movies?search=${q}` },
        ],
      };
    default:
      return {
        emoji: '🔍',
        label: 'Find it online',
        gradient: ['#1a1a2e', '#16213e'],
        stores: [
          { name: 'Google', logo: '🔍', price: 'Search', cta: 'Search on Google', color: '#4285F4', url: `https://www.google.com/search?q=${q}` },
        ],
      };
  }
}

export const WHERE_TO_FIND_CTA: Record<EntryType, string> = {
  watch: '▶ Where to watch',
  read: '📖 Buy this book',
  play: '🎮 Get this game',
  listen: '🎧 Stream & buy',
  podcast: '🎙 Listen now',
};
