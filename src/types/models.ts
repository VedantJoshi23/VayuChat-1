export type ModelFormat = 'gguf' | 'pte' | 'onnx';

export interface ModelConfig {
  id: string;
  name: string;
  path: string; // Path in Downloads or cache
  format: ModelFormat;
  size: number;
  contextWindow: number;
  temperature: number;
  maxTokens: number;
  tokenizerPath?: string;
  quantization?: '4bit' | '8bit' | 'none';
  metadata?: {
    paramCount?: string;
    trainedDate?: string;
    description?: string;
  };
}

export interface TokenizerConfig {
  id: string;
  name: string;
  path: string;
  type: 'huggingface' | 'custom';
  modelId: string; // Which model this tokenizer is for
}

export interface InferenceConfig {
  modelId: string;
  tokenizerPath?: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  contextWindow: number;
  streamTokens: boolean;
}
