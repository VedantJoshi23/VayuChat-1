import { BaseLLMEngine } from './LLMEngine';
import { Response, StreamEvent, ToolCall } from '../../types/common';
import { v4 as uuidv4 } from 'uuid';
import * as llamaRNBridge from './llamaRNBridge';
import type { RNLlamaOAICompatibleMessage } from './llamaRNBridge';
import { FunctionCall } from '../dataOperations/DataFrameManager';

// Tool-calling stop token — model should stop after closing the function_calls tag
const TOOL_STOP = '</function_calls>';

export class ToolCallingEngine extends BaseLLMEngine {
  async initialize(config: any): Promise<void> {
    await super.initialize(config);
  }

  /**
   * Generate using the model's native chat template, then parse function calls.
   * Lower temperature (0.2) improves structured-output reliability.
   */
  async generateWithMessages(
    messages: RNLlamaOAICompatibleMessage[],
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady()) throw new Error('ToolCallingEngine not initialized');

    const result = await llamaRNBridge.generateChat(
      messages,
      {
        temperature: this.config?.temperature ?? 0.2,
        maxTokens: this.config?.maxTokens ?? 512,
        topK: this.config?.topK ?? 40,
        topP: this.config?.topP ?? 0.9,
        stop: [TOOL_STOP],
      },
      (token) => onStream({ type: 'token', content: token, timestamp: Date.now() }),
      abortSignal
    );

    return this.buildResponse(result);
  }

  /** Raw-prompt fallback (used for PTE / when template is unavailable). */
  async generate(
    prompt: string,
    onStream: (event: StreamEvent) => void,
    abortSignal?: AbortSignal
  ): Promise<Response> {
    if (!this.isReady()) throw new Error('ToolCallingEngine not initialized');

    const result = await llamaRNBridge.generate(
      prompt,
      {
        temperature: this.config?.temperature ?? 0.2,
        maxTokens: this.config?.maxTokens ?? 512,
        topK: this.config?.topK ?? 40,
        topP: this.config?.topP ?? 0.9,
        stop: [TOOL_STOP, '<|end|>', '<|im_end|>', '<end_of_turn>', '</s>'],
      },
      (token) => onStream({ type: 'token', content: token, timestamp: Date.now() }),
      abortSignal
    );

    return this.buildResponse(result);
  }

  private buildResponse(result: { text: string; generationTimeMs: number; timeToFirstTokenMs: number; outputTokens: number; tokensPerSecond: number }): Response {
    // Ensure closing tag is present if the model stopped at it
    const fullText = result.text.includes(TOOL_STOP)
      ? result.text
      : result.text + TOOL_STOP;

    const parsed = parseFunctionCalls(fullText);

    return {
      type: 'tool_calling',
      content: fullText,
      toolCalls: parsed.map(functionCallToToolCall),
      metrics: {
        generationTimeMs: result.generationTimeMs,
        timeToFirstTokenMs: result.timeToFirstTokenMs,
        outputTokens: result.outputTokens,
        tokensPerSecond: result.tokensPerSecond,
      },
    };
  }

  async unload(): Promise<void> {
    await super.unload();
  }
}

/**
 * Parse <function_calls>[...]</function_calls> from model output.
 * Handles both JSON (double quotes) and Python-dict (single quotes) formats.
 */
export function parseFunctionCalls(text: string): FunctionCall[] {
  const tagMatch = text.match(/<function_calls>\s*([\s\S]*?)\s*(?:<\/function_calls>|$)/);
  const raw = tagMatch ? tagMatch[1].trim() : text.trim();

  if (!raw || !raw.startsWith('[')) return [];

  // 1. Try strict JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as FunctionCall[];
  } catch {}

  // 2. Python-dict single-quote conversion
  try {
    const jsonified = raw
      .replace(/'/g, '"')
      .replace(/\bTrue\b/g, 'true')
      .replace(/\bFalse\b/g, 'false')
      .replace(/\bNone\b/g, 'null');
    const parsed = JSON.parse(jsonified);
    if (Array.isArray(parsed)) return parsed as FunctionCall[];
  } catch {}

  return [];
}

function functionCallToToolCall(fc: FunctionCall): ToolCall {
  return {
    id: uuidv4(),
    name: fc.function,
    arguments: fc.args ?? {},
    status: 'pending',
  };
}
