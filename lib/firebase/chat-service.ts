import { auth } from '@/lib/firebase/config';
import { firestoreService, type Chat, type Message } from './firestore-service';

export class ChatService {
  // Create a new chat
  async createChat(params: {
    title?: string;
    model?: string;
    personaId?: string;
  }): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    const now = Date.now();
    const chatData: Omit<Chat, 'id'> = {
      userId: currentUser.uid,
      title: params.title ?? 'New Chat',
      model: params.model,
      personaId: params.personaId,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      public: false,
      shareAttachments: false,
    };

    return await firestoreService.create<Chat>('chats', chatData);
  }

  // Get a chat by ID (with permission check)
  async getChat(chatId: string): Promise<Chat | null> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return null;
    }

    const chat = await firestoreService.read<Chat>('chats', chatId);
    
    // Check permissions: owner or public chat
    if (!chat || (chat.userId !== currentUser.uid && !chat.public)) {
      return null;
    }

    return chat;
  }

  // Get public chat (no auth required)
  async getPublicChat(chatId: string): Promise<Partial<Chat> | null> {
    const chat = await firestoreService.read<Chat>('chats', chatId);
    
    if (!chat || !chat.public) {
      return null;
    }

    // Return only public fields
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      public: chat.public,
      shareAttachments: chat.shareAttachments,
    };
  }

  // List user's chats
  async listChatsForUser(): Promise<Chat[]> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return [];
    }

    return await firestoreService.queryCollection<Chat>('chats', {
      where: [{ field: 'userId', operator: '==', value: currentUser.uid }],
      orderBy: [{ field: 'updatedAt', direction: 'desc' }],
    });
  }

  // Update chat model
  async updateChatModel(chatId: string, model: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    await firestoreService.update<Chat>('chats', chatId, { model });
  }

  // Update chat title
  async updateChatTitle(chatId: string, title: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    await firestoreService.update<Chat>('chats', chatId, { title });
  }

  // Toggle chat pin status
  async togglePinChat(chatId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    await firestoreService.update<Chat>('chats', chatId, { 
      isPinned: !chat.isPinned 
    });
  }

  // Publish chat (make it public)
  async publishChat(chatId: string, hideImages = false): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    await firestoreService.update<Chat>('chats', chatId, { 
      public: true,
      shareAttachments: !hideImages,
    });
  }

  // Unpublish chat (make it private)
  async unpublishChat(chatId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    await firestoreService.update<Chat>('chats', chatId, { 
      public: false,
      shareAttachments: false,
    });
  }

  // Delete a chat and all its messages
  async deleteChat(chatId: string): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership
    const chat = await this.getChat(chatId);
    if (!chat || chat.userId !== currentUser.uid) {
      throw new Error('Chat not found or access denied');
    }

    // Get all messages in the chat
    const messages = await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'chatId', operator: '==', value: chatId }],
    });

    // Get all attachments in the chat
    const attachments = await firestoreService.queryCollection<any>('chat_attachments', {
      where: [{ field: 'chatId', operator: '==', value: chatId }],
    });

    // Prepare batch deletion
    const batchOperations: Array<{
      type: 'delete';
      collection: string;
      id: string;
    }> = [];

    // Add chat to deletion
    batchOperations.push({ type: 'delete', collection: 'chats', id: chatId });

    // Add messages to deletion
    for (const message of messages) {
      batchOperations.push({ type: 'delete', collection: 'messages', id: message.id });
    }

    // Add attachments to deletion
    for (const attachment of attachments) {
      batchOperations.push({ type: 'delete', collection: 'chat_attachments', id: attachment.id });
    }

    // Execute batch deletion
    await firestoreService.batchWrite(batchOperations);
  }

  // Delete all chats for the current user
  async deleteAllChatsForUser(): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Get all user's chats
    const chats = await this.listChatsForUser();

    // Delete each chat (which will also delete messages and attachments)
    for (const chat of chats) {
      await this.deleteChat(chat.id);
    }
  }

  // Branch a chat from a specific message
  async branchChat(originalChatId: string, branchFromMessageId: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Verify ownership of original chat
    const originalChat = await this.getChat(originalChatId);
    if (!originalChat || originalChat.userId !== currentUser.uid) {
      throw new Error('Original chat not found or access denied');
    }

    // Get the branch message
    const branchMessage = await firestoreService.read<Message>('messages', branchFromMessageId);
    if (!branchMessage || branchMessage.chatId !== originalChatId) {
      throw new Error('Branch message not found');
    }

    // Only allow branching from assistant messages
    if (branchMessage.role !== 'assistant') {
      throw new Error('Can only branch from assistant messages');
    }

    // Create new chat
    const now = Date.now();
    const newChatId = await firestoreService.create<Chat>('chats', {
      userId: currentUser.uid,
      title: originalChat.title || 'New Chat',
      model: originalChat.model,
      personaId: originalChat.personaId,
      originalChatId: originalChatId,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      public: false,
      shareAttachments: false,
    });

    // Get all messages up to and including the branch point
    const messagesToCopy = await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'chatId', operator: '==', value: originalChatId }],
      orderBy: [{ field: 'createdAt', direction: 'asc' }],
    });

    // Filter and copy messages up to the branch point
    const branchTimestamp = branchMessage.createdAt;
    const messagesToCopyFiltered = messagesToCopy.filter(
      msg => msg.createdAt <= branchTimestamp
    );

    // Copy messages to new chat
    const batchOperations: Array<{
      type: 'create';
      collection: string;
      data: any;
    }> = [];

    for (const message of messagesToCopyFiltered) {
      batchOperations.push({
        type: 'create',
        collection: 'messages',
        data: {
          chatId: newChatId,
          userId: message.userId,
          role: message.role,
          content: message.content,
          parts: message.parts,
          createdAt: message.createdAt,
          parentMessageId: message.parentMessageId,
          metadata: message.metadata,
        },
      });

      // Stop after we've included the branch message
      if (message.id === branchFromMessageId) {
        break;
      }
    }

    await firestoreService.batchWrite(batchOperations);

    return newChatId;
  }

  // Fork a shared chat to the current user's account
  async forkFromShared(sourceChatId: string): Promise<string> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Not authenticated');
    }

    // Get the public chat
    const sourceChat = await firestoreService.read<Chat>('chats', sourceChatId);
    if (!sourceChat || !sourceChat.public) {
      throw new Error('Chat not found or not public');
    }

    // Create new chat
    const now = Date.now();
    const newChatId = await firestoreService.create<Chat>('chats', {
      userId: currentUser.uid,
      title: sourceChat.title || 'Forked Chat',
      model: sourceChat.model,
      personaId: sourceChat.personaId,
      createdAt: now,
      updatedAt: now,
      isPinned: false,
      public: false,
      shareAttachments: false,
    });

    // Get all messages from the source chat
    const messages = await firestoreService.queryCollection<Message>('messages', {
      where: [{ field: 'chatId', operator: '==', value: sourceChatId }],
      orderBy: [{ field: 'createdAt', direction: 'asc' }],
    });

    // Copy messages to new chat
    const batchOperations: Array<{
      type: 'create';
      collection: string;
      data: any;
    }> = [];

    for (const message of messages) {
      batchOperations.push({
        type: 'create',
        collection: 'messages',
        data: {
          chatId: newChatId,
          userId: currentUser.uid,
          role: message.role,
          content: message.content,
          parts: message.parts, // TODO: Sanitize parts based on shareAttachments
          createdAt: message.createdAt,
          parentMessageId: message.parentMessageId,
          metadata: message.metadata,
        },
      });
    }

    await firestoreService.batchWrite(batchOperations);

    return newChatId;
  }

  // Real-time listener for user's chats
  onChatsChange(callback: (chats: Chat[]) => void): () => void {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      callback([]);
      return () => {};
    }

    return firestoreService.onCollectionSnapshot<Chat>(
      'chats',
      {
        where: [{ field: 'userId', operator: '==', value: currentUser.uid }],
        orderBy: [{ field: 'updatedAt', direction: 'desc' }],
      },
      callback,
      (error) => {
        console.error('Chats listener error:', error);
        callback([]);
      }
    );
  }

  // Real-time listener for a specific chat
  onChatChange(chatId: string, callback: (chat: Chat | null) => void): () => void {
    return firestoreService.onDocumentSnapshot<Chat>(
      'chats',
      chatId,
      (chat) => {
        // Apply permission check
        const currentUser = auth.currentUser;
        if (!chat || (!currentUser || (chat.userId !== currentUser.uid && !chat.public))) {
          callback(null);
          return;
        }
        callback(chat);
      },
      (error) => {
        console.error('Chat listener error:', error);
        callback(null);
      }
    );
  }
}

export const chatService = new ChatService();