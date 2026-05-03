import { Response, StreamEvent } from '../../types/common';
import { InferenceConfig } from '../../types/models';
import type { RNLlamaOAICompatibleMessage } from './llamaRNBridge';

export interface LLMEngine {
  initialize(config: InferenceConfig): Promise<void>;

  /**
   * Generate from a pre-built raw prompt string.
   * Used for PTE/ExecuTorch models and as a fallback when chat-template
   * formatting is unavailable.
   */
  generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response>;

  /**
   * Generate using the model's embedded chat template (GGUF only).
   * Preferred over `generate()` — avoids the wrong-format / single-token bug.
   * Engines that don't support this leave it undefined.
   */
  generateWithMessages?(
    messages: RNLlamaOAICompatibleMessage[],
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response>;

  isReady(): boolean;
  unload(): Promise<void>;
}

export abstract class BaseLLMEngine implements LLMEngine {
  protected config: InferenceConfig | null = null;
  protected isInitialized = false;

  async initialize(config: InferenceConfig): Promise<void> {
    this.config = config;
    this.isInitialized = true;
  }

  abstract generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response>;

  isReady(): boolean {
    return this.isInitialized && this.config !== null;
  }

  async unload(): Promise<void> {
    this.isInitialized = false;
    this.config = null;
  }
}
