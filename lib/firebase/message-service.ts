import { auth } from '@/lib/firebase/config';
import { firestoreService, type Message, type Chat } from './firestore-service';
import { chatService } from './chat-service';

export class MessageService {
  // Create a new message
  async createMessage(params: {
    chatId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    parts?: any;
    parentMessageId?: string;
    metadata?: Message['metadata'];
  }): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify chat access
    const chat = await chatService.getChat(params.chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    const now = Date.now();
    const messageData: Omit<Message, 'id'> = {
      chatId: params.chatId,
      userId: currentUser.uid,
      role: params.role,
      content: params.content,
      parts: params.parts,
      createdAt: now,
      parentMessageId: params.parentMessageId,
      metadata: params.metadata || {},
    };

    const messageId = await firestoreService.create<Message>('messages', messageData);

    // Update chat's updatedAt timestamp
    await firestoreService.update<Chat>('chats', params.chatId, {
      updatedAt: now,
    });

    return messageId;
  }

  // Get messages for a chat
  async getMessagesForChat(chatId: string): Promise<Message[]> {
    const currentUser = auth.currentUser;
    
    // For public chats, allow unauthenticated access
    const chat = await firestoreService.read<Chat>('chats', chatId);
    if (!chat) {
      return [];
    }

    // Check permissions
    if (!chat.public && (!currentUser || chat.userId !== currentUser.uid)) {
      return [];
    }

    return await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'chatId', operator: '==', value: chatId }],
      orderBy: [{ field: 'createdAt', direction: 'asc' }],
    });
  }

  // Get public chat messages (for sharing)
  async getPublicChatMessages(chatId: string): Promise<Partial<Message>[]> {
    const chat = await firestoreService.read<Chat>('chats', chatId);
    if (!chat || !chat.public) {
      return [];
    }

    const messages = await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'chatId', operator: '==', value: chatId }],
      orderBy: [{ field: 'createdAt', direction: 'asc' }],
    });

    // Return only safe fields for public viewing
    return messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      parts: this.sanitizeMessageParts(msg.parts, { hideFiles: !chat.shareAttachments }),
      metadata: msg.metadata,
    }));
  }

  // Get a specific message
  async getMessage(messageId: string): Promise<Message | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }

    const message = await firestoreService.read<Message>('messages', messageId);
    if (!message) {
      return null;
    }

    // Verify chat access
    const chat = await chatService.getChat(message.chatId);
    if (!chat || (chat.userId !== currentUser.uid && !chat.public)) {
      return null;
    }

    return message;
  }

  // Update message content
  async updateMessage(messageId: string, updates: {
    content?: string;
    parts?: any;
    metadata?: Partial<Message['metadata']>;
  }): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const message = await this.getMessage(messageId);
    if (!message) {
      throw new Error('Message not found or access denied');
    }

    // Only allow updating user's own messages
    if (message.userId !== currentUser.uid) {
      throw new Error('Can only update your own messages');
    }

    const updateData: Partial<Message> = {};
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.parts !== undefined) updateData.parts = updates.parts;
    if (updates.metadata !== undefined) {
      updateData.metadata = { ...message.metadata, ...updates.metadata };
    }

    await firestoreService.update<Message>('messages', messageId, updateData);

    // Update chat's updatedAt timestamp
    await firestoreService.update<Chat>('chats', message.chatId, {
      updatedAt: Date.now(),
    });
  }

  // Delete a message
  async deleteMessage(messageId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const message = await this.getMessage(messageId);
    if (!message) {
      throw new Error('Message not found or access denied');
    }

    // Only allow deleting user's own messages
    if (message.userId !== currentUser.uid) {
      throw new Error('Can only delete your own messages');
    }

    await firestoreService.delete('messages', messageId);

    // Update chat's updatedAt timestamp
    await firestoreService.update<Chat>('chats', message.chatId, {
      updatedAt: Date.now(),
    });
  }

  // Search messages for a user
  async searchMessages(searchQuery: string, chatId?: string): Promise<Message[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return [];
    }

    // Note: Firestore doesn't have full-text search built-in
    // This is a simple implementation - for production, consider using Algolia or Elasticsearch
    let messages: Message[];

    if (chatId) {
      // Verify chat access
      const chat = await chatService.getChat(chatId);
      if (!chat || chat.userId !== currentUser.uid) {
        return [];
      }

      messages = await this.getMessagesForChat(chatId);
    } else {
      // Search across all user's messages
      messages = await firestoreService.queryCollection<Message>('messages', {
        where: [{ field: 'userId', operator: '==', value: currentUser.uid }],
        orderBy: [{ field: 'createdAt', direction: 'desc' }],
        limit: 1000, // Reasonable limit for client-side search
      });
    }

    // Simple client-side text search
    const query = searchQuery.toLowerCase();
    return messages.filter(msg => 
      msg.content.toLowerCase().includes(query)
    );
  }

  // Get message thread (parent and children)
  async getMessageThread(messageId: string): Promise<{
    message: Message;
    children: Message[];
    parent?: Message;
  } | null> {
    const message = await this.getMessage(messageId);
    if (!message) {
      return null;
    }

    // Get children messages
    const children = await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'parentMessageId', operator: '==', value: messageId }],
      orderBy: [{ field: 'createdAt', direction: 'asc' }],
    });

    // Get parent message if exists
    let parent: Message | undefined;
    if (message.parentMessageId) {
      parent = await this.getMessage(message.parentMessageId) || undefined;
    }

    return {
      message,
      children,
      parent,
    };
  }

  // Real-time listener for messages in a chat
  onMessagesChange(chatId: string, callback: (messages: Message[]) => void): () => void {
    return firestoreService.onCollectionSnapshot<Message>(
      'messages',
      {
        where: [{ field: 'chatId', operator: '==', value: chatId }],
        orderBy: [{ field: 'createdAt', direction: 'asc' }],
      },
      callback,
      (error) => {
        console.error('Messages listener error:', error);
        callback([]);
      }
    );
  }

  // Real-time listener for a specific message
  onMessageChange(messageId: string, callback: (message: Message | null) => void): () => void {
    return firestoreService.onDocumentSnapshot<Message>(
      'messages',
      messageId,
      (message) => {
        // Apply permission check
        if (!message) {
          callback(null);
          return;
        }

        // Check if user can access this message
        const currentUser = auth.currentUser;
        if (!currentUser) {
          callback(null);
          return;
        }

        // Quick permission check - more detailed check would require fetching the chat
        if (message.userId !== currentUser.uid) {
          // For now, assume no access. In production, you'd check if chat is public
          callback(null);
          return;
        }

        callback(message);
      },
      (error) => {
        console.error('Message listener error:', error);
        callback(null);
      }
    );
  }

  // Helper function to sanitize message parts for public viewing
  private sanitizeMessageParts(parts: any, options: { hideFiles?: boolean } = {}): any {
    if (!parts) return parts;

    // This is a simplified version - implement based on your parts structure
    if (Array.isArray(parts)) {
      return parts.map(part => {
        if (options.hideFiles && part.type === 'file') {
          return { type: 'text', text: '[File attachment hidden]' };
        }
        return part;
      });
    }

    return parts;
  }

  // Batch operations for message management
  async batchUpdateMessages(updates: Array<{
    messageId: string;
    updates: Partial<Message>;
  }>): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify permissions for all messages first
    const messageChecks = await Promise.all(
      updates.map(update => this.getMessage(update.messageId))
    );

    for (let i = 0; i < messageChecks.length; i++) {
      const message = messageChecks[i];
      if (!message || message.userId !== currentUser.uid) {
        throw new Error(`Access denied for message ${updates[i].messageId}`);
      }
    }

    // Prepare batch operations
    const batchOperations = updates.map(update => ({
      type: 'update' as const,
      collection: 'messages',
      id: update.messageId,
      data: update.updates,
    }));

    await firestoreService.batchWrite(batchOperations);
  }
}

export const messageService = new MessageService();