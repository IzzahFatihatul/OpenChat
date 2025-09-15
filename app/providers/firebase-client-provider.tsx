'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { AuthProvider } from '@/lib/firebase/auth-provider';
import { FirestoreProvider } from '@/lib/firebase/firestore-provider';

export function FirebaseClientProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          // Cache time: Data stays in cache for 5 minutes after becoming unused
          gcTime: 5 * 60 * 1000,
          // Stale time: Data is considered fresh for 1 minute
          staleTime: 1 * 60 * 1000,
          // Retry failed queries up to 3 times
          retry: 3,
          // Retry with exponential backoff
          retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
        },
        mutations: {
          // Retry failed mutations once
          retry: 1,
        },
      },
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <FirestoreProvider>
          {children}
          {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
        </FirestoreProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}