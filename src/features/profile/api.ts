import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface Profile {
  id: string;
  full_name: string | null;
  username: string | null;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  rating_icon: string | null;
  collection_share_books: boolean;
  collection_share_movies: boolean;
  collection_share_music: boolean;
  collection_share_games: boolean;
  collection_share_podcasts: boolean;
  featured_badges: string[];
  is_private: boolean;
  content_types: string[];
  last_seen_at: string | null;
  show_online_status: boolean;
  show_read_receipts: boolean;
  verified_tier: number;
}

function profileQueryKey(userId: string | undefined) {
  return ['profile', userId] as const;
}

export function useProfile() {
  const { user } = useSession();
  return useQuery({
    queryKey: profileQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!user,
  });
}

export function useProfileById(userId: string | undefined) {
  return useQuery({
    queryKey: profileQueryKey(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
    enabled: !!userId,
    staleTime: 0,
    refetchOnMount: 'always',
  });
}

export type UpdateProfileInput = {
  full_name: string;
  username: string;
  location: string;
  bio: string;
  rating_icon: string;
};

export function useUpdateProfile() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const cleanUsername = input.username.replace('@', '');
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: input.full_name,
          username: cleanUsername,
          location: input.location,
          bio: input.bio,
          rating_icon: input.rating_icon,
        })
        .eq('id', user!.id);
      if (error) throw error;
      await supabase.auth.updateUser({
        data: {
          full_name: input.full_name,
          username: cleanUsername,
          location: input.location,
          bio: input.bio,
          rating_icon: input.rating_icon,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUpdateContentTypes() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (types: string[]) => {
      const { error } = await supabase
        .from('profiles')
        .update({ content_types: types })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUpdateRatingIcon() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ratingIcon: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ rating_icon: ratingIcon })
        .eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUpdateCollectionSharing() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      shareBooks?: boolean;
      shareMovies?: boolean;
      shareMusic?: boolean;
      shareGames?: boolean;
      sharePodcasts?: boolean;
    }) => {
      const patch: Record<string, boolean> = {};
      if (input.shareBooks !== undefined) patch.collection_share_books = input.shareBooks;
      if (input.shareMovies !== undefined) patch.collection_share_movies = input.shareMovies;
      if (input.shareMusic !== undefined) patch.collection_share_music = input.shareMusic;
      if (input.shareGames !== undefined) patch.collection_share_games = input.shareGames;
      if (input.sharePodcasts !== undefined) patch.collection_share_podcasts = input.sharePodcasts;
      const { error } = await supabase.from('profiles').update(patch).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUpdatePrivacy() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (isPrivate: boolean) => {
      const { error } = await supabase.from('profiles').update({ is_private: isPrivate }).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUpdatePresenceSettings() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { show_online_status?: boolean; show_read_receipts?: boolean }) => {
      const { error } = await supabase.from('profiles').update(input).eq('id', user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUploadAvatar() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (localUri: string) => {
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `${user!.id}/avatar.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);
      if (updateError) throw updateError;
      await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });
      return avatarUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}

export function useUploadBanner() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (localUri: string) => {
      const response = await fetch(localUri);
      const arrayBuffer = await response.arrayBuffer();
      const path = `${user!.id}/banner.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const bannerUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ banner_url: bannerUrl })
        .eq('id', user!.id);
      if (updateError) throw updateError;
      return bannerUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: profileQueryKey(user?.id) });
    },
  });
}
