import { create } from 'zustand';
import { ModelConfig, InferenceConfig, TokenizerConfig } from '../types/models';

interface ModelStore {
  availableModels: ModelConfig[];
  selectedModelId: string | null;
  selectedTokenizerId: string | null;
  availableTokenizers: TokenizerConfig[];
  inferenceConfig: InferenceConfig | null;

  // Actions
  setAvailableModels: (models: ModelConfig[]) => void;
  addModel: (model: ModelConfig) => void;
  removeModel: (modelId: string) => void;
  selectModel: (modelId: string) => void;
  setAvailableTokenizers: (tokenizers: TokenizerConfig[]) => void;
  selectTokenizer: (tokenizerId: string) => void;
  updateInferenceConfig: (config: Partial<InferenceConfig>) => void;
}

export const useModelStore = create<ModelStore>((set) => ({
  availableModels: [],
  selectedModelId: null,
  selectedTokenizerId: null,
  availableTokenizers: [],
  inferenceConfig: null,

  setAvailableModels: (models) => set({ availableModels: models }),

  addModel: (model) =>
    set((state) => ({
      availableModels: [...state.availableModels, model],
    })),

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

  setAvailableTokenizers: (tokenizers) =>
    set({ availableTokenizers: tokenizers }),

  selectTokenizer: (tokenizerId) => set({ selectedTokenizerId: tokenizerId }),

  updateInferenceConfig: (config) =>
    set((state) => ({
      inferenceConfig: state.inferenceConfig
        ? { ...state.inferenceConfig, ...config }
        : null,
    })),
}));
