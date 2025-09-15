import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/firebase/auth-provider';
import { authService } from '@/lib/firebase/auth-service';
import { chatService } from '@/lib/firebase/chat-service';
import { messageService } from '@/lib/firebase/message-service';
import type { User, Chat, Message } from '@/lib/firebase/firestore-service';

// ============================================================================
// AUTH HOOKS
// ============================================================================

export function useCurrentUser() {
  const { user: firebaseUser, loading: authLoading } = useAuth();
  
  return useQuery({
    queryKey: ['user', firebaseUser?.uid],
    queryFn: () => authService.getCurrentUser(),
    enabled: !!firebaseUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSignInWithGoogle() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authService.signInWithGoogle(),
    onSuccess: (user) => {
      // Update the user cache
      queryClient.setQueryData(['user', user.uid], user);
    },
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authService.signOut(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });
}

export function useUpdateUserProfile() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (updates: Partial<User>) => authService.updateUserProfile(updates),
    onSuccess: () => {
      // Invalidate user cache
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['user', user.uid] });
      }
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: () => authService.deleteAccount(),
    onSuccess: () => {
      // Clear all cached data
      queryClient.clear();
    },
  });
}

// ============================================================================
// CHAT HOOKS
// ============================================================================

export function useChats() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['chats', user?.uid],
    queryFn: () => chatService.listChatsForUser(),
    enabled: !!user,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useChat(chatId: string | undefined) {
  return useQuery({
    queryKey: ['chat', chatId],
    queryFn: () => chatId ? chatService.getChat(chatId) : null,
    enabled: !!chatId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function usePublicChat(chatId: string | undefined) {
  return useQuery({
    queryKey: ['publicChat', chatId],
    queryFn: () => chatId ? chatService.getPublicChat(chatId) : null,
    enabled: !!chatId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useCreateChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (params: {
      title?: string;
      model?: string;
      personaId?: string;
    }) => chatService.createChat(params),
    onSuccess: () => {
      // Invalidate chats list
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function useUpdateChatModel() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ chatId, model }: { chatId: string; model: string }) =>
      chatService.updateChatModel(chatId, model),
    onSuccess: (_, { chatId }) => {
      // Invalidate specific chat cache
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
    },
  });
}

export function useUpdateChatTitle() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ chatId, title }: { chatId: string; title: string }) =>
      chatService.updateChatTitle(chatId, title),
    onSuccess: (_, { chatId }) => {
      // Invalidate specific chat and chats list
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function useTogglePinChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (chatId: string) => chatService.togglePinChat(chatId),
    onSuccess: (_, chatId) => {
      // Invalidate specific chat and chats list
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function usePublishChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ chatId, hideImages }: { chatId: string; hideImages?: boolean }) =>
      chatService.publishChat(chatId, hideImages),
    onSuccess: (_, { chatId }) => {
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      queryClient.invalidateQueries({ queryKey: ['publicChat', chatId] });
    },
  });
}

export function useUnpublishChat() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (chatId: string) => chatService.unpublishChat(chatId),
    onSuccess: (_, chatId) => {
      queryClient.invalidateQueries({ queryKey: ['chat', chatId] });
      queryClient.invalidateQueries({ queryKey: ['publicChat', chatId] });
    },
  });
}

export function useDeleteChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (chatId: string) => chatService.deleteChat(chatId),
    onSuccess: () => {
      // Invalidate chats list
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function useDeleteAllChats() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: () => chatService.deleteAllChatsForUser(),
    onSuccess: () => {
      // Clear chats cache
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function useBranchChat() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: ({ originalChatId, branchFromMessageId }: {
      originalChatId: string;
      branchFromMessageId: string;
    }) => chatService.branchChat(originalChatId, branchFromMessageId),
    onSuccess: () => {
      // Invalidate chats list
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

export function useForkFromShared() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: (sourceChatId: string) => chatService.forkFromShared(sourceChatId),
    onSuccess: () => {
      // Invalidate chats list
      if (user) {
        queryClient.invalidateQueries({ queryKey: ['chats', user.uid] });
      }
    },
  });
}

// ============================================================================
// MESSAGE HOOKS
// ============================================================================

export function useMessages(chatId: string | undefined) {
  return useQuery({
    queryKey: ['messages', chatId],
    queryFn: () => chatId ? messageService.getMessagesForChat(chatId) : [],
    enabled: !!chatId,
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function usePublicChatMessages(chatId: string | undefined) {
  return useQuery({
    queryKey: ['publicMessages', chatId],
    queryFn: () => chatId ? messageService.getPublicChatMessages(chatId) : [],
    enabled: !!chatId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useMessage(messageId: string | undefined) {
  return useQuery({
    queryKey: ['message', messageId],
    queryFn: () => messageId ? messageService.getMessage(messageId) : null,
    enabled: !!messageId,
    staleTime: 60 * 1000, // 1 minute
  });
}

export function useCreateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (params: {
      chatId: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      parts?: any;
      parentMessageId?: string;
      metadata?: Message['metadata'];
    }) => messageService.createMessage(params),
    onSuccess: (_, { chatId }) => {
      // Invalidate messages for the chat
      queryClient.invalidateQueries({ queryKey: ['messages', chatId] });
    },
  });
}

export function useUpdateMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ messageId, updates }: {
      messageId: string;
      updates: {
        content?: string;
        parts?: any;
        metadata?: Partial<Message['metadata']>;
      };
    }) => messageService.updateMessage(messageId, updates),
    onSuccess: (_, { messageId }) => {
      // Invalidate specific message cache
      queryClient.invalidateQueries({ queryKey: ['message', messageId] });
      // Note: Could also invalidate the messages list, but it's more expensive
    },
  });
}

export function useDeleteMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (messageId: string) => messageService.deleteMessage(messageId),
    onSuccess: () => {
      // Invalidate messages caches - we don't know which chat it belonged to
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useSearchMessages() {
  return useMutation({
    mutationFn: ({ searchQuery, chatId }: { searchQuery: string; chatId?: string }) =>
      messageService.searchMessages(searchQuery, chatId),
  });
}

// ============================================================================
// REAL-TIME HOOKS
// ============================================================================

export function useChatsRealtime() {
  const [chats, setChats] = useState<Chat[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const unsubscribe = chatService.onChatsChange(setChats);
    return unsubscribe;
  }, [user]);

  return chats;
}

export function useChatRealtime(chatId: string | undefined) {
  const [chat, setChat] = useState<Chat | null>(null);

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      return;
    }

    const unsubscribe = chatService.onChatChange(chatId, setChat);
    return unsubscribe;
  }, [chatId]);

  return chat;
}

export function useMessagesRealtime(chatId: string | undefined) {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return;
    }

    const unsubscribe = messageService.onMessagesChange(chatId, setMessages);
    return unsubscribe;
  }, [chatId]);

  return messages;
}