'use client';

import { useEffect, useRef, useState } from 'react';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Loader } from '@/components/prompt-kit/loader';
import { Button } from '@/components/ui/button';
import { GoogleIcon } from '@/components/icons/google';
import { useSignInWithGoogle } from '@/lib/firebase/hooks';

export function AnonymousSignIn() {
  const signInWithGoogle = useSignInWithGoogle();
  const attemptedAnon = useRef(false);
  const [error, setError] = useState<string | null>(null);

  // Handle anonymous sign-in when user is unauthenticated
  useEffect(() => {
    if (!attemptedAnon.current) {
      attemptedAnon.current = true;
      signInAnonymously(auth).catch((error) => {
        console.error('Anonymous sign-in failed:', error);
        setError('Failed to initialize app. Please try signing in manually.');
      });
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setError(null);
      await signInWithGoogle.mutateAsync();
    } catch (error) {
      console.error('Google sign-in failed:', error);
      setError('Failed to sign in with Google. Please try again.');
    }
  };

  if (error) {
    return (
      <div className="flex h-dvh items-center justify-center bg-background">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Sign In Required</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button 
            onClick={handleGoogleSignIn}
            disabled={signInWithGoogle.isPending}
            className="flex items-center gap-2"
          >
            <GoogleIcon className="w-4 h-4" />
            {signInWithGoogle.isPending ? 'Signing in...' : 'Sign in with Google'}
          </Button>
        </div>
      </div>
    );
  }

  // Show loading while anonymous sign-in is processing
  return (
    <div className="flex h-dvh items-center justify-center bg-background">
      <Loader size="lg" variant="dots" />
    </div>
  );
}
