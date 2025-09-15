'use client';

import { createContext, useContext } from 'react';
import { firestore } from '@/lib/firebase/config';
import type { Firestore } from 'firebase/firestore';

const FirestoreContext = createContext<Firestore | null>(null);

export function useFirestore() {
  const context = useContext(FirestoreContext);
  if (!context) {
    throw new Error('useFirestore must be used within a FirestoreProvider');
  }
  return context;
}

export function FirestoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <FirestoreContext.Provider value={firestore}>
      {children}
    </FirestoreContext.Provider>
  );
}