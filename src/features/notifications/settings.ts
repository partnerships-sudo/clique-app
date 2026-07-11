import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export interface NotificationSettings {
  messages: boolean;
  friend_requests: boolean;
  reactions: boolean;
  recommendations: boolean;
  daily_nudge: boolean;
  rating_reminders: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  messages: true,
  friend_requests: true,
  reactions: true,
  recommendations: true,
  daily_nudge: true,
  rating_reminders: true,
};

export function useNotificationSettings() {
  const { user } = useSession();
  const queryClient = useQueryClient();
  const queryKey = ['notification-settings', user?.id];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_settings')
        .select('messages, friend_requests, reactions, recommendations, daily_nudge, rating_reminders')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data as NotificationSettings | null) ?? DEFAULT_SETTINGS;
    },
    enabled: !!user,
  });

  const settings = query.data ?? DEFAULT_SETTINGS;

  const update = useMutation({
    mutationFn: async (patch: Partial<NotificationSettings>) => {
      const { error } = await supabase
        .from('notification_settings')
        .upsert({ user_id: user!.id, ...settings, ...patch });
      if (error) throw error;
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationSettings>(queryKey);
      queryClient.setQueryData(queryKey, { ...settings, ...patch });
      return { previous };
    },
    onError: (_err, _patch, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    settings,
    isLoading: query.isLoading,
    setCategory: (category: keyof NotificationSettings, value: boolean) => update.mutate({ [category]: value }),
  };
}
