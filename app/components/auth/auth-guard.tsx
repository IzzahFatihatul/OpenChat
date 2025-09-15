'use client';

import { useAuth } from '@/lib/firebase/auth-provider';
import { ChatSessionProvider } from '@/app/providers/chat-session-provider';
import { CSPostHogProvider } from '@/app/providers/posthog-provider';
import { UserProvider } from '@/app/providers/user-provider';
import { Loader } from '@/components/prompt-kit/loader';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { AnonymousSignIn } from './anonymous-sign-in';

type AuthGuardProps = {
  children: React.ReactNode;
};

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading, error } = useAuth();

  return (
    <ThemeProvider>
      {/* Auth Loading State */}
      {loading && (
        <div className="flex h-dvh items-center justify-center bg-background">
          <Loader size="lg" variant="dots" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex h-dvh items-center justify-center bg-background">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Authentication Error</h1>
            <p className="text-muted-foreground mb-4">{error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Unauthenticated State */}
      {!loading && !error && !user && <AnonymousSignIn />}

      {/* Authenticated State */}
      {!loading && !error && user && (
        <UserProvider>
          <CSPostHogProvider>
            <ChatSessionProvider>
              <Toaster position="top-center" />
              {children}
            </ChatSessionProvider>
          </CSPostHogProvider>
        </UserProvider>
      )}
    </ThemeProvider>
  );
}
