import { create } from 'zustand';
import { ToolCall } from '../types/common';

interface ExecutionStore {
  toolCalls: ToolCall[];
  executionLogs: ExecutionLog[];

  // Actions
  addToolCall: (toolCall: ToolCall) => void;
  updateToolCall: (id: string, updates: Partial<ToolCall>) => void;
  clearToolCalls: () => void;
  addExecutionLog: (log: ExecutionLog) => void;
  getExecutionLogs: (messageId: string) => ExecutionLog[];
}

export interface ExecutionLog {
  id: string;
  messageId: string;
  code: string;
  stdout: string;
  stderr: string;
  plotsCount: number;
  error: string | null;
  executionTime: number;
  timestamp: number;
}

export const useExecutionStore = create<ExecutionStore>((set, get) => ({
  toolCalls: [],
  executionLogs: [],

  addToolCall: (toolCall) =>
    set((state) => ({
      toolCalls: [...state.toolCalls, toolCall],
    })),

  updateToolCall: (id, updates) =>
    set((state) => ({
      toolCalls: state.toolCalls.map((tc) =>
        tc.id === id ? { ...tc, ...updates } : tc
      ),
    })),

  clearToolCalls: () => set({ toolCalls: [] }),

  addExecutionLog: (log) =>
    set((state) => ({
      executionLogs: [...state.executionLogs, log],
    })),

  getExecutionLogs: (messageId) =>
    get().executionLogs.filter((log) => log.messageId === messageId),
}));
