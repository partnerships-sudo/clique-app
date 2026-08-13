import type { Metadata } from 'next';
import { createClient } from '@web/lib/supabase/server';
import { ProfileClient } from './profile-client';

export async function generateMetadata(
  { params }: { params: Promise<{ username: string }> }
): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, bio, avatar_url')
    .eq('username', username)
    .single();

  if (!profile) {
    return { title: `@${username} not found` };
  }

  const displayName = profile.full_name ?? `@${profile.username}`;
  const description = profile.bio
    ?? `Follow ${displayName} on Clique to see what they're watching, reading, and playing.`;

  return {
    title: `${displayName} (@${profile.username})`,
    description,
    openGraph: {
      title: `${displayName} (@${profile.username}) · Clique`,
      description,
      url: `https://clique.app/${profile.username}`,
      ...(profile.avatar_url ? { images: [{ url: profile.avatar_url, width: 400, height: 400 }] } : {}),
    },
    twitter: {
      card: profile.avatar_url ? 'summary' : 'summary',
      title: `${displayName} (@${profile.username}) · Clique`,
      description,
      ...(profile.avatar_url ? { images: [profile.avatar_url] } : {}),
    },
  };
}

export default async function ProfilePage(
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  return <ProfileClient username={username} />;
}
