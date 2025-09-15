import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  addDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  type Firestore,
  type DocumentReference,
  type QueryDocumentSnapshot,
  type DocumentData,
  type CollectionReference,
  type Query,
  type WhereFilterOp,
  type OrderByDirection,
} from 'firebase/firestore';
import { firestore } from '@/lib/firebase/config';

// Type definitions for our collections
export interface User {
  uid: string;
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
  createdAt: number;
  updatedAt: number;
}

export interface Chat {
  id: string;
  userId: string;
  title?: string;
  model?: string;
  personaId?: string;
  createdAt: number;
  updatedAt: number;
  originalChatId?: string;
  isPinned?: boolean;
  public?: boolean;
  shareAttachments?: boolean;
}

export interface Message {
  id: string;
  chatId: string;
  userId?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: any;
  createdAt: number;
  parentMessageId?: string;
  metadata: {
    modelId?: string;
    modelName?: string;
    inputTokens?: number;
    outputTokens?: number;
    reasoningTokens?: number;
    totalTokens?: number;
    cachedInputTokens?: number;
    serverDurationMs?: number;
    includeSearch?: boolean;
    reasoningEffort?: string;
  };
}

export interface ChatAttachment {
  id: string;
  chatId: string;
  userId: string;
  key: string;
  filename: string;
  contentType: string;
  size: number;
  url?: string;
  createdAt: number;
}

export interface UserApiKey {
  id: string;
  userId: string;
  provider: string;
  encryptedKey: string;
  createdAt: number;
  updatedAt: number;
}

export interface Feedback {
  id: string;
  userId: string;
  messageId?: string;
  rating: number;
  comment?: string;
  createdAt: number;
}

export interface UsageHistory {
  id: string;
  userId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  totalTokens: number;
  cost?: number;
  createdAt: number;
}

// Generic helper functions for Firestore operations
export class FirestoreService {
  private db: Firestore;

  constructor(firestore: Firestore) {
    this.db = firestore;
  }

  // Collection helpers
  getCollection<T = DocumentData>(collectionName: string): CollectionReference<T> {
    return collection(this.db, collectionName) as CollectionReference<T>;
  }

  getDoc<T = DocumentData>(collectionName: string, id: string): DocumentReference<T> {
    return doc(this.db, collectionName, id) as DocumentReference<T>;
  }

  // Generic CRUD operations
  async create<T extends { id?: string }>(
    collectionName: string,
    data: Omit<T, 'id'> & { id?: string }
  ): Promise<string> {
    const now = Date.now();
    const docData = {
      ...data,
      createdAt: now,
      updatedAt: now,
    };

    if (data.id) {
      await setDoc(this.getDoc(collectionName, data.id), docData);
      return data.id;
    } else {
      const docRef = await addDoc(this.getCollection(collectionName), docData);
      return docRef.id;
    }
  }

  async read<T = DocumentData>(collectionName: string, id: string): Promise<T | null> {
    const docRef = this.getDoc(collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data(),
      } as T;
    }
    return null;
  }

  async update<T = DocumentData>(
    collectionName: string,
    id: string,
    updates: Partial<T>
  ): Promise<void> {
    const docRef = this.getDoc(collectionName, id);
    const updateData = {
      ...updates,
      updatedAt: Date.now(),
    };
    await updateDoc(docRef, updateData);
  }

  async delete(collectionName: string, id: string): Promise<void> {
    const docRef = this.getDoc(collectionName, id);
    await deleteDoc(docRef);
  }

  // Query helpers
  async queryCollection<T = DocumentData>(
    collectionName: string,
    constraints: {
      where?: Array<{
        field: string;
        operator: WhereFilterOp;
        value: any;
      }>;
      orderBy?: Array<{
        field: string;
        direction?: OrderByDirection;
      }>;
      limit?: number;
    } = {}
  ): Promise<T[]> {
    let q: Query = this.getCollection(collectionName);

    // Add where clauses
    if (constraints.where) {
      for (const w of constraints.where) {
        q = query(q, where(w.field, w.operator, w.value));
      }
    }

    // Add order by
    if (constraints.orderBy) {
      for (const o of constraints.orderBy) {
        q = query(q, orderBy(o.field, o.direction || 'asc'));
      }
    }

    // Add limit
    if (constraints.limit) {
      q = query(q, limit(constraints.limit));
    }

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as T[];
  }

  // Real-time listener
  onCollectionSnapshot<T = DocumentData>(
    collectionName: string,
    constraints: {
      where?: Array<{
        field: string;
        operator: WhereFilterOp;
        value: any;
      }>;
      orderBy?: Array<{
        field: string;
        direction?: OrderByDirection;
      }>;
      limit?: number;
    } = {},
    callback: (data: T[]) => void,
    errorCallback?: (error: Error) => void
  ): () => void {
    let q: Query = this.getCollection(collectionName);

    // Add constraints (same as queryCollection)
    if (constraints.where) {
      for (const w of constraints.where) {
        q = query(q, where(w.field, w.operator, w.value));
      }
    }

    if (constraints.orderBy) {
      for (const o of constraints.orderBy) {
        q = query(q, orderBy(o.field, o.direction || 'asc'));
      }
    }

    if (constraints.limit) {
      q = query(q, limit(constraints.limit));
    }

    return onSnapshot(
      q,
      (querySnapshot) => {
        const data = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        callback(data);
      },
      errorCallback
    );
  }

  // Document listener
  onDocumentSnapshot<T = DocumentData>(
    collectionName: string,
    id: string,
    callback: (data: T | null) => void,
    errorCallback?: (error: Error) => void
  ): () => void {
    const docRef = this.getDoc(collectionName, id);
    
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = {
            id: docSnap.id,
            ...docSnap.data(),
          } as T;
          callback(data);
        } else {
          callback(null);
        }
      },
      errorCallback
    );
  }

  // Batch operations
  async batchWrite(operations: Array<{
    type: 'create' | 'update' | 'delete';
    collection: string;
    id?: string;
    data?: any;
  }>): Promise<void> {
    const batch = writeBatch(this.db);
    const now = Date.now();

    for (const op of operations) {
      const docRef = op.id 
        ? this.getDoc(op.collection, op.id)
        : doc(this.getCollection(op.collection));

      switch (op.type) {
        case 'create':
          batch.set(docRef, {
            ...op.data,
            createdAt: now,
            updatedAt: now,
          });
          break;
        case 'update':
          batch.update(docRef, {
            ...op.data,
            updatedAt: now,
          });
          break;
        case 'delete':
          batch.delete(docRef);
          break;
      }
    }

    await batch.commit();
  }
}

// Export a default instance
export const firestoreService = new FirestoreService(firestore);