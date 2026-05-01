import { create } from 'zustand';

interface SettingsStore {
  mode: 'tool_calling' | 'direct_inference';
  isDarkMode: boolean;
  streamingEnabled: boolean;
  autoSaveChat: boolean;
  pythonTimeout: number; // ms
  datasetDirectory: string;

  // Actions
  setMode: (mode: 'tool_calling' | 'direct_inference') => void;
  setDarkMode: (isDark: boolean) => void;
  setStreamingEnabled: (enabled: boolean) => void;
  setAutoSaveChat: (enabled: boolean) => void;
  setPythonTimeout: (timeout: number) => void;
  setDatasetDirectory: (path: string) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  mode: 'tool_calling' as const,
  isDarkMode: false,
  streamingEnabled: true,
  autoSaveChat: true,
  pythonTimeout: 10000, // 10 seconds
  datasetDirectory: '', // Will be set to Downloads on init
};

export const useSettingsStore = create<SettingsStore>((set) => ({
  ...DEFAULT_SETTINGS,

  setMode: (mode) => set({ mode }),
  setDarkMode: (isDark) => set({ isDarkMode: isDark }),
  setStreamingEnabled: (enabled) => set({ streamingEnabled: enabled }),
  setAutoSaveChat: (enabled) => set({ autoSaveChat: enabled }),
  setPythonTimeout: (timeout) => set({ pythonTimeout: timeout }),
  setDatasetDirectory: (path) => set({ datasetDirectory: path }),
  resetSettings: () => set(DEFAULT_SETTINGS),
}));
