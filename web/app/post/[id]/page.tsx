import type { Metadata } from 'next';
import { createClient } from '@web/lib/supabase/server';
import { PostClient } from './post-client';

const TYPE_LABEL: Record<string, string> = {
  watch: 'Watched', read: 'Read', play: 'Played',
  listen: 'Listened to', podcast: 'Listened to',
};

export async function generateMetadata(
  { params }: { params: Promise<{ id: string }> }
): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from('posts')
    .select('title, sub, type, note, poster, user_id')
    .eq('id', id)
    .single();

  if (!post) return { title: 'Post not found' };

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, full_name')
    .eq('id', post.user_id)
    .single();

  const action = TYPE_LABEL[post.type] ?? 'Logged';
  const who = profile?.full_name ?? profile?.username ?? 'Someone';
  const title = `${who} ${action}: ${post.title}`;
  const description = post.note
    ?? (post.sub ? `${post.title} · ${post.sub}` : post.title);

  return {
    title,
    description,
    openGraph: {
      title: `${title} · Clique`,
      description,
      url: `https://clique.app/post/${id}`,
      ...(post.poster ? { images: [{ url: post.poster, width: 342, height: 513 }] } : {}),
    },
    twitter: {
      card: post.poster ? 'summary_large_image' : 'summary',
      title: `${title} · Clique`,
      description,
      ...(post.poster ? { images: [post.poster] } : {}),
    },
  };
}

export default async function PostPage(
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return <PostClient id={id} />;
}
