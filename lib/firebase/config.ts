import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions,
} from 'firebase/functions';

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

// Get Firebase config from environment variables
const getFirebaseConfig = (): FirebaseConfig => {
  const config: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  if (process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID) {
    config.measurementId = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID;
  }

  // Validate required config
  const requiredFields: (keyof FirebaseConfig)[] = [
    'apiKey',
    'authDomain',
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId',
  ];

  for (const field of requiredFields) {
    if (!config[field]) {
      throw new Error(
        `Missing required Firebase configuration: NEXT_PUBLIC_FIREBASE_${field.toUpperCase().replace(/([A-Z])/g, '_$1')}`
      );
    }
  }

  return config;
};

// Initialize Firebase app
let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let functions: Functions;

try {
  const config = getFirebaseConfig();
  app = initializeApp(config);
  auth = getAuth(app);
  firestore = getFirestore(app);
  functions = getFunctions(app);

  // Connect to emulators in development
  if (process.env.NODE_ENV === 'development') {
    const isEmulatorConnected = {
      auth: false,
      firestore: false,
      functions: false,
    };

    // Only connect once to avoid errors
    if (!isEmulatorConnected.auth && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR) {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099');
      isEmulatorConnected.auth = true;
    }

    if (!isEmulatorConnected.firestore && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR) {
      connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
      isEmulatorConnected.firestore = true;
    }

    if (!isEmulatorConnected.functions && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR) {
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
      isEmulatorConnected.functions = true;
    }
  }
} catch (error) {
  console.error('Failed to initialize Firebase:', error);
  throw error;
}

export { app, auth, firestore, functions };
export type { FirebaseConfig };