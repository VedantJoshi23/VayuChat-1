import { create } from 'zustand';
import { Message, Conversation } from '../types/chat';

interface ChatStore {
  currentConversation: Conversation | null;
  messages: Message[];
  isLoading: boolean;
  streamingToken: string;

  // Actions
  setCurrentConversation: (conversation: Conversation | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  appendStreamingToken: (token: string) => void;
  clearStreamingToken: () => void;
  setIsLoading: (loading: boolean) => void;
  resetChat: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  currentConversation: null,
  messages: [],
  isLoading: false,
  streamingToken: '',

  setCurrentConversation: (conversation) =>
    set({ currentConversation: conversation }),

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
    }),
}));
