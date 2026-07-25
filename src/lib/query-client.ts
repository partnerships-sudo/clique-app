import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 5 * 60_000,  // 5 minutes — prevents refetch every time you switch apps
      refetchOnWindowFocus: false,
    },
  },
});
