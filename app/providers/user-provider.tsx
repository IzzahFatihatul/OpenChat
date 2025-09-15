'use client';

import { createContext, useCallback, useContext, useMemo } from 'react';
import { useAuth } from '@/lib/firebase/auth-provider';
import { 
  useCurrentUser, 
  useSignInWithGoogle, 
  useSignOut,
  useUpdateUserProfile 
} from '@/lib/firebase/hooks';
import type { User } from '@/lib/firebase/firestore-service';

export type UserProfile = User;

export type ApiKey = {
  id: string;
  provider: string;
  mode?: 'priority' | 'fallback';
  messageCount?: number;
  createdAt?: number;
  updatedAt?: number;
};

export type Connector = {
  id: string;
  userId: string;
  type: string;
  isConnected: boolean;
  createdAt: number;
  updatedAt: number;
};

type UserContextType = {
  user: UserProfile | null;
  isLoading: boolean;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  // User capabilities and settings
  hasPremium: boolean;
  products: { premium?: { id: string } } | undefined;
  rateLimitStatus:
    | {
        isPremium: boolean;
        dailyCount: number;
        dailyLimit: number;
        dailyRemaining: number;
        monthlyCount: number;
        monthlyLimit: number;
        monthlyRemaining: number;
        premiumCount: number;
        premiumLimit: number;
        premiumRemaining: number;
        effectiveRemaining: number;
        dailyReset?: number;
        monthlyReset?: number;
        premiumReset?: number;
      }
    | undefined;
  // API Keys
  apiKeys: ApiKey[];
  hasApiKey: Map<string, boolean>;
  hasOpenAI: boolean;
  hasAnthropic: boolean;
  hasGemini: boolean;
  isApiKeysLoading: boolean;
  // Connectors
  connectors: Connector[];
  isConnectorsLoading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
}: {
  children: React.ReactNode;
  initialUser?: null;
}) {
  const { user: firebaseUser } = useAuth();
  const signInWithGoogle = useSignInWithGoogle();
  const signOutMutation = useSignOut();
  const updateUserProfile = useUpdateUserProfile();

  // Fetch user data from Firestore
  const { 
    data: user = null, 
    isLoading: isUserLoading 
  } = useCurrentUser();

  // For now, disable premium features and related functionality
  // These will be implemented with Firebase Functions later
  const hasPremium = false;
  const products = undefined;
  const rateLimitStatus = undefined;
  const apiKeys: ApiKey[] = [];
  const connectors: Connector[] = [];
  
  const isApiKeysLoading = false;
  const isConnectorsLoading = false;

  const signInGoogle = useCallback(async () => {
    await signInWithGoogle.mutateAsync();
  }, [signInWithGoogle]);

  const signOut = useCallback(async () => {
    await signOutMutation.mutateAsync();
  }, [signOutMutation]);

  const updateUser = useCallback(
    async (updates: Partial<UserProfile>) => {
      await updateUserProfile.mutateAsync(updates);
    },
    [updateUserProfile]
  );

  const hasApiKey = useMemo(() => {
    const keyMap = new Map<string, boolean>();
    for (const key of apiKeys) {
      keyMap.set(key.provider, true);
    }
    return keyMap;
  }, [apiKeys]);

  const hasOpenAI = hasApiKey.get('openai') ?? false;
  const hasAnthropic = hasApiKey.get('anthropic') ?? false;
  const hasGemini = hasApiKey.get('gemini') ?? false;

  // Combined loading state for user-related data
  const combinedLoading = Boolean(
    isUserLoading ||
    signInWithGoogle.isPending ||
    signOutMutation.isPending ||
    updateUserProfile.isPending
  );

  const contextValue = useMemo(
    () => ({
      user,
      isLoading: combinedLoading,
      signInGoogle,
      signOut,
      updateUser,
      // User capabilities and settings (disabled for now)
      hasPremium,
      products,
      rateLimitStatus,
      // API Keys (disabled for now)
      apiKeys,
      hasApiKey,
      hasOpenAI,
      hasAnthropic,
      hasGemini,
      isApiKeysLoading,
      // Connectors (disabled for now)
      connectors,
      isConnectorsLoading,
    }),
    [
      user,
      combinedLoading,
      signInGoogle,
      signOut,
      updateUser,
      hasPremium,
      products,
      rateLimitStatus,
      apiKeys,
      hasApiKey,
      hasOpenAI,
      hasAnthropic,
      hasGemini,
      isApiKeysLoading,
      connectors,
      isConnectorsLoading,
    ]
  );

  return (
    <UserContext.Provider value={contextValue}>{children}</UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
