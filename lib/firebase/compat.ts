// Utility functions to help migrate from Convex types to Firebase types
import type { User as FirebaseUser } from '@/lib/firebase/firestore-service';

// Convex-style user type (for compatibility with existing components)
export interface ConvexUser {
  _id: string;
  _creationTime: number;
  name?: string;
  image?: string;
  email?: string;
  emailVerificationTime?: number;
  isAnonymous?: boolean;
  preferredModel?: string;
  preferredName?: string;
  occupation?: string;
  traits?: string;
  about?: string;
  disabledModels?: string[];
  favoriteModels?: string[];
}

// Convert Firebase User to Convex-style User for compatibility
export function firebaseUserToConvex(user: FirebaseUser): ConvexUser {
  return {
    _id: user.id,
    _creationTime: user.createdAt,
    name: user.name,
    image: user.image,
    email: user.email,
    emailVerificationTime: user.emailVerificationTime,
    isAnonymous: user.isAnonymous,
    preferredModel: user.preferredModel,
    preferredName: user.preferredName,
    occupation: user.occupation,
    traits: user.traits,
    about: user.about,
    disabledModels: user.disabledModels,
    favoriteModels: user.favoriteModels,
  };
}

// Convert Convex-style User to Firebase User (for updates)
export function convexUserToFirebase(user: ConvexUser): Partial<FirebaseUser> {
  return {
    name: user.name,
    image: user.image,
    email: user.email,
    emailVerificationTime: user.emailVerificationTime,
    isAnonymous: user.isAnonymous,
    preferredModel: user.preferredModel,
    preferredName: user.preferredName,
    occupation: user.occupation,
    traits: user.traits,
    about: user.about,
    disabledModels: user.disabledModels,
    favoriteModels: user.favoriteModels,
  };
}

// Convex-style connector type (for compatibility)
export interface ConvexConnector {
  _id: string;
  _creationTime: number;
  type: string;
  enabled?: boolean;
  userId: string;
  isConnected: boolean;
  createdAt: number;
  updatedAt: number;
}

// Convert Firebase Connector to Convex-style for compatibility
export function firebaseConnectorToConvex(connector: any): ConvexConnector {
  return {
    _id: connector.id,
    _creationTime: connector.createdAt,
    type: connector.type,
    enabled: connector.isConnected,
    userId: connector.userId,
    isConnected: connector.isConnected,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  };
}