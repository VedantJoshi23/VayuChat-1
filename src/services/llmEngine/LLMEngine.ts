import { Response, StreamEvent } from '../../types/common';
import { InferenceConfig } from '../../types/models';

export interface LLMEngine {
  initialize(config: InferenceConfig): Promise<void>;

  /**
   * Generate a response from a fully-built prompt.
   * Prompt assembly (system prompt + history + query) is owned by the
   * orchestration layer (`useLLMEngine` + `contextBuilder`), not the engine.
   */
  generate(
    prompt: string,
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
