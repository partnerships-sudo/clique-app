import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface StoryViewer {
  viewer_id: string;
  viewer_name: string;
  viewer_avatar_url: string | null;
  created_at: string;
}

export interface StoryLiker {
  from_user_id: string;
  from_user_name: string;
  from_avatar_url: string | null;
  created_at: string;
}

export function useRecordStoryView() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, postAuthorId }: { postId: string; postAuthorId: string }) => {
      if (postAuthorId === user!.id) return;
      const name = user?.user_metadata?.full_name ?? user?.email ?? 'Someone';
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user!.id)
        .maybeSingle();
      await supabase.from('story_views').upsert({
        post_id: postId,
        viewer_id: user!.id,
        viewer_name: name,
        viewer_avatar_url: profile?.avatar_url ?? null,
      }, { onConflict: 'post_id,viewer_id', ignoreDuplicates: true });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['story-activity', vars.postId] });
      queryClient.invalidateQueries({ queryKey: ['story-views-mine'] });
    },
  });
}

export function useSeenStoryIds() {
  const { user } = useSession();
  return useQuery({
    queryKey: ['story-views-mine', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('story_views')
        .select('post_id')
        .eq('viewer_id', user!.id);
      return (data ?? []).map((r) => r.post_id as string);
    },
    enabled: !!user,
    staleTime: 10_000,
  });
}

export function useStoryActivity(postId: string | undefined) {
  const { user } = useSession();
  return useQuery({
    queryKey: ['story-activity', postId],
    queryFn: async () => {
      const [viewsRes, likesRes] = await Promise.all([
        supabase
          .from('story_views')
          .select('viewer_id, viewer_name, viewer_avatar_url, created_at')
          .eq('post_id', postId!)
          .order('created_at', { ascending: false }),
        supabase
          .from('notifications')
          .select('from_user_id, from_user_name, from_avatar_url:from_user_id, created_at')
          .eq('post_id', postId!)
          .eq('type', 'story_like')
          .order('created_at', { ascending: false }),
      ]);

      const viewers: StoryViewer[] = (viewsRes.data ?? []).map((v) => ({
        viewer_id: v.viewer_id,
        viewer_name: v.viewer_name,
        viewer_avatar_url: v.viewer_avatar_url,
        created_at: v.created_at,
      }));

      // Fetch avatars for likers from profiles
      const likerIds = (likesRes.data ?? []).map((l) => l.from_user_id);
      const avatarMap: Record<string, string | null> = {};
      if (likerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, avatar_url')
          .in('id', likerIds);
        for (const p of profiles ?? []) avatarMap[p.id] = p.avatar_url ?? null;
      }

      const likers: StoryLiker[] = (likesRes.data ?? []).map((l) => ({
        from_user_id: l.from_user_id,
        from_user_name: l.from_user_name,
        from_avatar_url: avatarMap[l.from_user_id] ?? null,
        created_at: l.created_at,
      }));

      return { viewers, likers };
    },
    enabled: !!postId && !!user,
    staleTime: 30_000,
  });
}
