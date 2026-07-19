import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export type NotificationKind = 'new_follower' | 'follow_request' | 'follow_accepted' | 'reaction' | 'message' | 'story_like' | 'rate_reminder';

export interface ActivityItem {
  id: string;
  kind: NotificationKind;
  fromUserId: string;
  fromUserName: string;
  fromAvatarUrl: string | null;
  message: string;
  read: boolean;
  createdAt: string;
  /** For reactions: the post they reacted to */
  postId?: string;
  postTitle?: string;
  postType?: string;
  postPoster?: string | null;
}

function inboxKey(userId: string | undefined) {
  return ['inbox', userId] as const;
}

export function useInbox() {
  const { user } = useSession();

  return useQuery({
    queryKey: inboxKey(user?.id),
    queryFn: async (): Promise<ActivityItem[]> => {
      // 1. Fetch in-app notifications (follows)
      const { data: notifs, error: notifErr } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (notifErr) throw notifErr;

      // 2. Fetch my posts so we can find reactions on them
      const { data: myPosts, error: postErr } = await supabase
        .from('posts')
        .select('id, title, type, poster')
        .eq('user_id', user!.id)
        .limit(100);
      if (postErr) throw postErr;

      const myPostIds = (myPosts ?? []).map((p) => p.id);
      const postById = Object.fromEntries(
        (myPosts ?? []).map((p) => [p.id, { title: p.title as string, type: p.type as string, poster: p.poster as string | null }]),
      );

      // 3. Fetch reactions on my posts from other people
      let reactionItems: ActivityItem[] = [];
      if (myPostIds.length) {
        const { data: reactions, error: reactionErr } = await supabase
          .from('reactions')
          .select('id, post_id, user_id, user_name, created_at')
          .in('post_id', myPostIds)
          .neq('user_id', user!.id)
          .order('created_at', { ascending: false })
          .limit(50);
        if (reactionErr) throw reactionErr;

        // Fetch avatars for reacting users
        const reactorIds = [...new Set((reactions ?? []).map((r) => r.user_id))];
        const avatarMap: Record<string, string | null> = {};
        if (reactorIds.length) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', reactorIds);
          for (const p of profiles ?? []) avatarMap[p.id] = p.avatar_url ?? null;
        }

        reactionItems = (reactions ?? []).map((r) => ({
          id: `reaction:${r.id}`,
          kind: 'reaction' as NotificationKind,
          fromUserId: r.user_id,
          fromUserName: r.user_name,
          fromAvatarUrl: avatarMap[r.user_id] ?? null,
          message: `${r.user_name} reacted "Me too!" to your post`,
          read: true,
          createdAt: r.created_at,
          postId: r.post_id,
          postTitle: postById[r.post_id]?.title,
          postType: postById[r.post_id]?.type,
          postPoster: postById[r.post_id]?.poster ?? null,
        }));
      }

      const notifItems: ActivityItem[] = (notifs ?? []).map((n) => ({
        id: n.id,
        kind: n.type as NotificationKind,
        fromUserId: n.from_user_id,
        fromUserName: n.from_user_name,
        fromAvatarUrl: null,
        message: n.message,
        read: n.read ?? false,
        createdAt: n.created_at,
        postId: n.post_id ?? undefined,
        postTitle: n.post_title ?? undefined,
        postType: n.post_type ?? undefined,
        postPoster: n.post_poster ?? null,
      }));

      // Fetch avatars for notification senders
      const senderIds = [...new Set(notifItems.map((n) => n.fromUserId).filter(Boolean))];
      if (senderIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', senderIds);
        const avatarMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.avatar_url as string | null]));
        for (const item of notifItems) {
          item.fromAvatarUrl = avatarMap[item.fromUserId] ?? null;
        }
      }

      const all = [...notifItems, ...reactionItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return all;
    },
    enabled: !!user,
    staleTime: 30_000,
    
  });
}

export function useUnreadCount() {
  const { data: items } = useInbox();
  return (items ?? []).filter((i) => !i.read).length;
}

export function useMarkAllRead() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user!.id)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKey(user?.id) });
    },
  });
}
