import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

// Using React Query's cache as the shared in-memory store so that all hook
// instances (chats list, tab badge, unread count) update together instantly
// when any one of them calls markRead.

const CHAT_STORAGE_KEY = 'tm_chats_read';
const GROUP_STORAGE_KEY = 'tm_groups_read';
const DM_STORAGE_KEY = 'tm_dms_read';

export function useChatReadState() {
  const queryClient = useQueryClient();
  const { data: readMap = {}, isLoading } = useQuery({
    queryKey: ['read-state-chat'],
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(CHAT_STORAGE_KEY);
      return (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const markRead = useCallback(
    (title: string) => {
      const next = { ...readMap, [title]: new Date().toISOString() };
      AsyncStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      queryClient.setQueryData(['read-state-chat'], next);
    },
    [readMap, queryClient],
  );

  const isUnread = useCallback(
    (title: string, messageTime: string) => {
      const lastRead = readMap[title];
      if (!lastRead) return true;
      return new Date(messageTime) > new Date(lastRead);
    },
    [readMap],
  );

  return { loaded: !isLoading, markRead, isUnread };
}

export function useGroupReadState() {
  const queryClient = useQueryClient();
  const { data: readMap = {}, isLoading } = useQuery({
    queryKey: ['read-state-group'],
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(GROUP_STORAGE_KEY);
      return (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const markRead = useCallback(
    (groupId: string) => {
      const next = { ...readMap, [groupId]: new Date().toISOString() };
      AsyncStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      queryClient.setQueryData(['read-state-group'], next);
    },
    [readMap, queryClient],
  );

  const isUnread = useCallback(
    (groupId: string, messageTime: string) => {
      const lastRead = readMap[groupId];
      if (!lastRead) return true;
      return new Date(messageTime) > new Date(lastRead);
    },
    [readMap],
  );

  return { loaded: !isLoading, markRead, isUnread };
}

export function useDmReadState() {
  const queryClient = useQueryClient();
  const { data: readMap = {}, isLoading } = useQuery({
    queryKey: ['read-state-dm'],
    queryFn: async () => {
      const raw = await AsyncStorage.getItem(DM_STORAGE_KEY);
      return (raw ? JSON.parse(raw) : {}) as Record<string, string>;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const markRead = useCallback(
    (friendId: string) => {
      const next = { ...readMap, [friendId]: new Date().toISOString() };
      AsyncStorage.setItem(DM_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      queryClient.setQueryData(['read-state-dm'], next);
    },
    [readMap, queryClient],
  );

  const isUnread = useCallback(
    (friendId: string, messageTime: string) => {
      const lastRead = readMap[friendId];
      if (!lastRead) return true;
      return new Date(messageTime) > new Date(lastRead);
    },
    [readMap],
  );

  return { loaded: !isLoading, markRead, isUnread };
}
