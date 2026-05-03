import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import { ModelConfig, InferenceConfig, TokenizerConfig } from '../types/models';

interface ModelStore {
  availableModels: ModelConfig[];
  selectedModelId: string | null;
  selectedModelPath: string | null;
  selectedTokenizerId: string | null;
  selectedTokenizerPath: string | null;
  availableTokenizers: TokenizerConfig[];
  inferenceConfig: InferenceConfig | null;
  isHydrated: boolean;

  // Actions
  setAvailableModels: (models: ModelConfig[]) => void;
  addModel: (model: ModelConfig) => void;
  removeModel: (modelId: string) => void;
  selectModel: (modelId: string) => void;
  setSelectedModelPath: (path: string | null, id?: string | null) => void;
  setAvailableTokenizers: (tokenizers: TokenizerConfig[]) => void;
  selectTokenizer: (tokenizerId: string) => void;
  setSelectedTokenizerPath: (path: string | null, id?: string | null) => void;
  updateInferenceConfig: (config: Partial<InferenceConfig>) => void;
  clearStaleSelections: () => Promise<void>;
}

export const useModelStore = create<ModelStore>()(
  persist(
    (set, get) => ({
      availableModels: [],
      selectedModelId: null,
      selectedModelPath: null,
      selectedTokenizerId: null,
      selectedTokenizerPath: null,
      availableTokenizers: [],
      inferenceConfig: null,
      isHydrated: false,

      setAvailableModels: (models) => set({ availableModels: models }),

      addModel: (model) =>
        set((state) => {
          const exists = state.availableModels.find((m) => m.id === model.id);
          if (exists) return {};
          return { availableModels: [...state.availableModels, model] };
        }),

      removeModel: (modelId) =>
        set((state) => ({
          availableModels: state.availableModels.filter((m) => m.id !== modelId),
        })),

      selectModel: (modelId) =>
        set((state) => {
          const model = state.availableModels.find((m) => m.id === modelId);
          if (!model) return {};
          return {
            selectedModelId: modelId,
            selectedModelPath: model.path,
            inferenceConfig: {
              modelId,
              tokenizerPath: model.tokenizerPath,
              temperature: model.temperature,
              topP: 0.9,
              topK: 40,
              maxTokens: model.maxTokens,
              contextWindow: model.contextWindow,
              streamTokens: true,
            },
          };
        }),

      setSelectedModelPath: (path, id) =>
        set({ selectedModelPath: path, selectedModelId: id ?? null }),

      setAvailableTokenizers: (tokenizers) => set({ availableTokenizers: tokenizers }),

      selectTokenizer: (tokenizerId) =>
        set((state) => {
          const tk = state.availableTokenizers.find((t) => t.id === tokenizerId);
          return {
            selectedTokenizerId: tokenizerId,
            selectedTokenizerPath: tk?.path ?? state.selectedTokenizerPath,
          };
        }),

      setSelectedTokenizerPath: (path, id) =>
        set({ selectedTokenizerPath: path, selectedTokenizerId: id ?? null }),

      updateInferenceConfig: (config) =>
        set((state) => ({
          inferenceConfig: state.inferenceConfig
            ? { ...state.inferenceConfig, ...config }
            : null,
        })),

      clearStaleSelections: async () => {
        const { selectedModelPath, selectedTokenizerPath } = get();
        const updates: Partial<ModelStore> = {};
        if (selectedModelPath) {
          try {
            const exists = await RNFS.exists(selectedModelPath);
            if (!exists) {
              updates.selectedModelPath = null;
              updates.selectedModelId = null;
            }
          } catch {
            updates.selectedModelPath = null;
            updates.selectedModelId = null;
          }
        }
        if (selectedTokenizerPath) {
          try {
            const exists = await RNFS.exists(selectedTokenizerPath);
            if (!exists) {
              updates.selectedTokenizerPath = null;
              updates.selectedTokenizerId = null;
            }
          } catch {
            updates.selectedTokenizerPath = null;
            updates.selectedTokenizerId = null;
          }
        }
        if (Object.keys(updates).length > 0) {
          set(updates);
        }
      },
    }),
    {
      name: 'vayurn.model-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        selectedModelId: state.selectedModelId,
        selectedModelPath: state.selectedModelPath,
        selectedTokenizerId: state.selectedTokenizerId,
        selectedTokenizerPath: state.selectedTokenizerPath,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (!state) return;
        if (error) {
          console.warn('Failed to hydrate model store:', error);
        }
        useModelStore.setState({ isHydrated: true });
        state.clearStaleSelections().catch(() => undefined);
      },
    }
  )
);
