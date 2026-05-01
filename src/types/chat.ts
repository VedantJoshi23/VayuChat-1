export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolCalls?: string[]; // ToolCall IDs
  parentMessageId?: string;
  metadata?: {
    executionTime?: number;
    plotsCount?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelUsed: string;
  mode: 'tool_calling' | 'direct_inference';
  messageCount: number;
  systemPrompt?: string;
}

export interface ConversationWithMessages {
  conversation: Conversation;
  messages: Message[];
}
