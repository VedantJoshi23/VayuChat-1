import { Response, StreamEvent } from '../../types/common';
import { Message } from '../../types/chat';
import { InferenceConfig } from '../../types/models';

export interface LLMEngine {
  /**
   * Initialize the engine with model and config
   */
  initialize(config: InferenceConfig): Promise<void>;

  /**
   * Generate response from user query with context
   * @param userQuery Current user input
   * @param context Previous messages for context
   * @param onStream Callback for streaming tokens/events
   */
  generate(
    userQuery: string,
    context: Message[],
    onStream: (event: StreamEvent) => void
  ): Promise<Response>;

  /**
   * Check if engine is ready
   */
  isReady(): boolean;

  /**
   * Clean up resources
   */
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
    userQuery: string,
    context: Message[],
    onStream: (event: StreamEvent) => void
  ): Promise<Response>;

  isReady(): boolean {
    return this.isInitialized && this.config !== null;
  }

  async unload(): Promise<void> {
    this.isInitialized = false;
    this.config = null;
  }

  protected buildContextPrompt(context: Message[]): string {
    return context
      .slice(-10) // Last 10 messages for context window
      .map(
        (msg) =>
          `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      )
      .join('\n');
  }
}
