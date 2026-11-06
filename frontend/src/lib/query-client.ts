import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && (error.status === 401 || error.status === 403 || error.status === 404)) {
          return false;
        }
        return failureCount < 1;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

export async function invalidateLedgerQueries(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: ['accounts'] }),
    client.invalidateQueries({ queryKey: ['balance'] }),
    client.invalidateQueries({ queryKey: ['transactionHistory'] }),
    client.invalidateQueries({ queryKey: ['transactions'] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ]);
}
