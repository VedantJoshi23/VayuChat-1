import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Message, Conversation } from '../types/chat';

interface ChatStore {
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  streamingToken: string;
  lastConversationId: string | null;

  // Actions
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamingToken: (token: string) => void;
  clearStreamingToken: () => void;
  setIsLoading: (loading: boolean) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatStore>()(
  persist(
    (set) => ({
      currentConversation: null,
      messages: [],
      isLoading: false,
      streamingToken: '',
      lastConversationId: null,

      setCurrentConversation: (conversation) =>
        set({
          currentConversation: conversation,
          lastConversationId: conversation?.id ?? null,
        }),

      setMessages: (messages) => set({ messages }),

      addMessage: (message) =>
        set((state) => ({
          messages: [...state.messages, message],
        })),

      appendStreamingToken: (token) =>
        set((state) => ({
          streamingToken: state.streamingToken + token,
        })),

      clearStreamingToken: () => set({ streamingToken: '' }),

      setIsLoading: (loading) => set({ isLoading: loading }),

      resetChat: () =>
        set({
          currentConversation: null,
          messages: [],
          streamingToken: '',
          isLoading: false,
          // lastConversationId intentionally kept — used for resume
        }),
    }),
    {
      name: 'vayurn.chat-store',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist the last conversation reference, not full messages (too large)
      partialize: (state) => ({
        lastConversationId: state.lastConversationId,
      }),
    }
  )
);
