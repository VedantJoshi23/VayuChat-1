import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent } from '../../types/common';
import * as llamaRNBridge from './llamaRNBridge';
import type { RNLlamaOAICompatibleMessage } from './llamaRNBridge';

export class DirectInferenceEngine extends BaseLLMEngine {
  async initialize(config: any): Promise<void> {
    await super.initialize(config);
  }

  /**
   * Generate using the model's native chat template.
   * Preferred over `generate()` for GGUF models — ensures the prompt format
   * matches what the model was trained on, avoiding the "first token is EOS"
   * failure mode seen when raw prompts are used with instruction-tuned models.
   */
  async generateWithMessages(
    messages: RNLlamaOAICompatibleMessage[],
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady()) throw new Error('DirectInferenceEngine not initialized');

    const result = await llamaRNBridge.generateChat(
      messages,
      {
        temperature: this.config?.temperature ?? 0.7,
        maxTokens: this.config?.maxTokens ?? 512,
        topK: this.config?.topK ?? 40,
        topP: this.config?.topP ?? 0.9,
      },
      (token) => onStream({ type: 'token', content: token, timestamp: Date.now() }),
      abortSignal
    );

    return {
      type: 'direct_inference',
      content: result.text,
      code: this.extractCode(result.text),
      metrics: {
        generationTimeMs: result.generationTimeMs,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        outputTokens: result.outputTokens,
        tokensPerSecond: result.tokensPerSecond,
      },
    };
  }

  /** Raw-prompt fallback (used for PTE / when template is unavailable). */
  async generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady()) throw new Error('DirectInferenceEngine not initialized');

    const result = await llamaRNBridge.generate(
      prompt,
      {
        temperature: this.config?.temperature ?? 0.7,
        maxTokens: this.config?.maxTokens ?? 512,
        topK: this.config?.topK ?? 40,
        topP: this.config?.topP ?? 0.9,
      },
      (token) => onStream({ type: 'token', content: token, timestamp: Date.now() }),
      abortSignal
    );

    return {
      type: 'direct_inference',
      content: result.text,
      code: this.extractCode(result.text),
      metrics: {
        generationTimeMs: result.generationTimeMs,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        outputTokens: result.outputTokens,
        tokensPerSecond: result.tokensPerSecond,
      },
    };
  }

  private extractCode(text: string): string {
    const fenced = text.match(/```(?:python)?\s*([\s\S]*?)```/);
    if (fenced) return fenced[1].trim();
    return text.trim();
  }

  async unload(): Promise<void> {
    await super.unload();
  }
}
