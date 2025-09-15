import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as firebaseSignOut,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { firestoreService, type User } from './firestore-service';

export class AuthService {
  private googleProvider: GoogleAuthProvider;

  constructor() {
    this.googleProvider = new GoogleAuthProvider();
    // Request additional scopes if needed
    this.googleProvider.addScope('email');
    this.googleProvider.addScope('profile');
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<User> {
    try {
      const result = await signInWithPopup(auth, this.googleProvider);
      const firebaseUser = result.user;

      // Create or update user in Firestore
      const user = await this.createOrUpdateUser(firebaseUser);
      return user;
    } catch (error) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Create or update user in Firestore
  private async createOrUpdateUser(firebaseUser: FirebaseUser): Promise<User> {
    const now = Date.now();
    
    // Check if user already exists
    const existingUser = await firestoreService.read<User>('users', firebaseUser.uid);
    
    const userData: User = {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || undefined,
      email: firebaseUser.email || undefined,
      image: firebaseUser.photoURL || undefined,
      emailVerificationTime: firebaseUser.emailVerified ? now : undefined,
      isAnonymous: false,
      createdAt: existingUser?.createdAt || now,
      updatedAt: now,
      // Preserve existing user preferences
      ...existingUser,
      // Update with latest auth data
      name: firebaseUser.displayName || existingUser?.name,
      email: firebaseUser.email || existingUser?.email,
      image: firebaseUser.photoURL || existingUser?.image,
    };

    // Use set with merge to create or update
    await firestoreService.create<User>('users', {
      ...userData,
      id: firebaseUser.uid,
    });

    return userData;
  }

  // Get current user data from Firestore
  async getCurrentUser(): Promise<User | null> {
    if (!auth.currentUser) {
      return null;
    }
    
    return await firestoreService.read<User>('users', auth.currentUser.uid);
  }

  // Update user profile
  async updateUserProfile(updates: Partial<User>): Promise<void> {
    if (!auth.currentUser) {
      throw new Error('Not authenticated');
    }

    await firestoreService.update<User>('users', auth.currentUser.uid, updates);
  }

  // Delete user account and all associated data
  async deleteAccount(): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const userId = currentUser.uid;

    try {
      // Get all user's data for cleanup
      const [chats, messages, attachments, feedback, apiKeys] = await Promise.all([
        firestoreService.queryCollection<any>('chats', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }),
        firestoreService.queryCollection<any>('messages', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }),
        firestoreService.queryCollection<any>('chat_attachments', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }),
        firestoreService.queryCollection<any>('feedback', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }),
        firestoreService.queryCollection<any>('user_api_keys', {
          where: [{ field: 'userId', operator: '==', value: userId }]
        }),
      ]);

      // Prepare batch operations for cleanup
      const batchOperations: Array<{
        type: 'delete';
        collection: string;
        id: string;
      }> = [];

      // Add all documents to be deleted
      for (const chat of chats) {
        batchOperations.push({ type: 'delete', collection: 'chats', id: chat.id });
      }
      for (const message of messages) {
        batchOperations.push({ type: 'delete', collection: 'messages', id: message.id });
      }
      for (const attachment of attachments) {
        batchOperations.push({ type: 'delete', collection: 'chat_attachments', id: attachment.id });
      }
      for (const fb of feedback) {
        batchOperations.push({ type: 'delete', collection: 'feedback', id: fb.id });
      }
      for (const key of apiKeys) {
        batchOperations.push({ type: 'delete', collection: 'user_api_keys', id: key.id });
      }

      // Delete user document
      batchOperations.push({ type: 'delete', collection: 'users', id: userId });

      // Execute batch deletion
      await firestoreService.batchWrite(batchOperations);

      // Delete Firebase Auth user
      await currentUser.delete();
    } catch (error) {
      console.error('Error deleting account:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();