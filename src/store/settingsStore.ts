import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SettingsStore {
  mode: 'tool_calling' | 'direct_inference';
  isDarkMode: boolean;
  streamingEnabled: boolean;
  autoSaveChat: boolean;
  pythonTimeout: number; // ms
  datasetDirectory: string;
  devMode: boolean;

  setMode: (mode: 'tool_calling' | 'direct_inference') => void;
  setDarkMode: (isDark: boolean) => void;
  setStreamingEnabled: (enabled: boolean) => void;
  setAutoSaveChat: (enabled: boolean) => void;
  setPythonTimeout: (timeout: number) => void;
  setDatasetDirectory: (path: string) => void;
  setDevMode: (enabled: boolean) => void;
  resetSettings: () => void;
}

const DEFAULT_SETTINGS = {
  mode: 'tool_calling' as const,
  isDarkMode: false,
  streamingEnabled: true,
  autoSaveChat: true,
  pythonTimeout: 10000,
  datasetDirectory: '',
  devMode: false,
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      setMode: (mode) => set({ mode }),
      setDarkMode: (isDark) => set({ isDarkMode: isDark }),
      setStreamingEnabled: (enabled) => set({ streamingEnabled: enabled }),
      setAutoSaveChat: (enabled) => set({ autoSaveChat: enabled }),
      setPythonTimeout: (timeout) => set({ pythonTimeout: timeout }),
      setDatasetDirectory: (path) => set({ datasetDirectory: path }),
      setDevMode: (enabled) => set({ devMode: enabled }),
      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'vayurn.settings',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        mode: state.mode,
        isDarkMode: state.isDarkMode,
        streamingEnabled: state.streamingEnabled,
        autoSaveChat: state.autoSaveChat,
        pythonTimeout: state.pythonTimeout,
        datasetDirectory: state.datasetDirectory,
        devMode: state.devMode,
      }),
    }
  )
);
